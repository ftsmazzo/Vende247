import type { FastifyRequest } from "fastify";
import { query } from "../db/index.js";
import { getWorkspaceForUser } from "./authHelpers.js";
import type { BrandKit } from "./brandFromUrl.js";
import { identityToBrandKit, type IdentityModel, type IdentityVersion } from "./identityContract.js";

export type Campaign = {
  id: number;
  workspace_id: number;
  type: string;
  name: string;
  nicho: string;
  produto: string;
  oferta: string;
  cta: string;
  tom_voz: string;
  concorrentes: string[];
  status: string;
  ig_user_id: string;
  ig_username: string;
};

export type CampaignScope = {
  workspace: NonNullable<Awaited<ReturnType<typeof getWorkspaceForUser>>>;
  campaign: Campaign;
  identity: IdentityVersion | null;
  brand: BrandKit;
};

export function campaignIdFromReq(req: FastifyRequest): number | null {
  const q = (req.query as { campaign_id?: string | number })?.campaign_id;
  const b = (req.body as { campaign_id?: string | number } | null)?.campaign_id;
  const h = req.headers["x-campaign-id"];
  const raw = q ?? b ?? (Array.isArray(h) ? h[0] : h);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const CAMPAIGN_COLS = `id, workspace_id, type, name, nicho, produto, oferta, cta, tom_voz,
  COALESCE(concorrentes, '[]'::jsonb) AS concorrentes, status,
  COALESCE(ig_user_id, '') AS ig_user_id,
  COALESCE(ig_username, '') AS ig_username`;

export async function getCampaign(workspaceId: number, campaignId: number): Promise<Campaign | null> {
  const r = await query<Campaign>(
    `SELECT ${CAMPAIGN_COLS} FROM campaigns WHERE id = $1 AND workspace_id = $2`,
    [campaignId, workspaceId]
  );
  return r.rows[0] ?? null;
}

export async function listCampaigns(workspaceId: number): Promise<Campaign[]> {
  const r = await query<Campaign>(
    `SELECT ${CAMPAIGN_COLS} FROM campaigns WHERE workspace_id = $1 ORDER BY updated_at DESC, id DESC`,
    [workspaceId]
  );
  return r.rows;
}

export async function getActiveIdentity(campaignId: number): Promise<IdentityVersion | null> {
  const r = await query<IdentityVersion>(
    `SELECT id, campaign_id, version, source, model, css, status, COALESCE(confidence,'') AS confidence
     FROM identity_versions
     WHERE campaign_id = $1 AND status = 'active'
     ORDER BY version DESC LIMIT 1`,
    [campaignId]
  );
  return r.rows[0] ?? null;
}

export async function resolveCampaignScope(
  userId: number,
  req: FastifyRequest
): Promise<CampaignScope | { error: string; status: number }> {
  const ws = await getWorkspaceForUser(userId);
  if (!ws) return { error: "Workspace não encontrado.", status: 404 };

  let campaignId = campaignIdFromReq(req);
  if (!campaignId) {
    const latest = await query<{ id: number }>(
      `SELECT id FROM campaigns WHERE workspace_id = $1 ORDER BY updated_at DESC, id DESC LIMIT 1`,
      [ws.id]
    );
    campaignId = latest.rows[0]?.id ?? null;
  }
  if (!campaignId) return { error: "Crie uma campanha primeiro.", status: 400 };

  const campaign = await getCampaign(ws.id, campaignId);
  if (!campaign) return { error: "Campanha não encontrada.", status: 404 };

  const identity = await getActiveIdentity(campaign.id);
  const brand = identity
    ? identityToBrandKit(identity.model as IdentityModel)
    : ((ws.brand_kit || {}) as BrandKit);

  return { workspace: ws, campaign, identity, brand };
}

export function campaignCtx(campaign: Campaign, workspaceIg?: string) {
  return {
    type: campaign.type,
    name: campaign.name,
    nicho: campaign.nicho,
    produto: campaign.produto || campaign.name,
    oferta: campaign.oferta,
    cta: campaign.cta,
    tom_voz: campaign.tom_voz,
    concorrentes: campaign.concorrentes || [],
    ig_username: campaign.ig_username || workspaceIg || "",
  };
}

export function publicCampaign(
  c: Campaign,
  extras?: { identity?: IdentityVersion | null; pipeline?: Record<string, unknown> }
) {
  return {
    ...c,
    has_active_identity: Boolean(extras?.identity),
    identity: extras?.identity
      ? {
          id: extras.identity.id,
          version: extras.identity.version,
          source: extras.identity.source,
          status: extras.identity.status,
          confidence: extras.identity.confidence,
          summary:
            (extras.identity.model as { identity_signature?: { summary?: string } })
              ?.identity_signature?.summary || "",
        }
      : null,
    pipeline: extras?.pipeline,
  };
}
