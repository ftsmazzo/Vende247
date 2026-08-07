import type { FastifyPluginAsync } from "fastify";
import { query } from "../db/index.js";
import {
  getUserId,
  getWorkspaceForUser,
  publicWorkspace,
  requireAuth,
} from "../services/authHelpers.js";
import { getProductPreset, listProductPresets } from "../services/brandPresets.js";

function normalizeCompetitors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x).replace(/^@/, "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    return publicWorkspace(ws);
  });

  app.get("/presets", async () => ({ presets: listProductPresets() }));

  app.post<{ Body: { preset_id?: string } }>("/apply-preset", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const id = (req.body?.preset_id || "planner-mulher").trim();
    const preset = getProductPreset(id);
    if (!preset) return reply.status(400).send({ error: "Preset não encontrado." });

    const prev = (ws.brand_kit || {}) as Record<string, unknown>;
    const kit = {
      ...prev,
      ...preset.brand_kit,
      logo_url: prev.logo_url || preset.brand_kit.logo_url,
      site_url: prev.site_url || preset.brand_kit.site_url,
      extracted_at: new Date().toISOString(),
    };

    await query(
      `UPDATE workspaces SET
         nicho = $2, produto = $3, oferta = $4, cta = $5, tom_voz = $6,
         concorrentes = $7::jsonb,
         brand_kit = $8::jsonb,
         onboarding_done = TRUE,
         updated_at = NOW()
       WHERE id = $1`,
      [
        ws.id,
        preset.nicho,
        preset.produto,
        preset.oferta,
        preset.cta,
        preset.tom_voz,
        JSON.stringify(preset.concorrentes),
        JSON.stringify(kit),
      ]
    );

    const fresh = await getWorkspaceForUser(getUserId(req));
    return {
      workspace: publicWorkspace(fresh),
      preset: { id: preset.id, label: preset.label },
    };
  });

  app.put<{
    Body: {
      name?: string;
      nicho?: string;
      produto?: string;
      oferta?: string;
      cta?: string;
      tom_voz?: string;
      concorrentes?: string[];
      ig_user_id?: string;
      ig_username?: string;
      ig_access_token?: string;
      brand_kit?: Record<string, unknown>;
      onboarding_done?: boolean;
    };
  }>("/", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const b = req.body ?? {};
    const concorrentes =
      b.concorrentes !== undefined ? normalizeCompetitors(b.concorrentes) : ws.concorrentes;

    await query(
      `UPDATE workspaces SET
         name = COALESCE($2, name),
         nicho = COALESCE($3, nicho),
         produto = COALESCE($4, produto),
         oferta = COALESCE($5, oferta),
         cta = COALESCE($6, cta),
         tom_voz = COALESCE($7, tom_voz),
         concorrentes = $8::jsonb,
         ig_user_id = COALESCE($9, ig_user_id),
         ig_username = COALESCE($10, ig_username),
         ig_access_token = CASE WHEN $11::text IS NULL OR $11 = '' THEN ig_access_token ELSE $11 END,
         brand_kit = COALESCE($12::jsonb, brand_kit),
         onboarding_done = COALESCE($13, onboarding_done),
         updated_at = NOW()
       WHERE id = $1`,
      [
        ws.id,
        b.name ?? null,
        b.nicho ?? null,
        b.produto ?? null,
        b.oferta ?? null,
        b.cta ?? null,
        b.tom_voz ?? null,
        JSON.stringify(concorrentes),
        b.ig_user_id ?? null,
        b.ig_username ?? null,
        b.ig_access_token ?? null,
        b.brand_kit ? JSON.stringify(b.brand_kit) : null,
        b.onboarding_done ?? null,
      ]
    );

    const fresh = await getWorkspaceForUser(getUserId(req));
    return publicWorkspace(fresh);
  });

  app.post<{
    Body: {
      nicho: string;
      produto: string;
      oferta?: string;
      cta?: string;
      tom_voz?: string;
      concorrentes: string[];
      ig_user_id?: string;
      ig_username?: string;
      ig_access_token?: string;
    };
  }>("/onboarding", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const b = req.body ?? ({} as typeof req.body);
    if (!b.nicho?.trim() || !b.produto?.trim()) {
      return reply.status(400).send({ error: "Nicho e produto são obrigatórios." });
    }
    const concorrentes = normalizeCompetitors(b.concorrentes);
    if (concorrentes.length < 1) {
      return reply.status(400).send({ error: "Informe pelo menos 1 concorrente (@handle)." });
    }

    await query(
      `UPDATE workspaces SET
         nicho = $2, produto = $3, oferta = $4, cta = $5, tom_voz = $6,
         concorrentes = $7::jsonb,
         ig_user_id = COALESCE(NULLIF($8, ''), ig_user_id),
         ig_username = COALESCE(NULLIF($9, ''), ig_username),
         ig_access_token = CASE WHEN NULLIF($10, '') IS NULL THEN ig_access_token ELSE $10 END,
         onboarding_done = TRUE,
         updated_at = NOW()
       WHERE id = $1`,
      [
        ws.id,
        b.nicho.trim(),
        b.produto.trim(),
        (b.oferta ?? "").trim(),
        (b.cta ?? "").trim(),
        (b.tom_voz ?? "").trim(),
        JSON.stringify(concorrentes),
        (b.ig_user_id ?? "").trim(),
        (b.ig_username ?? "").replace(/^@/, "").trim(),
        (b.ig_access_token ?? "").trim(),
      ]
    );

    const fresh = await getWorkspaceForUser(getUserId(req));
    return publicWorkspace(fresh);
  });
};
