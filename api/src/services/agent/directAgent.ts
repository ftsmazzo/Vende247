import { chatJson } from "../llm.js";
import { agentToken, type InstagramAccount } from "../instagramAccounts.js";
import {
  firstNameFrom,
  latestCommentCtxForLead,
  loadBrandForOwner,
  loadDmHistory,
  saveDmTurn,
  scrubRepeatedGreeting,
} from "./agentContext.js";
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
  const [profile, commentCtx, history] = await Promise.all([
    fetchLeadProfile({ igScopedUserId: opts.senderId, accessToken: token }),
    latestCommentCtxForLead(opts.account.id, opts.senderId),
    loadDmHistory(opts.account.id, opts.senderId, 10),
  ]);

  const firstName = firstNameFrom(profile.name, profile.username);
  const turn = history.filter((h) => h.role === "assistant").length + 1;
  const hasPost = Boolean(commentCtx?.caption_post || commentCtx?.comment_text);
  const system = buildDirectSystem(opts.account, brand, { turn, firstName });

  // Persiste a fala do lead antes de gerar (memória mesmo se o LLM falhar depois).
  try {
    await saveDmTurn({
      accountId: opts.account.id,
      igLeadId: opts.senderId,
      usernameLead: profile.username,
      text: opts.text,
      direction: "in",
    });
  } catch {
    /* ignore */
  }

  let replyText: string;
  try {
    const out = await chatJson<{ reply: string }>(
      system,
      JSON.stringify({
        mensagem_atual: opts.text,
        instrucao:
          turn > 1
            ? "Continue a conversa do histórico. Sem novo oi/olá/nome no começo. Responda ao que acabou de ser dito."
            : "Abertura: natural, curta, amarre ao contexto se houver.",
        perfil: {
          username: profile.username || null,
          nome: profile.name || null,
          primeiro_nome: firstName || null,
        },
        origem_post: hasPost
          ? {
              legenda: commentCtx?.caption_post || null,
              comentario_original: commentCtx?.comment_text || null,
              username_no_comentario: commentCtx?.username_lead || null,
            }
          : null,
        modo: hasPost
          ? turn > 1
            ? "continuacao"
            : "pos_comentario"
          : turn > 1
            ? "continuacao"
            : "direct_frio",
        marca: brand.marca,
        produto: brand.produto || null,
        oferta: brand.oferta || null,
      }),
      512,
      {
        purpose: "agent",
        temperature: 0.45,
        history: history.map((h) => ({
          role: h.role,
          content:
            h.role === "assistant"
              ? JSON.stringify({ reply: h.content })
              : h.content,
        })),
      }
    );
    replyText = scrubRepeatedGreeting((out.reply || "").trim(), history.length, firstName);
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
    try {
      await saveDmTurn({
        accountId: opts.account.id,
        igLeadId: opts.senderId,
        usernameLead: profile.username,
        text: replyText,
        direction: "out",
      });
    } catch {
      /* ignore */
    }
    await query(
      `UPDATE instagram_accounts SET last_agent_event_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [opts.account.id]
    );
    return { replied: true, reply: replyText };
  } catch (e) {
    return { replied: false, reply: replyText, error: e instanceof Error ? e.message : String(e) };
  }
}
