import type { InstagramAccount } from "../instagramAccounts.js";
import type { CompanyBriefing } from "../companyKnowledge.js";

export type BrandCtx = {
  marca: string;
  produto: string;
  nicho: string;
  oferta: string;
  tom_voz: string;
};

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
      "PAPEL (comentário público + abertura no Direct via push):",
      "- Seja breve, caloroso e específico ao comentário. Nunca genérico.",
      "- Se houver legenda do post, use. Se NÃO houver post/legenda, use missão + carta de produtos.",
      "- Objetivo: micro-conexão + curiosidade para o Direct.",
      "",
      "JSON:",
      '- "resposta_comentario": máx. 280 chars.',
      '- "resposta_direct": 1ª msg privada, máx. 220 chars, UMA pergunta. Sem markdown.',
      "",
      "Não invente preço/promoção fora da base. Sem WhatsApp no comentário público.",
    ].join("\n"),
    acc.agent_prompt_comentarios
  );
}

export function buildDirectSystem(
  acc: InstagramAccount,
  brand: BrandCtx,
  opts?: { turn: number; firstName?: string; brief?: CompanyBriefing | null }
): string {
  const nome = agentDisplayName(acc, brand);
  const tom =
    brand.tom_voz.trim() ||
    "consultivo, empático e persuasivo — vendedor de confiança, nunca robô";
  const turn = opts?.turn ?? 1;
  const firstName = (opts?.firstName || "").trim();
  const isFollowUp = turn > 1;
  const brief = opts?.brief ?? null;

  const continuity = isFollowUp
    ? [
        "CONTINUIDADE (já há histórico):",
        "- Proibido novo Oi/Olá + nome.",
        firstName ? `- Já sabe o nome (${firstName}); não repita no começo de toda msg.` : "",
        "- Continue o fio da última fala do lead.",
        "- Máx. 220 chars. Uma ideia + no máximo uma pergunta.",
      ]
    : [
        "1ª MENSAGEM:",
        firstName ? `- Pode usar ${firstName} uma vez, natural.` : "- Sem nome inventado.",
        "- Sem post de origem: apresente valor via missão/produtos da base, sem pitch frio de brochure.",
      ];

  return mergePrompt(
    [
      `Você é ${nome} da ${brand.marca || acc.label || "marca"}, SDR no Instagram Direct.`,
      `Tom: ${tom}. Turno: ${turn}${isFollowUp ? " (continuação)" : " (abertura)"}.`,
      "",
      briefBlock(brief),
      "",
      ...continuity.filter(Boolean),
      "",
      "COMPORTAMENTO:",
      "- Alinhe à missão. Use a carta de produtos para responder o que vendemos.",
      "- Direct frio (sem post): descubra necessidade e ofereça o produto certo da carta.",
      "- Objeções: use as respostas da base; se não houver, acolha e ofereça próximo passo.",
      "- CTA preferido da empresa quando houver interesse real.",
      "",
      "PROIBIDO: inventar fora da base; checklist; 'como posso ajudar hoje?'; reapresentar empresa a cada msg.",
      "",
      'JSON: {"reply":"texto"}',
    ].join("\n"),
    acc.agent_prompt_direct
  );
}
