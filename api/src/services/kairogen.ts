/**
 * Cliente HTTP Kairogen (api.kairogen.ai).
 * Auth: Bearer OAuth (access + refresh via client_id kairogen-mcp).
 * Geração: POST /generations { model, params: { prompt, aspect_ratio, images? } }
 */

const DEFAULT_BASE = "https://api.kairogen.ai";
const CLIENT_ID = "kairogen-mcp";

type TokenBundle = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
};

let memoryTokens: TokenBundle | null = null;

function apiBase() {
  return (process.env.KAIROGEN_API_BASE?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

function loadEnvTokens(): TokenBundle | null {
  const access =
    process.env.KAIROGEN_ACCESS_TOKEN?.trim() ||
    process.env.KAIROGEN_API_KEY?.trim() ||
    "";
  if (!access) return null;
  const refresh = process.env.KAIROGEN_REFRESH_TOKEN?.trim() || undefined;
  return { access_token: access, refresh_token: refresh };
}

function currentTokens(): TokenBundle {
  if (memoryTokens?.access_token) return memoryTokens;
  const fromEnv = loadEnvTokens();
  if (!fromEnv) {
    throw new Error(
      "KAIROGEN_ACCESS_TOKEN (ou KAIROGEN_API_KEY) não configurada. Conecte via OAuth device flow."
    );
  }
  memoryTokens = fromEnv;
  return memoryTokens;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenBundle> {
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
    expires_at: Date.now() + (json.expires_in ?? 28800) * 1000,
  };
  memoryTokens = next;
  // Mantém process.env atualizado nesta instância (EasyPanel precisa reiniciar p/ persistir)
  process.env.KAIROGEN_ACCESS_TOKEN = next.access_token;
  if (next.refresh_token) process.env.KAIROGEN_REFRESH_TOKEN = next.refresh_token;
  return next;
}

async function authHeaders(forceRefresh = false): Promise<Record<string, string>> {
  let tok = currentTokens();
  if (forceRefresh && tok.refresh_token) {
    tok = await refreshAccessToken(tok.refresh_token);
  } else if (
    tok.refresh_token &&
    tok.expires_at &&
    tok.expires_at < Date.now() + 60_000
  ) {
    tok = await refreshAccessToken(tok.refresh_token);
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
    const tok = currentTokens();
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

export type KairogenGenerateOpts = {
  model?: string;
  prompt: string;
  aspectRatio?: string;
  /** URLs públicas — ativa modo Editar (img2img) nos modelos com support */
  referenceImageUrls?: string[];
  numImages?: number;
  resolution?: string;
  negativePrompt?: string;
  timeoutMs?: number;
};

type GenerationStatus = {
  generationId: string;
  status: string;
  outputUrls?: string[];
  error?: string | null;
  params?: Record<string, unknown>;
};

function kairogenModelForPurpose(purpose?: string): string {
  const p = (purpose || "cover").toLowerCase();
  if (p === "photo") {
    return process.env.KAIROGEN_MODEL_PHOTO?.trim() || process.env.KAIROGEN_IMAGE_MODEL?.trim() || "nano-banana-pro";
  }
  if (p === "draft" || p === "volume") {
    return process.env.KAIROGEN_MODEL_VOLUME?.trim() || process.env.KAIROGEN_IMAGE_MODEL?.trim() || "nano-banana";
  }
  return process.env.KAIROGEN_MODEL_COVER?.trim() || process.env.KAIROGEN_IMAGE_MODEL?.trim() || "nano-banana-pro";
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
