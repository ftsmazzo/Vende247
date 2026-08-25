import type { FastifyPluginAsync } from "fastify";
import { query } from "../db/index.js";
import { getUserId, requireAuth } from "../services/authHelpers.js";
import { campaignCtx, resolveCampaignScope } from "../services/campaignHelpers.js";
import { generateLanding } from "../services/landingGen.js";
import type { ResearchReport } from "../services/research.js";
import type { StrategyPlan } from "../services/strategy.js";

export const landingRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/latest", async (req, reply) => {
    const scope = await resolveCampaignScope(getUserId(req), req);
    if ("error" in scope) return reply.status(scope.status).send({ error: scope.error });
    const r = await query<{
      id: number;
      html: string;
      meta: Record<string, unknown>;
      created_at: string;
    }>(
      `SELECT id, html, meta, created_at FROM landings
       WHERE workspace_id = $1 AND campaign_id = $2 ORDER BY id DESC LIMIT 1`,
      [scope.workspace.id, scope.campaign.id]
    );
    return { landing: r.rows[0] ?? null };
  });

  app.post<{ Body: { with_hero_image?: boolean } }>("/generate", async (req, reply) => {
    const scope = await resolveCampaignScope(getUserId(req), req);
    if ("error" in scope) return reply.status(scope.status).send({ error: scope.error });
    if (!scope.identity) {
      return reply.status(400).send({
        error: "Gere ou importe a identidade da campanha (depois de research e estratégia) antes da landing.",
      });
    }

    const research = await query<{ report: ResearchReport }>(
      `SELECT report FROM research_runs
       WHERE workspace_id = $1 AND campaign_id = $2 AND status = 'done'
       ORDER BY id DESC LIMIT 1`,
      [scope.workspace.id, scope.campaign.id]
    );
    const strategy = await query<{ plan: StrategyPlan }>(
      `SELECT plan FROM strategies WHERE workspace_id = $1 AND campaign_id = $2 ORDER BY id DESC LIMIT 1`,
      [scope.workspace.id, scope.campaign.id]
    );

    try {
      const result = await generateLanding({
        ctx: campaignCtx(scope.campaign, scope.workspace.ig_username),
        report: research.rows[0]?.report ?? null,
        strategy: strategy.rows[0]?.plan ?? null,
        brand: scope.brand,
        identityModel: scope.identity?.model,
        identityCss: scope.identity?.css || "",
        withHeroImage: req.body?.with_hero_image !== false,
      });

      const ins = await query<{
        id: number;
        html: string;
        meta: Record<string, unknown>;
        created_at: string;
      }>(
        `INSERT INTO landings (workspace_id, campaign_id, html, meta)
         VALUES ($1, $2, $3, $4::jsonb)
         RETURNING id, html, meta, created_at`,
        [scope.workspace.id, scope.campaign.id, result.html, JSON.stringify(result.meta)]
      );
      return { landing: ins.rows[0] };
    } catch (err) {
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
};
