import type { FastifyPluginAsync } from "fastify";
import { query } from "../db/index.js";
import { getUserId, getWorkspaceForUser, requireAuth } from "../services/authHelpers.js";
import { gerarImagemViral } from "../services/imageGen.js";
import { publishImage } from "../services/instagram.js";
import type { StrategyPlan, CreativeBrief } from "../services/strategy.js";

export const creativesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const r = await query(
      `SELECT id, strategy_id, day_index, format, hook, caption, visual_prompt,
              media_url, status, scheduled_at, published_at, ig_media_id, error, created_at
       FROM creatives WHERE workspace_id = $1
       ORDER BY strategy_id DESC NULLS LAST, day_index ASC, id ASC
       LIMIT 100`,
      [ws.id]
    );
    return { creatives: r.rows };
  });

  app.post<{ Body: { strategy_id?: number } }>("/batch", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });

    let strategyId = req.body?.strategy_id;
    let plan: StrategyPlan | null = null;

    if (strategyId) {
      const s = await query<{ id: number; plan: StrategyPlan }>(
        `SELECT id, plan FROM strategies WHERE id = $1 AND workspace_id = $2`,
        [strategyId, ws.id]
      );
      if (!s.rows[0]) return reply.status(404).send({ error: "Estratégia não encontrada." });
      plan = s.rows[0].plan;
    } else {
      const s = await query<{ id: number; plan: StrategyPlan }>(
        `SELECT id, plan FROM strategies WHERE workspace_id = $1 ORDER BY id DESC LIMIT 1`,
        [ws.id]
      );
      if (!s.rows[0]) {
        return reply.status(400).send({ error: "Gere uma estratégia antes dos criativos." });
      }
      strategyId = s.rows[0].id;
      plan = s.rows[0].plan;
    }

    const posts = (plan?.posts ?? []) as CreativeBrief[];
    if (!posts.length) return reply.status(400).send({ error: "Plano sem posts." });

    // Remove lote anterior (não publicados) para não acumular / confundir
    await query(
      `DELETE FROM creatives
       WHERE workspace_id = $1
         AND status IN ('draft', 'ready', 'error', 'approved', 'generating')`,
      [ws.id]
    );

    const created: unknown[] = [];
    const errors: Array<{ day: number; error: string }> = [];

    for (const post of posts) {
      const caption = [post.caption, post.cta].filter(Boolean).join("\n\n").trim();
      const visual =
        post.visual_prompt ||
        `Viral Instagram creative about ${ws.produto}. Hook text: "${post.hook}". Niche: ${ws.nicho}.`;

      let mediaUrl = "";
      let status = "ready";
      let error: string | null = null;
      try {
        mediaUrl = await gerarImagemViral(visual);
      } catch (err) {
        status = "error";
        error = err instanceof Error ? err.message : String(err);
        errors.push({ day: post.day, error: error });
      }

      const ins = await query(
        `INSERT INTO creatives (
           workspace_id, strategy_id, day_index, format, hook, caption,
           visual_prompt, media_url, status, error
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, strategy_id, day_index, format, hook, caption, visual_prompt,
                   media_url, status, error, created_at`,
        [
          ws.id,
          strategyId,
          post.day,
          post.formato || "feed",
          post.hook || "",
          caption,
          visual,
          mediaUrl,
          status === "error" ? "error" : "ready",
          error,
        ]
      );
      created.push(ins.rows[0]);
    }

    return { creatives: created, errors, strategy_id: strategyId };
  });

  app.post("/clear", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const r = await query(
      `DELETE FROM creatives
       WHERE workspace_id = $1
         AND status NOT IN ('published', 'scheduled')
       RETURNING id`,
      [ws.id]
    );
    return { deleted: r.rows.length };
  });

  app.patch<{
    Params: { id: string };
    Body: { caption?: string; hook?: string; status?: string };
  }>("/:id", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const r = await query(
      `UPDATE creatives SET
         caption = COALESCE($3, caption),
         hook = COALESCE($4, hook),
         status = COALESCE($5, status),
         updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2
       RETURNING id, strategy_id, day_index, format, hook, caption, visual_prompt,
                 media_url, status, scheduled_at, published_at, error`,
      [id, ws.id, b.caption ?? null, b.hook ?? null, b.status ?? null]
    );
    if (!r.rows[0]) return reply.status(404).send({ error: "Criativo não encontrado." });
    return { creative: r.rows[0] };
  });

  app.post<{ Params: { id: string } }>("/:id/regenerate", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const id = Number(req.params.id);
    const cur = await query<{ id: number; visual_prompt: string }>(
      `SELECT id, visual_prompt FROM creatives WHERE id = $1 AND workspace_id = $2`,
      [id, ws.id]
    );
    if (!cur.rows[0]) return reply.status(404).send({ error: "Criativo não encontrado." });

    await query(
      `UPDATE creatives SET status = 'generating', error = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    try {
      const mediaUrl = await gerarImagemViral(cur.rows[0].visual_prompt);
      const r = await query(
        `UPDATE creatives SET media_url = $2, status = 'ready', error = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING id, day_index, format, hook, caption, visual_prompt, media_url, status`,
        [id, mediaUrl]
      );
      return { creative: r.rows[0] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await query(`UPDATE creatives SET status = 'error', error = $2, updated_at = NOW() WHERE id = $1`, [
        id,
        msg,
      ]);
      return reply.status(500).send({ error: msg });
    }
  });

  app.post<{ Params: { id: string } }>("/:id/publish", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    if (!ws.ig_user_id || !ws.ig_access_token) {
      return reply.status(400).send({ error: "Configure ig_user_id e token no onboarding." });
    }
    const id = Number(req.params.id);
    const cur = await query<{ id: number; media_url: string; caption: string }>(
      `SELECT id, media_url, caption FROM creatives WHERE id = $1 AND workspace_id = $2`,
      [id, ws.id]
    );
    if (!cur.rows[0]?.media_url) {
      return reply.status(400).send({ error: "Criativo sem mídia." });
    }

    try {
      const mediaId = await publishImage({
        igUserId: ws.ig_user_id,
        accessToken: ws.ig_access_token,
        imageUrl: cur.rows[0].media_url,
        caption: cur.rows[0].caption,
      });
      const r = await query(
        `UPDATE creatives SET status = 'published', published_at = NOW(), ig_media_id = $2, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id, mediaId]
      );
      return { creative: r.rows[0] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await query(`UPDATE creatives SET status = 'error', error = $2, updated_at = NOW() WHERE id = $1`, [
        id,
        msg,
      ]);
      return reply.status(500).send({ error: msg });
    }
  });

  app.post<{ Params: { id: string }; Body: { scheduled_at?: string } }>(
    "/:id/schedule",
    async (req, reply) => {
      const ws = await getWorkspaceForUser(getUserId(req));
      if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
      const id = Number(req.params.id);
      const when = req.body?.scheduled_at;
      if (!when) return reply.status(400).send({ error: "scheduled_at obrigatório (ISO)." });

      const r = await query(
        `UPDATE creatives SET status = 'scheduled', scheduled_at = $3::timestamptz, updated_at = NOW()
         WHERE id = $1 AND workspace_id = $2 AND media_url <> ''
         RETURNING id, status, scheduled_at, media_url, caption`,
        [id, ws.id, when]
      );
      if (!r.rows[0]) {
        return reply.status(400).send({ error: "Criativo não encontrado ou sem mídia." });
      }
      return { creative: r.rows[0] };
    }
  );

  app.post("/approve-all-ready", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const r = await query(
      `UPDATE creatives SET status = 'approved', updated_at = NOW()
       WHERE workspace_id = $1 AND status = 'ready'
       RETURNING id`,
      [ws.id]
    );
    return { approved: r.rows.length };
  });
};
