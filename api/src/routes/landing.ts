import type { FastifyPluginAsync } from "fastify";
import { query } from "../db/index.js";
import { getUserId, getWorkspaceForUser, requireAuth } from "../services/authHelpers.js";
import type { BrandKit } from "../services/brandFromUrl.js";
import { generateLanding } from "../services/landingGen.js";
import type { ResearchReport } from "../services/research.js";

export const landingRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/latest", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const r = await query<{
      id: number;
      html: string;
      meta: Record<string, unknown>;
      created_at: string;
    }>(
      `SELECT id, html, meta, created_at FROM landings
       WHERE workspace_id = $1 ORDER BY id DESC LIMIT 1`,
      [ws.id]
    );
    return { landing: r.rows[0] ?? null };
  });

  app.post<{ Body: { with_hero_image?: boolean } }>("/generate", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    if (!ws.produto?.trim() && !ws.nicho?.trim()) {
      return reply.status(400).send({ error: "Complete o onboarding (produto/nicho) antes." });
    }

    const research = await query<{ report: ResearchReport }>(
      `SELECT report FROM research_runs
       WHERE workspace_id = $1 AND status = 'done'
       ORDER BY id DESC LIMIT 1`,
      [ws.id]
    );

    try {
      const result = await generateLanding({
        ctx: {
          nicho: ws.nicho,
          produto: ws.produto,
          oferta: ws.oferta,
          cta: ws.cta,
          tom_voz: ws.tom_voz,
          concorrentes: ws.concorrentes || [],
          ig_username: ws.ig_username,
        },
        report: research.rows[0]?.report ?? null,
        brand: (ws.brand_kit || {}) as BrandKit,
        withHeroImage: req.body?.with_hero_image !== false,
      });

      const ins = await query<{
        id: number;
        html: string;
        meta: Record<string, unknown>;
        created_at: string;
      }>(
        `INSERT INTO landings (workspace_id, html, meta)
         VALUES ($1, $2, $3::jsonb)
         RETURNING id, html, meta, created_at`,
        [ws.id, result.html, JSON.stringify(result.meta)]
      );
      return { landing: ins.rows[0] };
    } catch (err) {
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
};
