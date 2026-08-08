import type { FastifyPluginAsync } from "fastify";
import { query } from "../db/index.js";
import { getUserId, getWorkspaceForUser, requireAuth } from "../services/authHelpers.js";
import type { BrandKit } from "../services/brandFromUrl.js";
import { gerarImagemViral, gerarImagemComModelo, openRouterCompareModels } from "../services/imageGen.js";
import { publishCarousel, publishImage } from "../services/instagram.js";
import { filterResearchCues, lockVisualToNiche } from "../services/nicheVisual.js";
import type { ResearchReport } from "../services/research.js";
import {
  normalizeCarouselSlides,
  type CreativeBrief,
  type StrategyPlan,
} from "../services/strategy.js";

async function latestResearchCues(
  workspaceId: number,
  nicho: string,
  produto: string
): Promise<string[]> {
  const r = await query<{ report: ResearchReport }>(
    `SELECT report FROM research_runs
     WHERE workspace_id = $1 AND status = 'done'
     ORDER BY id DESC LIMIT 1`,
    [workspaceId]
  );
  const d = r.rows[0]?.report?.direcao_visual;
  const raw = Array.isArray(d) ? d.filter((x): x is string => typeof x === "string" && !!x) : [];
  return filterResearchCues(raw, { nicho, produto });
}

function nicheFromWs(ws: { nicho: string; produto: string; oferta: string }) {
  return { nicho: ws.nicho, produto: ws.produto, oferta: ws.oferta };
}

const CREATIVE_COLS = `id, strategy_id, day_index, format, hook, caption, visual_prompt,
              media_url, COALESCE(media_urls, '[]'::jsonb) AS media_urls,
              status, scheduled_at, published_at, ig_media_id, error, created_at`;

function asUrlList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === "string" && !!u);
  return [];
}

export const creativesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const r = await query(
      `SELECT ${CREATIVE_COLS}
       FROM creatives WHERE workspace_id = $1
       ORDER BY strategy_id DESC NULLS LAST, day_index ASC, id ASC
       LIMIT 100`,
      [ws.id]
    );
    return { creatives: r.rows };
  });

  /**
   * A/B de modelos OpenRouter com o mesmo prompt (custo baixo: 3–4 imgs).
   * Body: { prompt?, models?, hook? } — se omitir prompt, usa 1º post da estratégia.
   */
  app.post<{
    Body: { prompt?: string; models?: string[]; hook?: string; overlay_logo?: boolean };
  }>("/compare-models", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });

    const brand = (ws.brand_kit || {}) as BrandKit;
    const niche = nicheFromWs(ws);
    let prompt = (req.body?.prompt || "").trim();
    let hook = (req.body?.hook || "").trim();

    if (!prompt) {
      const s = await query<{ plan: StrategyPlan }>(
        `SELECT plan FROM strategies WHERE workspace_id = $1 ORDER BY id DESC LIMIT 1`,
        [ws.id]
      );
      const post = (s.rows[0]?.plan?.posts?.[0] || null) as CreativeBrief | null;
      if (!post?.visual_prompt) {
        return reply.status(400).send({
          error: "Informe prompt ou gere uma estratégia antes do teste.",
        });
      }
      prompt = lockVisualToNiche(post.visual_prompt, niche, brand, post.hook);
      hook = hook || post.hook || "";
    } else {
      prompt = lockVisualToNiche(prompt, niche, brand, hook);
    }

    const models = (req.body?.models?.length
      ? req.body.models
      : openRouterCompareModels()
    ).slice(0, 4);

    const results: Array<{ model: string; url?: string; error?: string; ms: number }> = [];
    for (const model of models) {
      const t0 = Date.now();
      try {
        const r = await gerarImagemComModelo(prompt, model, brand, {
          purpose: "cover",
          mode: "ad",
          aspectRatio: "4:5",
          overlayLogo: req.body?.overlay_logo ?? false,
          niche,
          hook,
          diversityIndex: 0,
        });
        results.push({ model: r.model, url: r.url, ms: Date.now() - t0 });
      } catch (err) {
        results.push({
          model,
          error: err instanceof Error ? err.message : String(err),
          ms: Date.now() - t0,
        });
      }
    }

    return {
      prompt_preview: prompt.slice(0, 280),
      results,
      hint: "Escolha o melhor e set OR_MODEL_COVER / OR_MODEL_VOLUME no EasyPanel.",
    };
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

    await query(
      `DELETE FROM creatives
       WHERE workspace_id = $1
         AND status IN ('draft', 'ready', 'error', 'approved', 'generating')`,
      [ws.id]
    );

    const brand = (ws.brand_kit || {}) as BrandKit;
    const niche = nicheFromWs(ws);
    const researchCues = await latestResearchCues(ws.id, ws.nicho, ws.produto);
    const created: unknown[] = [];
    const errors: Array<{ day: number; error: string }> = [];

    for (const post of posts) {
      const caption = [post.caption, post.cta].filter(Boolean).join("\n\n").trim();
      const formato = post.formato || "feed";
      const visualRaw =
        post.visual_prompt ||
        `Viral Instagram creative about ${ws.produto}. Hook text: "${post.hook}". Niche: ${ws.nicho}.`;
      const visual = lockVisualToNiche(visualRaw, niche, brand, post.hook);
      const dayIdx = Math.max(0, (post.day || 1) - 1);
      const researchCue =
        researchCues[dayIdx % Math.max(researchCues.length, 1)] || undefined;

      let mediaUrl = "";
      let mediaUrls: string[] = [];
      let status = "ready";
      let error: string | null = null;

      try {
        if (formato === "carrossel") {
          const slides = normalizeCarouselSlides(
            post.slides,
            visual,
            post.hook || post.titulo,
            {
              nicho: ws.nicho,
              produto: ws.produto,
              oferta: ws.oferta,
              cta: ws.cta,
              tom_voz: ws.tom_voz,
              concorrentes: ws.concorrentes || [],
              ig_username: ws.ig_username,
            },
            brand,
            (post.cena_tipo as CreativeBrief["cena_tipo"]) || "hero_pessoa"
          );
          for (let i = 0; i < slides.length; i++) {
            const slidePrompt = lockVisualToNiche(
              slides[i].visual_prompt,
              niche,
              brand,
              slides[i].texto || post.hook
            );
            const url = await gerarImagemViral(slidePrompt, brand, {
              purpose: i === 0 ? "cover" : "volume",
              mode: "ad",
              diversityIndex: dayIdx * 5 + i,
              researchCue:
                researchCues[(dayIdx + i) % Math.max(researchCues.length, 1)] ||
                researchCue,
              niche,
              hook: slides[i].texto || post.hook,
            });
            mediaUrls.push(url);
          }
          mediaUrl = mediaUrls[0] || "";
        } else {
          mediaUrl = await gerarImagemViral(visual, brand, {
            purpose: "cover",
            mode: "ad",
            aspectRatio: formato === "reels" ? "9:16" : "4:5",
            diversityIndex: dayIdx,
            researchCue,
            niche,
            hook: post.hook,
          });
          mediaUrls = mediaUrl ? [mediaUrl] : [];
        }
      } catch (err) {
        status = "error";
        error = err instanceof Error ? err.message : String(err);
        errors.push({ day: post.day, error });
      }

      const ins = await query(
        `INSERT INTO creatives (
           workspace_id, strategy_id, day_index, format, hook, caption,
           visual_prompt, media_url, media_urls, status, error
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
         RETURNING ${CREATIVE_COLS}`,
        [
          ws.id,
          strategyId,
          post.day,
          formato,
          post.hook || "",
          caption,
          visual,
          mediaUrl,
          JSON.stringify(mediaUrls),
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
       RETURNING ${CREATIVE_COLS}`,
      [id, ws.id, b.caption ?? null, b.hook ?? null, b.status ?? null]
    );
    if (!r.rows[0]) return reply.status(404).send({ error: "Criativo não encontrado." });
    return { creative: r.rows[0] };
  });

  app.post<{ Params: { id: string } }>("/:id/regenerate", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const id = Number(req.params.id);
    const cur = await query<{
      id: number;
      visual_prompt: string;
      format: string;
      hook: string;
      media_urls: unknown;
    }>(
      `SELECT id, visual_prompt, format, hook, COALESCE(media_urls, '[]'::jsonb) AS media_urls
       FROM creatives WHERE id = $1 AND workspace_id = $2`,
      [id, ws.id]
    );
    if (!cur.rows[0]) return reply.status(404).send({ error: "Criativo não encontrado." });

    await query(
      `UPDATE creatives SET status = 'generating', error = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    try {
      const brand = (ws.brand_kit || {}) as BrandKit;
      const niche = nicheFromWs(ws);
      const row = cur.rows[0];
      const researchCues = await latestResearchCues(ws.id, ws.nicho, ws.produto);
      let mediaUrl = "";
      let mediaUrls: string[] = [];

      if (row.format === "carrossel") {
        const existing = asUrlList(row.media_urls);
        const count = Math.max(existing.length, 4);
        for (let i = 0; i < count; i++) {
          const promptRaw =
            i === 0
              ? row.visual_prompt
              : `${row.visual_prompt}. Carousel slide ${i + 1} of ${count}, different angle, bold Portuguese text related to "${row.hook}"`;
          const prompt = lockVisualToNiche(promptRaw, niche, brand, row.hook);
          mediaUrls.push(
            await gerarImagemViral(prompt, brand, {
              purpose: i === 0 ? "cover" : "volume",
              mode: "ad",
              diversityIndex: id * 3 + i + Date.now() % 7,
              researchCue: researchCues[i % Math.max(researchCues.length, 1)],
              niche,
              hook: row.hook,
            })
          );
        }
        mediaUrl = mediaUrls[0] || "";
      } else {
        mediaUrl = await gerarImagemViral(
          lockVisualToNiche(row.visual_prompt, niche, brand, row.hook),
          brand,
          {
            purpose: "cover",
            mode: "ad",
            aspectRatio: row.format === "reels" ? "9:16" : "4:5",
            diversityIndex: id + (Date.now() % 8),
            researchCue: researchCues[0],
            niche,
            hook: row.hook,
          }
        );
        mediaUrls = [mediaUrl];
      }

      const r = await query(
        `UPDATE creatives SET media_url = $2, media_urls = $3::jsonb, status = 'ready', error = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING ${CREATIVE_COLS}`,
        [id, mediaUrl, JSON.stringify(mediaUrls)]
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

  app.post<{ Params: { id: string }; Body: { slide_index?: number } }>(
    "/:id/regenerate-slide",
    async (req, reply) => {
      const ws = await getWorkspaceForUser(getUserId(req));
      if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
      const id = Number(req.params.id);
      const slideIndex = Number(req.body?.slide_index ?? 0);
      const cur = await query<{
        id: number;
        visual_prompt: string;
        format: string;
        hook: string;
        media_urls: unknown;
        media_url: string;
      }>(
        `SELECT id, visual_prompt, format, hook, media_url,
                COALESCE(media_urls, '[]'::jsonb) AS media_urls
         FROM creatives WHERE id = $1 AND workspace_id = $2`,
        [id, ws.id]
      );
      if (!cur.rows[0]) return reply.status(404).send({ error: "Criativo não encontrado." });
      const urls = asUrlList(cur.rows[0].media_urls);
      if (slideIndex < 0 || slideIndex >= Math.max(urls.length, 1)) {
        return reply.status(400).send({ error: "slide_index inválido." });
      }

      try {
        const brand = (ws.brand_kit || {}) as BrandKit;
        const niche = nicheFromWs(ws);
        const researchCues = await latestResearchCues(ws.id, ws.nicho, ws.produto);
        const prompt = lockVisualToNiche(
          `${cur.rows[0].visual_prompt}. Carousel slide ${slideIndex + 1}, bold Portuguese hook "${cur.rows[0].hook}", unique composition`,
          niche,
          brand,
          cur.rows[0].hook
        );
        const newUrl = await gerarImagemViral(prompt, brand, {
          purpose: "volume",
          mode: "ad",
          diversityIndex: id + slideIndex * 2 + (Date.now() % 8),
          researchCue: researchCues[slideIndex % Math.max(researchCues.length, 1)],
          niche,
          hook: cur.rows[0].hook,
        });
        const next = [...urls];
        if (next.length === 0) next.push(newUrl);
        else next[slideIndex] = newUrl;
        const cover = next[0] || cur.rows[0].media_url;
        const r = await query(
          `UPDATE creatives SET media_url = $2, media_urls = $3::jsonb, status = 'ready', error = NULL, updated_at = NOW()
           WHERE id = $1 RETURNING ${CREATIVE_COLS}`,
          [id, cover, JSON.stringify(next)]
        );
        return { creative: r.rows[0] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: msg });
      }
    }
  );

  app.post<{ Params: { id: string } }>("/:id/publish", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    if (!ws.ig_user_id || !ws.ig_access_token) {
      return reply.status(400).send({ error: "Configure ig_user_id e token no onboarding." });
    }
    const id = Number(req.params.id);
    const cur = await query<{
      id: number;
      media_url: string;
      media_urls: unknown;
      caption: string;
      format: string;
    }>(
      `SELECT id, media_url, caption, format, COALESCE(media_urls, '[]'::jsonb) AS media_urls
       FROM creatives WHERE id = $1 AND workspace_id = $2`,
      [id, ws.id]
    );
    if (!cur.rows[0]?.media_url) {
      return reply.status(400).send({ error: "Criativo sem mídia." });
    }

    try {
      const urls = asUrlList(cur.rows[0].media_urls);
      const isCarousel = cur.rows[0].format === "carrossel" && urls.length > 1;
      const mediaId = isCarousel
        ? await publishCarousel({
            igUserId: ws.ig_user_id,
            accessToken: ws.ig_access_token,
            imageUrls: urls,
            caption: cur.rows[0].caption,
          })
        : await publishImage({
            igUserId: ws.ig_user_id,
            accessToken: ws.ig_access_token,
            imageUrl: cur.rows[0].media_url,
            caption: cur.rows[0].caption,
          });
      const r = await query(
        `UPDATE creatives SET status = 'published', published_at = NOW(), ig_media_id = $2, updated_at = NOW()
         WHERE id = $1 RETURNING ${CREATIVE_COLS}`,
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
         RETURNING ${CREATIVE_COLS}`,
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
