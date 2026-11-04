import { chatJson } from "../llm.js";
import { agentToken, type InstagramAccount } from "../instagramAccounts.js";
import { latestCommentCtxForLead, loadBrandForOwner } from "./agentContext.js";
import { buildDirectSystem } from "./agentPrompts.js";
import { fetchLeadProfile, sendIgDm } from "./graphAgent.js";
import { query } from "../../db/index.js";

export async function handleDirectEvent(opts: {
  account: InstagramAccount;
  senderId: string;
  text: string;
}): Promise<{ replied: boolean; reply?: string; error?: string }> {
  if (!opts.account.agent_ativo) return { replied: false, error: "Agente desligado nesta conta." };
  const token = agentToken(opts.account);
  if (!token) return { replied: false, error: "Sem token na conta." };
  if (!opts.account.ig_user_id) return { replied: false, error: "ig_user_id ausente." };

  const brand = await loadBrandForOwner(opts.account.owner_user_id);
  const [profile, commentCtx] = await Promise.all([
    fetchLeadProfile({ igScopedUserId: opts.senderId, accessToken: token }),
    latestCommentCtxForLead(opts.account.id, opts.senderId),
  ]);

  const system = buildDirectSystem(opts.account, brand);
  const hasPost = Boolean(commentCtx?.caption_post || commentCtx?.comment_text);

  let replyText: string;
  try {
    const out = await chatJson<{ reply: string }>(
      system,
      JSON.stringify({
        mensagem: opts.text,
        perfil: {
          username: profile.username || null,
          nome: profile.name || null,
        },
        origem_post: hasPost
          ? {
              legenda: commentCtx?.caption_post || null,
              comentario_original: commentCtx?.comment_text || null,
              username_no_comentario: commentCtx?.username_lead || null,
              tipo_midia: commentCtx?.media_type || null,
            }
          : null,
        modo: hasPost ? "continuacao_pos_comentario" : "direct_frio_sem_post",
        marca: brand.marca,
        produto: brand.produto || null,
        oferta: brand.oferta || null,
        nicho: brand.nicho || null,
        conta: opts.account.ig_username || opts.account.label,
      }),
      1024,
      { purpose: "agent" }
    );
    replyText = (out.reply || "").trim().slice(0, 220);
  } catch (e) {
    return { replied: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!replyText) return { replied: false, error: "LLM não gerou reply." };

  try {
    await sendIgDm({
      igUserId: opts.account.ig_user_id,
      recipientId: opts.senderId,
      text: replyText,
      accessToken: token,
      facebookPageId: opts.account.facebook_page_id || undefined,
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
