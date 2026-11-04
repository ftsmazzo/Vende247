import { chatJson } from "../llm.js";
import { agentToken, type InstagramAccount } from "../instagramAccounts.js";
import { loadCompanyBriefingForOwner } from "../companyKnowledge.js";
import {
  firstNameFrom,
  latestCommentCtxForLead,
  loadDmHistory,
  saveDmTurn,
  scrubRepeatedGreeting,
} from "./agentContext.js";
import {
  brandFromBriefing,
  buildDirectSystem,
  matchProductFromText,
  type DirectMode,
} from "./agentPrompts.js";
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

  const [brief, profile, commentCtx, history] = await Promise.all([
    loadCompanyBriefingForOwner(opts.account.owner_user_id),
    fetchLeadProfile({ igScopedUserId: opts.senderId, accessToken: token }),
    latestCommentCtxForLead(opts.account.id, opts.senderId),
    loadDmHistory(opts.account.id, opts.senderId, 10),
  ]);
  const brand = brandFromBriefing(brief);
  const products = brief?.products || [];

  const firstName = firstNameFrom(profile.name, profile.username);
  const assistantTurns = history.filter((h) => h.role === "assistant").length;
  const turn = assistantTurns + 1;
  const fromComment = Boolean(commentCtx?.comment_text || commentCtx?.caption_post);

  // Private reply do comentário já conta como 1ª saída do bot → a 1ª fala do lead ainda é “pós-comentário”.
  const earlyAfterComment = fromComment && assistantTurns <= 2;
  const mode: DirectMode = fromComment
    ? earlyAfterComment || turn === 1
      ? "pos_comentario"
      : "continuacao"
    : turn > 1
      ? "continuacao"
      : "direct_frio";

  const matched = fromComment
    ? matchProductFromText(
        `${commentCtx?.caption_post || ""} ${commentCtx?.comment_text || ""} ${opts.text}`,
        products
      )
    : matchProductFromText(opts.text, products);

  const system = buildDirectSystem(opts.account, brand, {
    turn,
    firstName,
    brief,
    mode,
    fromComment,
  });

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

  const produtoSugerido = matched
    ? {
        nome: matched.nome,
        descricao: matched.descricao || null,
        beneficios: matched.beneficios || null,
        preco_hint: matched.preco_hint || null,
        cta: matched.cta || null,
      }
    : null;

  let replyText: string;
  try {
    const out = await chatJson<{ reply: string }>(
      system,
      JSON.stringify({
        mensagem_atual: opts.text,
        instrucao: fromComment
          ? earlyAfterComment
            ? "VEIO DE COMENTÁRIO: recupere post + comentário + produto sugerido. Não trate como Direct frio. Se o lead pedir outra coisa, ofereça outro item da carta."
            : "Continuação pós-comentário: mantenha o fio; pode pivotar produto se o lead pedir."
          : turn > 1
            ? "Direct frio em continuidade: sem novo cumprimento; use a base/carta. Pode trocar de produto."
            : "Direct frio: NÃO dependa de post. Use missão + carta de produtos.",
        perfil: {
          username: profile.username || null,
          nome: profile.name || null,
          primeiro_nome: firstName || null,
        },
        origem_comentario: fromComment
          ? {
              legenda_post: commentCtx?.caption_post || null,
              tipo_midia: commentCtx?.media_type || null,
              comentario_original: commentCtx?.comment_text || null,
              username_no_comentario: commentCtx?.username_lead || null,
              media_id: commentCtx?.media_id || null,
            }
          : null,
        produto_sugerido: produtoSugerido,
        outros_produtos_disponiveis: products
          .filter((p) => p.ativo)
          .slice(0, 8)
          .map((p) => p.nome),
        modo: mode,
      }),
      512,
      {
        purpose: "agent",
        temperature: 0.45,
        history: history.map((h) => ({
          role: h.role,
          content: h.role === "assistant" ? JSON.stringify({ reply: h.content }) : h.content,
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
