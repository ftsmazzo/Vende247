import type { FastifyPluginAsync } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "../db/index.js";
import { getUserId, getWorkspaceForUser, requireAuth } from "../services/authHelpers.js";
import {
  getActiveIdentity,
  getCampaign,
  listCampaigns,
  publicCampaign,
} from "../services/campaignHelpers.js";
import type { IdentityModel } from "../services/identityContract.js";

const TYPES = new Set(["produto", "servico", "candidato", "oferta"]);

function seedPaths() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  return {
    json: path.join(dir, "../data/flavio-identity.json"),
    css: path.join(dir, "../data/flavio-tokens.css"),
  };
}

export const campaignRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const rows = await listCampaigns(ws.id);
    const out = [];
    for (const c of rows) {
      const identity = await getActiveIdentity(c.id);
      out.push(publicCampaign(c, { identity }));
    }
    return { campaigns: out };
  });

  app.post<{
    Body: {
      type?: string;
      name?: string;
      nicho?: string;
      produto?: string;
      oferta?: string;
      cta?: string;
      tom_voz?: string;
      concorrentes?: string[];
      seed?: string;
    };
  }>("/", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const b = req.body ?? {};
    const type = TYPES.has(b.type || "") ? b.type! : "produto";
    const name = (b.name || b.produto || "Nova campanha").trim();
    if (!name) return reply.status(400).send({ error: "Nome da campanha é obrigatório." });

    const concorrentes = Array.isArray(b.concorrentes)
      ? b.concorrentes.map((x) => String(x).replace(/^@/, "").trim()).filter(Boolean).slice(0, 8)
      : [];

    const ins = await query<{ id: number }>(
      `INSERT INTO campaigns (
         workspace_id, type, name, nicho, produto, oferta, cta, tom_voz, concorrentes, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'draft')
       RETURNING id`,
      [
        ws.id,
        type,
        name,
        (b.nicho || "").trim(),
        (b.produto || name).trim(),
        (b.oferta || "").trim(),
        (b.cta || "").trim(),
        (b.tom_voz || "").trim(),
        JSON.stringify(concorrentes),
      ]
    );
    await query(`UPDATE workspaces SET onboarding_done = TRUE, updated_at = NOW() WHERE id = $1`, [ws.id]);

    if (b.seed === "flavio") {
      await importFlavioSeed(ins.rows[0].id);
    }

    const campaign = await getCampaign(ws.id, ins.rows[0].id);
    const identity = await getActiveIdentity(ins.rows[0].id);
    return { campaign: publicCampaign(campaign!, { identity }) };
  });

  app.get("/:id", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const id = Number((req.params as { id: string }).id);
    const campaign = await getCampaign(ws.id, id);
    if (!campaign) return reply.status(404).send({ error: "Campanha não encontrada." });
    const identity = await getActiveIdentity(id);
    const pipeline = await pipelineStatus(ws.id, id);
    return { campaign: publicCampaign(campaign, { identity, pipeline }) };
  });

  app.put<{
    Params: { id: string };
    Body: {
      type?: string;
      name?: string;
      nicho?: string;
      produto?: string;
      oferta?: string;
      cta?: string;
      tom_voz?: string;
      concorrentes?: string[];
      status?: string;
    };
  }>("/:id", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const id = Number(req.params.id);
    const campaign = await getCampaign(ws.id, id);
    if (!campaign) return reply.status(404).send({ error: "Campanha não encontrada." });
    const b = req.body ?? {};
    const concorrentes =
      b.concorrentes !== undefined
        ? b.concorrentes.map((x) => String(x).replace(/^@/, "").trim()).filter(Boolean).slice(0, 8)
        : campaign.concorrentes;
    const type = b.type && TYPES.has(b.type) ? b.type : campaign.type;
    const status = b.status && ["draft", "active", "archived"].includes(b.status) ? b.status : campaign.status;

    await query(
      `UPDATE campaigns SET
         type = $3, name = COALESCE(NULLIF($4,''), name),
         nicho = COALESCE($5, nicho), produto = COALESCE($6, produto),
         oferta = COALESCE($7, oferta), cta = COALESCE($8, cta), tom_voz = COALESCE($9, tom_voz),
         concorrentes = $10::jsonb, status = $11, updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2`,
      [
        id,
        ws.id,
        type,
        b.name ?? null,
        b.nicho ?? null,
        b.produto ?? null,
        b.oferta ?? null,
        b.cta ?? null,
        b.tom_voz ?? null,
        JSON.stringify(concorrentes),
        status,
      ]
    );
    const fresh = await getCampaign(ws.id, id);
    const identity = await getActiveIdentity(id);
    return { campaign: publicCampaign(fresh!, { identity }) };
  });

  app.get("/:id/identity", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const id = Number((req.params as { id: string }).id);
    const campaign = await getCampaign(ws.id, id);
    if (!campaign) return reply.status(404).send({ error: "Campanha não encontrada." });
    const versions = await query(
      `SELECT id, version, source, status, confidence, created_at,
              LEFT(css, 80) AS css_preview,
              model
       FROM identity_versions WHERE campaign_id = $1 ORDER BY version DESC LIMIT 20`,
      [id]
    );
    const active = await getActiveIdentity(id);
    return { versions: versions.rows, active };
  });

  app.post<{
    Params: { id: string };
    Body: { model?: IdentityModel; css?: string; source?: string; seed?: string };
  }>("/:id/identity/import", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const id = Number(req.params.id);
    const campaign = await getCampaign(ws.id, id);
    if (!campaign) return reply.status(404).send({ error: "Campanha não encontrada." });

    let model = req.body?.model;
    let css = req.body?.css || "";
    if (req.body?.seed === "flavio") {
      const seeded = loadFlavioSeed();
      model = seeded.model;
      css = css || seeded.css;
    }
    if (!model || typeof model !== "object") {
      return reply.status(400).send({ error: "Envie o JSON do modelo de identidade." });
    }

    const identity = await saveActiveIdentity(id, model, css, req.body?.source || "import");
    await query(`UPDATE campaigns SET status = 'active', updated_at = NOW() WHERE id = $1`, [id]);
    return { identity };
  });
};

async function pipelineStatus(workspaceId: number, campaignId: number) {
  const identity = await getActiveIdentity(campaignId);
  const research = await query(
    `SELECT id, status, created_at FROM research_runs
     WHERE campaign_id = $1 AND workspace_id = $2 ORDER BY id DESC LIMIT 1`,
    [campaignId, workspaceId]
  );
  const strategy = await query(
    `SELECT id, created_at FROM strategies
     WHERE campaign_id = $1 AND workspace_id = $2 ORDER BY id DESC LIMIT 1`,
    [campaignId, workspaceId]
  );
  const landing = await query(
    `SELECT id, created_at FROM landings
     WHERE campaign_id = $1 AND workspace_id = $2 ORDER BY id DESC LIMIT 1`,
    [campaignId, workspaceId]
  );
  const creatives = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM creatives WHERE campaign_id = $1 AND workspace_id = $2`,
    [campaignId, workspaceId]
  );
  return {
    briefing: true,
    identity: Boolean(identity),
    research: research.rows[0]?.status === "done",
    strategy: Boolean(strategy.rows[0]),
    landing: Boolean(landing.rows[0]),
    creatives: Number(creatives.rows[0]?.n || 0) > 0,
    research_id: research.rows[0]?.id ?? null,
    strategy_id: strategy.rows[0]?.id ?? null,
  };
}

function loadFlavioSeed(): { model: IdentityModel; css: string } {
  const p = seedPaths();
  const model = JSON.parse(fs.readFileSync(p.json, "utf8")) as IdentityModel;
  const css = fs.readFileSync(p.css, "utf8");
  return { model, css };
}

async function importFlavioSeed(campaignId: number) {
  const { model, css } = loadFlavioSeed();
  await saveActiveIdentity(campaignId, model, css, "import");
  await query(
    `UPDATE campaigns SET
       type = 'candidato',
       name = 'Flávio Bolsonaro 22',
       nicho = 'campanha política — identidade visual oficial',
       produto = 'Campanha Flávio Bolsonaro 22',
       oferta = 'Presença digital alinhada ao brandbook oficial',
       cta = 'Saiba mais',
       tom_voz = 'direto, popular, energético, confiante',
       status = 'active',
       updated_at = NOW()
     WHERE id = $1`,
    [campaignId]
  );
}

async function saveActiveIdentity(
  campaignId: number,
  model: IdentityModel,
  css: string,
  source: string
) {
  await query(`UPDATE identity_versions SET status = 'draft' WHERE campaign_id = $1 AND status = 'active'`, [
    campaignId,
  ]);
  const ver = await query<{ n: string }>(
    `SELECT COALESCE(MAX(version), 0)::text AS n FROM identity_versions WHERE campaign_id = $1`,
    [campaignId]
  );
  const version = Number(ver.rows[0]?.n || 0) + 1;
  const confidence = String(
    (model as { overall_confidence?: string }).overall_confidence || ""
  );
  const ins = await query(
    `INSERT INTO identity_versions (campaign_id, version, source, model, css, status, confidence)
     VALUES ($1,$2,$3,$4::jsonb,$5,'active',$6)
     RETURNING id, campaign_id, version, source, model, css, status, confidence`,
    [campaignId, version, source, JSON.stringify(model), css, confidence]
  );
  return ins.rows[0];
}
