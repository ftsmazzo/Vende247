import type { FastifyPluginAsync } from "fastify";
import { getIgAccountByIgUserId } from "../services/instagramAccounts.js";
import { handleCommentEvent } from "../services/agent/commentAgent.js";
import { handleDirectEvent } from "../services/agent/directAgent.js";

const VERIFY_TOKEN =
  process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ||
  process.env.IG_WEBHOOK_VERIFY_TOKEN?.trim() ||
  "vende247-verify";

type MetaChange = {
  field?: string;
  value?: Record<string, unknown>;
};

/**
 * Webhook Meta Instagram — verify + eventos comentário/DM.
 * Configure no App Meta: Callback URL = {PUBLIC_API_URL}/api/webhooks/instagram
 */
export const webhooksInstagramRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const mode = q["hub.mode"];
    const token = q["hub.verify_token"];
    const challenge = q["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return reply.type("text/plain").send(challenge);
    }
    return reply.status(403).send("Forbidden");
  });

  app.post("/", async (req, reply) => {
    const body = req.body as {
      object?: string;
      entry?: Array<{
        id?: string;
        changes?: MetaChange[];
        messaging?: Array<Record<string, unknown>>;
      }>;
    };

    void (async () => {
      try {
        for (const entry of body?.entry || []) {
          const igUserId = String(entry.id || "");
          const account = igUserId ? await getIgAccountByIgUserId(igUserId) : null;
          if (!account?.agent_ativo) continue;

          for (const change of entry.changes || []) {
            if (change.field === "comments" || change.field === "live_comments") {
              const v = change.value || {};
              const commentId = String(v.id || v.comment_id || "");
              const text = String(v.text || "");
              const from = v.from as { username?: string; id?: string } | undefined;
              const media = v.media as { id?: string } | undefined;
              // ignora comentário da própria conta
              if (from?.id && from.id === igUserId) continue;
              if (commentId && text) {
                const result = await handleCommentEvent({
                  account,
                  commentId,
                  text,
                  fromUsername: from?.username,
                  fromId: from?.id,
                  mediaId: media?.id ? String(media.id) : undefined,
                });
                app.log.info({ commentId, mediaId: media?.id, result }, "agent comment");
              }
            }
          }

          for (const msg of entry.messaging || []) {
            const sender = msg.sender as { id?: string } | undefined;
            const message = msg.message as { text?: string; is_echo?: boolean } | undefined;
            if (message?.is_echo) continue;
            const text = message?.text?.trim();
            const senderId = sender?.id;
            if (senderId && text) {
              const result = await handleDirectEvent({ account, senderId, text });
              app.log.info({ senderId, result }, "agent dm");
            }
          }
        }
      } catch (err) {
        app.log.error({ err }, "webhook Instagram falhou");
      }
    })();

    return reply.status(200).send({ ok: true });
  });
};
