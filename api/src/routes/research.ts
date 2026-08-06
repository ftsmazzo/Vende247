import type { FastifyPluginAsync } from "fastify";
import { query } from "../db/index.js";
import { getUserId, getWorkspaceForUser, requireAuth } from "../services/authHelpers.js";
import { runResearchPipeline } from "../services/research.js";

export const researchRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/latest", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const r = await query(
      `SELECT id, status, report, error, created_at, finished_at
       FROM research_runs WHERE workspace_id = $1
       ORDER BY id DESC LIMIT 1`,
      [ws.id]
    );
    return { run: r.rows[0] ?? null };
  });

  app.get("/:id", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const id = Number((req.params as { id: string }).id);
    const r = await query(
      `SELECT id, status, report, raw_data, error, created_at, finished_at
       FROM research_runs WHERE id = $1 AND workspace_id = $2`,
      [id, ws.id]
    );
    if (!r.rows[0]) return reply.status(404).send({ error: "Research não encontrado." });
    return { run: r.rows[0] };
  });

  app.post("/run", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    if (!ws.onboarding_done) {
      return reply.status(400).send({ error: "Conclua o onboarding antes do research." });
    }

    const inserted = await query<{ id: number }>(
      `INSERT INTO research_runs (workspace_id, status) VALUES ($1, 'running') RETURNING id`,
      [ws.id]
    );
    const runId = inserted.rows[0].id;

    try {
      const { raw, report } = await runResearchPipeline({
        nicho: ws.nicho,
        produto: ws.produto,
        oferta: ws.oferta,
        cta: ws.cta,
        tom_voz: ws.tom_voz,
        concorrentes: ws.concorrentes,
        ig_username: ws.ig_username,
      });

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
