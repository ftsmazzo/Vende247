/**
 * Cliente HTTP Kairogen (api.kairogen.ai).
 * Auth: Bearer OAuth (access + refresh via client_id kairogen-mcp).
 * Tokens renovados são persistidos em app_secrets (Postgres) para sobreviver a restart.
 * Geração: POST /generations { model, params: { prompt, aspect_ratio, images? } }
 */

import { getPool, query } from "../db/index.js";

const DEFAULT_BASE = "https://api.kairogen.ai";
const CLIENT_ID = "kairogen-mcp";
const SECRET_KEY = "kairogen_oauth";

type TokenBundle = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
};

let memoryTokens: TokenBundle | null = null;
let loadPromise: Promise<void> | null = null;
let refreshLock: Promise<TokenBundle> | null = null;

function apiBase() {
  return (process.env.KAIROGEN_API_BASE?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

function jwtExpiresAt(accessToken: string): number | undefined {
  try {
    const part = accessToken.split(".")[1];
    if (!part) return undefined;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(pad, "base64").toString("utf8")) as {
      exp?: number;
    };
    return typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

function loadEnvTokens(): TokenBundle | null {
  const access =
    process.env.KAIROGEN_ACCESS_TOKEN?.trim() ||
    process.env.KAIROGEN_API_KEY?.trim() ||
    "";
  if (!access) return null;
  const refresh = process.env.KAIROGEN_REFRESH_TOKEN?.trim() || undefined;
  return {
    access_token: access,
    refresh_token: refresh,
    expires_at: jwtExpiresAt(access),
  };
}

async function loadDbTokens(): Promise<TokenBundle | null> {
  if (!getPool()) return null;
  try {
    const r = await query<{ value: TokenBundle }>(
      `SELECT value FROM app_secrets WHERE key = $1`,
      [SECRET_KEY]
    );
    const v = r.rows[0]?.value;
    if (!v?.access_token) return null;
    return {
      access_token: String(v.access_token),
      refresh_token: v.refresh_token ? String(v.refresh_token) : undefined,
      expires_at:
        typeof v.expires_at === "number" ? v.expires_at : jwtExpiresAt(String(v.access_token)),
    };
  } catch (err) {
    console.warn("[kairogen] falha ao ler app_secrets:", err);
    return null;
  }
}

async function saveTokens(tok: TokenBundle): Promise<void> {
  memoryTokens = tok;
  process.env.KAIROGEN_ACCESS_TOKEN = tok.access_token;
  if (tok.refresh_token) process.env.KAIROGEN_REFRESH_TOKEN = tok.refresh_token;

  if (!getPool()) return;
  try {
    await query(
      `INSERT INTO app_secrets (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW()`,
      [
        SECRET_KEY,
        JSON.stringify({
          access_token: tok.access_token,
          refresh_token: tok.refresh_token || null,
          expires_at: tok.expires_at || null,
        }),
      ]
    );
  } catch (err) {
    console.warn("[kairogen] falha ao gravar app_secrets:", err);
  }
}

async function ensureTokensLoaded(): Promise<void> {
  if (memoryTokens?.access_token) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      const fromDb = await loadDbTokens();
      const fromEnv = loadEnvTokens();
      // Prefere DB (refresh mais novo) se existir; senão seed a partir do env.
      if (fromDb?.access_token) {
        memoryTokens = fromDb;
        // Se env tem refresh e DB não, completa
        if (!memoryTokens.refresh_token && fromEnv?.refresh_token) {
          memoryTokens.refresh_token = fromEnv.refresh_token;
          await saveTokens(memoryTokens);
        }
      } else if (fromEnv?.access_token) {
        await saveTokens(fromEnv);
      }
    })().finally(() => {
      loadPromise = null;
    });
  }
  await loadPromise;
}

async function currentTokens(): Promise<TokenBundle> {
  await ensureTokensLoaded();
  if (memoryTokens?.access_token) return memoryTokens;
  throw new Error(
    "KAIROGEN_ACCESS_TOKEN (ou KAIROGEN_API_KEY) não configurada. Conecte via OAuth device flow."
  );
}

async function refreshAccessToken(refreshToken: string): Promise<TokenBundle> {
  if (refreshLock) return refreshLock;
  refreshLock = (async () => {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    });
    const res = await fetch(`${apiBase()}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
      message?: string;
    };
    if (!res.ok || !json.access_token) {
      throw new Error(
        json.error_description ||
          json.message ||
          json.error ||
          `Kairogen refresh HTTP ${res.status}`
      );
    }
    const next: TokenBundle = {
      access_token: json.access_token,
      refresh_token: json.refresh_token || refreshToken,
      expires_at:
        jwtExpiresAt(json.access_token) ||
        Date.now() + (json.expires_in ?? 28800) * 1000,
    };
    await saveTokens(next);
    console.log(
      "[kairogen] token renovado; expira em",
      next.expires_at ? new Date(next.expires_at).toISOString() : "?"
    );
    return next;
  })().finally(() => {
    refreshLock = null;
  });
  return refreshLock;
}

async function authHeaders(): Promise<Record<string, string>> {
  let tok = await currentTokens();
  const skew = 5 * 60_000; // renova 5 min antes
  if (tok.refresh_token && (!tok.expires_at || tok.expires_at < Date.now() + skew)) {
    try {
      tok = await refreshAccessToken(tok.refresh_token);
    } catch (err) {
      // Se ainda parece válido, tenta seguir; senão propaga
      if (!tok.expires_at || tok.expires_at < Date.now()) throw err;
      console.warn("[kairogen] refresh antecipado falhou, usando access atual:", err);
    }
  }
  return {
    Authorization: `Bearer ${tok.access_token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = {
    ...(await authHeaders()),
    ...(init?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (res.status === 401) {
    const tok = await currentTokens();
    if (tok.refresh_token) {
      await refreshAccessToken(tok.refresh_token);
      const headers2 = {
        ...(await authHeaders()),
        ...(init?.headers as Record<string, string> | undefined),
      };
      return fetch(`${apiBase()}${path}`, { ...init, headers: headers2 });
    }
  }
  return res;
}

type GenerationStatus = {
  generationId: string;
  status: string;
  outputUrls?: string[];
  error?: string | null;
  params?: Record<string, unknown>;
};

function kairogenModelForPurpose(purpose?: string): string {
  const p = (purpose || "cover").toLowerCase();
  // gpt-image-2: melhor tipografia PT no criativo IG (texto na arte).
  // flux/seedream: foto/hero. nano-banana: volume barato / edit.
  if (p === "photo") {
    return (
      process.env.KAIROGEN_MODEL_PHOTO?.trim() ||
      process.env.KAIROGEN_IMAGE_MODEL?.trim() ||
      "flux-2-pro"
    );
  }
  if (p === "draft" || p === "volume") {
    return (
      process.env.KAIROGEN_MODEL_VOLUME?.trim() ||
      process.env.KAIROGEN_IMAGE_MODEL?.trim() ||
      "gpt-image-2"
    );
  }
  return (
    process.env.KAIROGEN_MODEL_COVER?.trim() ||
    process.env.KAIROGEN_IMAGE_MODEL?.trim() ||
    "gpt-image-2"
  );
}

async function pollGeneration(
  generationId: string,
  timeoutMs: number
): Promise<GenerationStatus> {
  const started = Date.now();
  let delay = 2000;
  while (Date.now() - started < timeoutMs) {
    const res = await apiFetch(`/generations/${generationId}`);
    const json = (await res.json()) as GenerationStatus & {
      message?: string;
      statusCode?: number;
    };
    if (!res.ok) {
      throw new Error(json.message || `Kairogen poll HTTP ${res.status}`);
    }
    const st = (json.status || "").toUpperCase();
    if (st === "COMPLETED" || st === "SUCCESS") return json;
    if (st === "FAILED" || st === "ERROR" || st === "CANCELLED") {
      throw new Error(json.error || `Kairogen geração ${st}`);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 500, 5000);
  }
  throw new Error(`Kairogen timeout após ${Math.round(timeoutMs / 1000)}s`);
}

/**
 * Gera (ou edita com referência) e devolve o buffer da primeira imagem.
 */
export async function bufferFromKairogen(
  prompt: string,
  opts?: {
    purpose?: string;
    aspectRatio?: string;
    referenceImageUrls?: string[];
    model?: string;
    timeoutMs?: number;
  }
): Promise<Buffer> {
  const model = opts?.model || kairogenModelForPurpose(opts?.purpose);
  const aspectRatio = opts?.aspectRatio || "4:5";
  const refs = (opts?.referenceImageUrls || []).filter(Boolean).slice(0, 10);
  const params: Record<string, unknown> = {
    prompt: prompt.slice(0, 4000),
    aspect_ratio: aspectRatio,
    numImages: 1,
  };
  if (refs.length) params.images = refs;
  // Tipografia legível em criativos IG (modelos GPT Image no Kairogen)
  const purpose = (opts?.purpose || "cover").toLowerCase();
  if (/gpt-image/i.test(model)) {
    params.quality = purpose === "draft" || purpose === "volume" ? "medium" : "high";
  }

  const body = { model, params };
  const res = await apiFetch("/generations", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    generationId?: string;
    status?: string;
    message?: string;
    code?: string;
  };
  if (!res.ok || !json.generationId) {
    throw new Error(
      json.message || json.code || `Kairogen generate HTTP ${res.status}`
    );
  }

  const done = await pollGeneration(
    json.generationId,
    opts?.timeoutMs ?? 10 * 60 * 1000
  );
  const url = done.outputUrls?.[0];
  if (!url) throw new Error("Kairogen concluiu sem outputUrls.");

  const img = await fetch(url);
  if (!img.ok) throw new Error(`Download Kairogen CDN HTTP ${img.status}`);
  return Buffer.from(await img.arrayBuffer());
}

export { kairogenModelForPurpose };
