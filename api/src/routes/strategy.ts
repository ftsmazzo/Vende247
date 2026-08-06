import type { FastifyPluginAsync } from "fastify";
import { query } from "../db/index.js";
import { getUserId, getWorkspaceForUser, requireAuth } from "../services/authHelpers.js";
import { generateStrategy } from "../services/strategy.js";
import type { ResearchReport } from "../services/research.js";

export const strategyRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/latest", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const r = await query(
      `SELECT id, research_id, days, plan, created_at
       FROM strategies WHERE workspace_id = $1
       ORDER BY id DESC LIMIT 1`,
      [ws.id]
    );
    return { strategy: r.rows[0] ?? null };
  });

  app.post<{ Body: { research_id?: number; days?: number } }>("/generate", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });

    let researchId = req.body?.research_id;
    let report: ResearchReport | null = null;

    if (researchId) {
      const r = await query<{ id: number; report: ResearchReport; status: string }>(
        `SELECT id, report, status FROM research_runs WHERE id = $1 AND workspace_id = $2`,
        [researchId, ws.id]
      );
      if (!r.rows[0] || r.rows[0].status !== "done") {
        return reply.status(400).send({ error: "Research inválido ou incompleto." });
      }
      report = r.rows[0].report;
    } else {
      const r = await query<{ id: number; report: ResearchReport }>(
        `SELECT id, report FROM research_runs WHERE workspace_id = $1 AND status = 'done'
         ORDER BY id DESC LIMIT 1`,
        [ws.id]
      );
      if (!r.rows[0]) {
        return reply.status(400).send({ error: "Rode um research antes de gerar a estratégia." });
      }
      researchId = r.rows[0].id;
      report = r.rows[0].report;
    }

    const days = Number(req.body?.days ?? 7);
    const plan = await generateStrategy(
      {
        nicho: ws.nicho,
        produto: ws.produto,
        oferta: ws.oferta,
        cta: ws.cta,
        tom_voz: ws.tom_voz,
        concorrentes: ws.concorrentes,
        ig_username: ws.ig_username,
      },
      report!,
      days
    );

    const inserted = await query<{ id: number }>(
      `INSERT INTO strategies (workspace_id, research_id, days, plan)
       VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
      [ws.id, researchId, plan.dias, JSON.stringify(plan)]
    );

    return { strategy: { id: inserted.rows[0].id, research_id: researchId, days: plan.dias, plan } };
  });
};
