import type { FastifyPluginAsync } from "fastify";
import { query } from "../db/index.js";
import { getUserId, requireAuth } from "../services/authHelpers.js";
import { campaignCtx, resolveCampaignScope } from "../services/campaignHelpers.js";
import { runResearchPipeline } from "../services/research.js";

export const researchRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/latest", async (req, reply) => {
    const scope = await resolveCampaignScope(getUserId(req), req);
    if ("error" in scope) return reply.status(scope.status).send({ error: scope.error });
    const r = await query(
      `SELECT id, status, report, error, created_at, finished_at
       FROM research_runs WHERE workspace_id = $1 AND campaign_id = $2
       ORDER BY id DESC LIMIT 1`,
      [scope.workspace.id, scope.campaign.id]
    );
    return { run: r.rows[0] ?? null };
  });

  app.get("/:id", async (req, reply) => {
    const scope = await resolveCampaignScope(getUserId(req), req);
    if ("error" in scope) return reply.status(scope.status).send({ error: scope.error });
    const id = Number((req.params as { id: string }).id);
    const r = await query(
      `SELECT id, status, report, raw_data, error, created_at, finished_at
       FROM research_runs WHERE id = $1 AND workspace_id = $2 AND campaign_id = $3`,
      [id, scope.workspace.id, scope.campaign.id]
    );
    if (!r.rows[0]) return reply.status(404).send({ error: "Research não encontrado." });
    return { run: r.rows[0] };
  });

  app.post("/run", async (req, reply) => {
    const scope = await resolveCampaignScope(getUserId(req), req);
    if ("error" in scope) return reply.status(scope.status).send({ error: scope.error });

    const inserted = await query<{ id: number }>(
      `INSERT INTO research_runs (workspace_id, campaign_id, status) VALUES ($1, $2, 'running') RETURNING id`,
      [scope.workspace.id, scope.campaign.id]
    );
    const runId = inserted.rows[0].id;
    const ctx = campaignCtx(scope.campaign, scope.workspace.ig_username);

    try {
      const { raw, report } = await runResearchPipeline(ctx);

      await query(
        `UPDATE research_runs SET status = 'done', raw_data = $2::jsonb, report = $3::jsonb,
         finished_at = NOW() WHERE id = $1`,
        [runId, JSON.stringify(raw), JSON.stringify(report)]
      );

      return { run: { id: runId, status: "done", report } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await query(
        `UPDATE research_runs SET status = 'error', error = $2, finished_at = NOW() WHERE id = $1`,
        [runId, msg]
      );
      return reply.status(500).send({ error: msg, runId });
    }
  });
};
