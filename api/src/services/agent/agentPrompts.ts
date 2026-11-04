import type { InstagramAccount } from "../instagramAccounts.js";
import type { CompanyBriefing, WorkspaceProduct } from "../companyKnowledge.js";

export type BrandCtx = {
  marca: string;
  produto: string;
  nicho: string;
  oferta: string;
  tom_voz: string;
};

export type DirectMode = "direct_frio" | "pos_comentario" | "continuacao";

export function brandFromBriefing(brief: CompanyBriefing | null): BrandCtx {
  if (!brief) {
    return { marca: "nossa empresa", produto: "", nicho: "", oferta: "", tom_voz: "" };
  }
  return {
    marca: brief.marca,
    produto: brief.produto,
    nicho: brief.nicho,
    oferta: brief.oferta,
    tom_voz: brief.tom_voz,
  };
}

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
    "Os refinamentos complementam as regras acima; não invalidam humanização, missão nem a base da empresa.",
  ].join("\n");
}

function briefBlock(brief: CompanyBriefing | null): string {
  return brief?.agent_brief?.trim() || "Base da empresa ainda vazia — peça o essencial e não invente.";
}

/** Heurística leve: produto da carta que mais “bate” com post/comentário. */
export function matchProductFromText(
  text: string,
  products: WorkspaceProduct[]
): WorkspaceProduct | null {
  const hay = text.toLowerCase();
  if (!hay || !products.length) return null;
  let best: WorkspaceProduct | null = null;
  let score = 0;
  for (const p of products.filter((x) => x.ativo)) {
    let s = 0;
    const parts = [p.nome, p.descricao, p.beneficios, p.para_quem]
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9à-ú]+/i)
      .filter((w) => w.length >= 4);
    for (const w of parts) {
      if (hay.includes(w)) s += 1;
    }
    if (p.nome && hay.includes(p.nome.toLowerCase())) s += 5;
    if (s > score) {
      score = s;
      best = p;
    }
  }
  return score > 0 ? best : products.find((p) => p.ativo) || null;
}

export function buildCommentSystem(
  acc: InstagramAccount,
  brand: BrandCtx,
  brief: CompanyBriefing | null
): string {
  const nome = agentDisplayName(acc, brand);
  const tom =
    brand.tom_voz.trim() ||
    "humanizado, acolhedor e profissional — SDR alinhado à missão da empresa";
  return mergePrompt(
    [
      `Você é ${nome}, SDR digital de ${brand.marca || acc.label || "a marca"} no Instagram.`,
      `Tom: ${tom}.`,
      "",
      briefBlock(brief),
      "",
      "PAPEL (comentário → push no Direct):",
      "- Público: curto, específico ao comentário + ao post (se houver legenda).",
      "- Direct privado: 1ª abertura — retome o comentário e o tema do post; amarre a UM produto da carta se fizer sentido.",
      "- Se o post não tiver legenda, use missão + carta (não dependa do feed).",
      "",
      "JSON:",
      '- "resposta_comentario": máx. 280 chars.',
      '- "resposta_direct": máx. 220 chars, UMA pergunta. Sem markdown.',
      "- Sem WhatsApp no público. Não invente fora da base.",
    ].join("\n"),
    acc.agent_prompt_comentarios
  );
}

export function buildDirectSystem(
  acc: InstagramAccount,
  brand: BrandCtx,
  opts: {
    turn: number;
    firstName?: string;
    brief?: CompanyBriefing | null;
    mode: DirectMode;
    fromComment: boolean;
  }
): string {
  const nome = agentDisplayName(acc, brand);
  const tom =
    brand.tom_voz.trim() ||
    "consultivo, empático e persuasivo — vendedor de confiança, nunca robô";
  const turn = opts.turn;
  const firstName = (opts.firstName || "").trim();
  const isFollowUp = turn > 1;
  const brief = opts.brief ?? null;
  const fromComment = opts.fromComment;

  const modeBlock = fromComment
    ? [
        "MODO: VEIO DE COMENTÁRIO (obrigatório recuperar contexto).",
        "- Na 1ª resposta do lead (e enquanto o assunto for o post), você JÁ sabe: legenda, comentário original e produto sugerido no payload.",
        "- Comece pelo post/comentário — não peça \"o que te trouxe\" como se fosse Direct frio.",
        "- Use o produto sugerido se couber; se o lead pedir outra coisa, troque para outro item da CARTA DE PRODUTOS.",
        "- Continuidade: mantenha o fio do post até o lead mudar de assunto.",
      ]
    : [
        "MODO: DIRECT FRIO (não dependa de post/feed).",
        "- Perfil pode estar zerado. Sua única fonte é a BASE DA EMPRESA + CARTA DE PRODUTOS.",
        "- Descubra necessidade e ofereça o produto certo. Sem esperar legenda/post.",
      ];

  const continuity = isFollowUp
    ? [
        "CONTINUIDADE:",
        "- Proibido novo Oi/Olá + nome.",
        firstName ? `- Nome já conhecido (${firstName}); não repetir no começo.` : "",
        "- Responda ao que a pessoa acabou de dizer.",
        "- Máx. 220 chars. Uma ideia + no máximo uma pergunta.",
      ]
    : [
        "ABERTURA:",
        firstName ? `- Pode usar ${firstName} uma vez.` : "- Sem nome inventado.",
        fromComment
          ? "- Retome post + comentário + produto; UMA pergunta natural."
          : "- Sem post: missão/produtos, tom humano, UMA pergunta.",
      ];

  return mergePrompt(
    [
      `Você é ${nome} da ${brand.marca || acc.label || "marca"}, SDR no Instagram Direct.`,
      `Tom: ${tom}. Turno: ${turn}. Modo payload: ${opts.mode}.`,
      "",
      briefBlock(brief),
      "",
      ...modeBlock,
      "",
      ...continuity.filter(Boolean),
      "",
      "PRODUTOS:",
      "- Sempre pode oferecer outro item da carta se o lead mudar o interesse.",
      "- Não invente preço/condição fora da base; se faltar, diga que confirma no próximo passo (WhatsApp/CTA).",
      "",
      "PROIBIDO: checklist; 'como posso ajudar hoje?'; reapresentar a empresa a cada msg; ignorar contexto do post quando existir.",
      "",
      'JSON: {"reply":"texto"}',
    ].join("\n"),
    acc.agent_prompt_direct
  );
}
