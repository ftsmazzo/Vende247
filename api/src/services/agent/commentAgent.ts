import { chatJson } from "../llm.js";
import { agentToken, type InstagramAccount } from "../instagramAccounts.js";
import { loadCompanyBriefingForOwner } from "../companyKnowledge.js";
import { saveCommentInteraction, saveDmTurn } from "./agentContext.js";
import { brandFromBriefing, buildCommentSystem, matchProductFromText } from "./agentPrompts.js";
import {
  fetchMediaContext,
  replyToComment,
  sendPrivateReplyFromComment,
} from "./graphAgent.js";
import { query } from "../../db/index.js";

export async function handleCommentEvent(opts: {
  account: InstagramAccount;
  commentId: string;
  text: string;
  fromUsername?: string;
  fromId?: string;
  mediaId?: string;
}): Promise<{
  replied: boolean;
  reply?: string;
  private_reply?: string;
  error?: string;
}> {
  if (!opts.account.agent_ativo) return { replied: false, error: "Agente desligado nesta conta." };
  const token = agentToken(opts.account);
  if (!token) return { replied: false, error: "Sem token na conta." };
  if (!opts.account.ig_user_id) return { replied: false, error: "ig_user_id ausente." };

  const brief = await loadCompanyBriefingForOwner(opts.account.owner_user_id);
  const brand = brandFromBriefing(brief);
  const media = opts.mediaId
    ? await fetchMediaContext({ mediaId: opts.mediaId, accessToken: token })
    : { caption: "", mediaType: "" };

  const system = buildCommentSystem(opts.account, brand, brief);
  const matched = matchProductFromText(
    `${media.caption} ${opts.text}`,
    brief?.products || []
  );
  let publicReply = "";
  let privateReply = "";
  try {
    const out = await chatJson<{
      resposta_comentario?: string;
      resposta_direct?: string;
      reply?: string;
    }>(
      system,
      JSON.stringify({
        legenda_post: media.caption || null,
        tipo_midia: media.mediaType || null,
        tem_contexto_de_post: Boolean(media.caption),
        comentario: opts.text,
        username_lead: opts.fromUsername || null,
        conta: opts.account.ig_username || opts.account.label,
        produto_sugerido: matched
          ? {
              nome: matched.nome,
              descricao: matched.descricao || null,
              beneficios: matched.beneficios || null,
              preco_hint: matched.preco_hint || null,
            }
          : null,
        outros_produtos: (brief?.products || [])
          .filter((p) => p.ativo)
          .slice(0, 8)
          .map((p) => p.nome),
        nota: "O Direct privado deve carregar o contexto do post/comentário para a próxima mensagem do lead.",
      }),
      1024,
      { purpose: "agent" }
    );
    publicReply = (out.resposta_comentario || out.reply || "").trim().slice(0, 280);
    privateReply = (out.resposta_direct || "").trim().slice(0, 220);
    if (!privateReply && publicReply) {
      const who = opts.fromUsername ? `@${opts.fromUsername}` : "Oi";
      privateReply = `${who}, vi seu comentário — me conta o que você mais quer saber?`.slice(0, 220);
    }
  } catch (e) {
    return { replied: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!publicReply) return { replied: false, error: "LLM não gerou resposta_comentario." };

  try {
    await replyToComment({
      commentId: opts.commentId,
      message: publicReply,
      accessToken: token,
    });
  } catch (e) {
    return {
      replied: false,
      reply: publicReply,
      private_reply: privateReply,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  let privateError: string | undefined;
  if (privateReply) {
    try {
      await sendPrivateReplyFromComment({
        igUserId: opts.account.ig_user_id,
        commentId: opts.commentId,
        text: privateReply,
        accessToken: token,
        facebookPageId: opts.account.facebook_page_id || undefined,
      });
      if (opts.fromId) {
        try {
          await saveDmTurn({
            accountId: opts.account.id,
            igLeadId: opts.fromId,
            usernameLead: opts.fromUsername,
            text: privateReply,
            direction: "out",
          });
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      privateError = e instanceof Error ? e.message : String(e);
    }
  }

  if (opts.fromId) {
    try {
      await saveCommentInteraction({
        accountId: opts.account.id,
        igLeadId: opts.fromId,
        usernameLead: opts.fromUsername,
        commentId: opts.commentId,
        mediaId: opts.mediaId,
        commentText: opts.text,
        captionPost: media.caption,
        mediaType: media.mediaType,
      });
    } catch {
      /* ignore */
    }
  }

  await query(
    `UPDATE instagram_accounts SET last_agent_event_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [opts.account.id]
  );

  return {
    replied: true,
    reply: publicReply,
    private_reply: privateReply,
    error: privateError,
  };
}
