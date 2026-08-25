import type { FastifyPluginAsync } from "fastify";
import { query } from "../db/index.js";
import { getUserId, requireAuth } from "../services/authHelpers.js";
import { campaignCtx, resolveCampaignScope } from "../services/campaignHelpers.js";
import type { ResearchReport } from "../services/research.js";
import { generateStrategy } from "../services/strategy.js";

export const strategyRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/latest", async (req, reply) => {
    const scope = await resolveCampaignScope(getUserId(req), req);
    if ("error" in scope) return reply.status(scope.status).send({ error: scope.error });
    const r = await query(
      `SELECT id, research_id, days, plan, created_at
       FROM strategies WHERE workspace_id = $1 AND campaign_id = $2
       ORDER BY id DESC LIMIT 1`,
      [scope.workspace.id, scope.campaign.id]
    );
    return { strategy: r.rows[0] ?? null };
  });

  app.post<{ Body: { research_id?: number; days?: number } }>("/generate", async (req, reply) => {
    const scope = await resolveCampaignScope(getUserId(req), req);
    if ("error" in scope) return reply.status(scope.status).send({ error: scope.error });

    let researchId = req.body?.research_id;
    let report: ResearchReport | null = null;

    if (researchId) {
      const r = await query<{ id: number; report: ResearchReport; status: string }>(
        `SELECT id, report, status FROM research_runs
         WHERE id = $1 AND workspace_id = $2 AND campaign_id = $3`,
        [researchId, scope.workspace.id, scope.campaign.id]
      );
      if (!r.rows[0] || r.rows[0].status !== "done") {
        return reply.status(400).send({ error: "Research inválido ou incompleto." });
      }
      report = r.rows[0].report;
    } else {
      const r = await query<{ id: number; report: ResearchReport }>(
        `SELECT id, report FROM research_runs
         WHERE workspace_id = $1 AND campaign_id = $2 AND status = 'done'
         ORDER BY id DESC LIMIT 1`,
        [scope.workspace.id, scope.campaign.id]
      );
      if (!r.rows[0]) {
        return reply.status(400).send({ error: "Rode um research antes de gerar a estratégia." });
      }
      researchId = r.rows[0].id;
      report = r.rows[0].report;
    }

    const days = Number(req.body?.days ?? 7);
    const plan = await generateStrategy(
      campaignCtx(scope.campaign, scope.workspace.ig_username),
      report!,
      days,
      {}
    );

    const inserted = await query<{ id: number }>(
      `INSERT INTO strategies (workspace_id, campaign_id, research_id, days, plan)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
      [scope.workspace.id, scope.campaign.id, researchId, plan.dias, JSON.stringify(plan)]
    );

    return { strategy: { id: inserted.rows[0].id, research_id: researchId, days: plan.dias, plan } };
  });
};
