import { chatJson } from "../llm.js";
import {
  agentToken,
  DEFAULT_COMMENT_PROMPT,
  type InstagramAccount,
} from "../instagramAccounts.js";
import { replyToComment } from "./graphAgent.js";
import { query } from "../../db/index.js";

export async function handleCommentEvent(opts: {
  account: InstagramAccount;
  commentId: string;
  text: string;
  fromUsername?: string;
}): Promise<{ replied: boolean; reply?: string; error?: string }> {
  if (!opts.account.agent_ativo) return { replied: false, error: "Agente desligado nesta conta." };
  const token = agentToken(opts.account);
  if (!token) return { replied: false, error: "Sem token na conta." };

  const system = opts.account.agent_prompt_comentarios?.trim() || DEFAULT_COMMENT_PROMPT;
  let replyText: string;
  try {
    const out = await chatJson<{ reply: string }>(
      `${system}\nResponda JSON {"reply":"..."} com no máximo 280 caracteres.`,
      JSON.stringify({
        comentario: opts.text,
        de: opts.fromUsername || null,
        conta: opts.account.ig_username || opts.account.label,
      })
    );
    replyText = (out.reply || "").trim();
  } catch (e) {
    return { replied: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!replyText) return { replied: false, error: "LLM não gerou reply." };

  try {
    await replyToComment({
      commentId: opts.commentId,
      message: replyText,
      accessToken: token,
    });
    await query(
      `UPDATE instagram_accounts SET last_agent_event_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [opts.account.id]
    );
    return { replied: true, reply: replyText };
  } catch (e) {
    return { replied: false, reply: replyText, error: e instanceof Error ? e.message : String(e) };
  }
}
