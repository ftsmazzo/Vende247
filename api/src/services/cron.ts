import type { FastifyInstance } from "fastify";
import { getPool, query } from "../db/index.js";
import { publishImage } from "./instagram.js";

export function startCronJob(app: FastifyInstance) {
  const tick = async () => {
    if (!getPool()) return;
    try {
      const due = await query<{
        id: number;
        workspace_id: number;
        caption: string;
        media_url: string;
        ig_user_id: string;
        ig_access_token: string;
      }>(
        `SELECT c.id, c.workspace_id, c.caption, c.media_url,
                w.ig_user_id, w.ig_access_token
         FROM creatives c
         JOIN workspaces w ON w.id = c.workspace_id
         WHERE c.status = 'scheduled'
           AND c.scheduled_at <= NOW()
           AND c.media_url <> ''
           AND w.ig_user_id <> ''
           AND w.ig_access_token <> ''
         ORDER BY c.scheduled_at ASC
         LIMIT 5`
      );

      for (const row of due.rows) {
        try {
          const mediaId = await publishImage({
            igUserId: row.ig_user_id,
            accessToken: row.ig_access_token,
            imageUrl: row.media_url,
            caption: row.caption,
          });
          await query(
            `UPDATE creatives SET status = 'published', published_at = NOW(), ig_media_id = $2, updated_at = NOW()
             WHERE id = $1`,
            [row.id, mediaId]
          );
          app.log.info({ creativeId: row.id, mediaId }, "Criativo publicado via cron");
        } catch (err) {
          await query(
            `UPDATE creatives SET status = 'error', error = $2, updated_at = NOW() WHERE id = $1`,
            [row.id, err instanceof Error ? err.message : String(err)]
          );
          app.log.error({ err, creativeId: row.id }, "Falha ao publicar criativo agendado");
        }
      }
    } catch (err) {
      app.log.warn({ err }, "Cron criativos falhou");
    }
  };

  setInterval(tick, 60_000);
  void tick();
}
