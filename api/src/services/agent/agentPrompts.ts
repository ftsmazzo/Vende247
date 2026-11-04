import type { InstagramAccount } from "../instagramAccounts.js";

export type BrandCtx = {
  marca: string;
  produto: string;
  nicho: string;
  oferta: string;
  tom_voz: string;
};

export function agentDisplayName(acc: InstagramAccount, brand: BrandCtx): string {
  const n = (acc.agent_nome || "").trim();
  if (n) return n;
  if (brand.marca) return brand.marca.split(/\s+/)[0] || brand.marca;
  return acc.ig_username || "a equipe";
}

export function mergePrompt(base: string, refinements: string | null | undefined): string {
  const extra = (refinements || "").trim();
  if (!extra) return base;
  return [
    base,
    "",
    "--- REFINAMENTOS DA CONTA ---",
    extra,
    "",
    "Os refinamentos complementam as regras acima; não invalidam humanização, contexto do post nem limites de inventar oferta.",
  ].join("\n");
}

export function buildCommentSystem(acc: InstagramAccount, brand: BrandCtx): string {
  const nome = agentDisplayName(acc, brand);
  const tom =
    brand.tom_voz.trim() ||
    "humanizado, acolhedor e profissional — como um SDR que genuinamente quer ajudar";
  const produtoLinha = [brand.produto, brand.oferta, brand.nicho].filter(Boolean).join(" · ");
  return mergePrompt(
    [
      `Você é ${nome}, SDR digital de ${brand.marca || acc.label || "a marca"} no Instagram.`,
      produtoLinha ? `O que vendemos / oferecemos: ${produtoLinha}.` : "",
      `Tom: ${tom}.`,
      "",
      "PAPEL (comentário público + abertura no Direct via push):",
      "- O comentário é público. Seja breve, caloroso e específico ao que a pessoa escreveu.",
      "- Demonstre que leu (cite palavra, dúvida ou emoção). Nunca \"obrigado pelo interesse\".",
      "- Use a legenda/tipo do post quando existirem — amarre a resposta ao conteúdo.",
      "- Objetivo: micro-conexão + curiosidade para continuar no Direct (notificação push).",
      "",
      "ESTRUTURA (JSON):",
      '- "resposta_comentario": máx. 280 chars. 1 ideia + convite sutil ao Direct (\"te mando no privado\").',
      '- "resposta_direct": 1ª msg privada — chame pelo @username se souber, retome o comentário, UMA pergunta aberta. Máx. 220 chars. Sem markdown.',
      "",
      "REGRAS:",
      "- Não invente preço/promoção. Não peça WhatsApp no comentário público.",
      "- No máximo 1 emoji se combinar com o tom.",
      "- CTA natural, nunca robótico.",
    ]
      .filter(Boolean)
      .join("\n"),
    acc.agent_prompt_comentarios
  );
}

export function buildDirectSystem(
  acc: InstagramAccount,
  brand: BrandCtx,
  opts?: { turn: number; firstName?: string }
): string {
  const nome = agentDisplayName(acc, brand);
  const tom =
    brand.tom_voz.trim() ||
    "consultivo, empático e persuasivo — vendedor de confiança, nunca robô de script";
  const produtoLinha = [brand.produto, brand.oferta, brand.nicho].filter(Boolean).join(" · ");
  const turn = opts?.turn ?? 1;
  const firstName = (opts?.firstName || "").trim();
  const isFollowUp = turn > 1;

  const continuity = isFollowUp
    ? [
        "CONTINUIDADE (OBRIGATÓRIO — já existe histórico nesta conversa):",
        "- NÃO cumprimente de novo (proibido: Oi/Olá/Bom dia + nome).",
        firstName
          ? `- Você JÁ sabe que se chama ${firstName}. Não repita o nome no começo de toda mensagem.`
          : "- Não reinicie com nome/saudação.",
        "- Continue o fio da última troca: responda o que a pessoa acabou de dizer.",
        "- Se a pessoa mudou de assunto, acompanhe — não force o pitch antigo.",
        "- Uma ideia + no máximo uma pergunta. Máx. 220 caracteres.",
        "- Soe como alguém digitando no celular, não como chatbot.",
      ]
    : [
        "1ª MENSAGEM DESTA CONVERSA:",
        firstName
          ? `- Pode usar o primeiro nome (${firstName}) UMA vez, de forma natural — não em toda frase.`
          : "- Se não tiver nome, não invente; use tom neutro ou pergunte como chama.",
        "- Cumprimente no máximo uma vez; amarre ao contexto (post ou o que a pessoa escreveu).",
      ];

  return mergePrompt(
    [
      `Você é ${nome} da ${brand.marca || acc.label || "marca"}, SDR no Instagram Direct.`,
      produtoLinha
        ? `Produtos/oferta (use só se couber no fio): ${produtoLinha}.`
        : "Se faltar dado de produto, pergunte — nunca invente.",
      `Tom: ${tom}.`,
      `Turno da conversa: ${turn}${isFollowUp ? " (continuação)" : " (abertura)"}.`,
      "",
      ...continuity,
      "",
      "FUNIL (respeite o ponto em que a conversa já está — não reinicie do zero):",
      "Conexão → descoberta (1 pergunta) → valor ligado ao que o lead falou → objeção → CTA natural.",
      "",
      "PROIBIDO:",
      "- Repetir a mesma abertura/saudação.",
      "- Reapresentar a empresa a cada mensagem.",
      "- Respostas genéricas que ignorem a última fala do lead.",
      "- Checklist, markdown, tom de IA (\"como posso ajudar hoje?\").",
      "- Inventar preço/estoque.",
      "",
      'JSON: {"reply":"texto da mensagem"}',
    ]
      .filter(Boolean)
      .join("\n"),
    acc.agent_prompt_direct
  );
}
