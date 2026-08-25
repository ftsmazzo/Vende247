import { extractBrandFromUrl, type BrandKit } from "./brandFromUrl.js";
import { chatJson } from "./llm.js";
import type { IdentityModel } from "./identityContract.js";
import type { ResearchReport, WorkspaceContext } from "./research.js";
import type { StrategyPlan } from "./strategy.js";

/** Schema de saída do agente (riqueza). Não é a marca Flávio — só a estrutura do contrato. */
const CONTRACT_SHAPE = `
identity_signature { summary, recognition_cues[] }
design_tokens.colors { cada chave: { value: "#hex" } } — use brand_primary, brand_secondary, brand_accent, ink, surface e mais se fizer sentido
hierarchy_rules[] { rule, status: observed|inferred|recommended }
image_treatment { observed, hero_recipe, mobile, prohibited[] }
iconography_and_graphics { diagonal_bands?, icons?, forbidden[] }
landing_page_style_spec { page_personality[], content_density, reading_flow, sections {header,hero,priorities,cta,footer}, components {button_primary,button_secondary,card} }
responsive_strategy { desktop[], tablet[], mobile[] }
do[], dont[], generation_prompt, negative_prompt, acceptance_criteria[], overall_confidence
evidence_policy: marcar cada decisão como observed (viu na referência) | inferred (research/estratégia) | recommended (ponto de partida cego)
`;

export function tokensCssFromModel(model: IdentityModel): string {
  const colors =
    (model.design_tokens as { colors?: Record<string, { value?: string }> } | undefined)?.colors ||
    {};
  const lines = Object.entries(colors)
    .filter(([, v]) => v?.value)
    .map(([k, v]) => `  --${k.replace(/_/g, "-")}: ${v!.value};`);
  return `:root{\n${lines.join("\n")}\n}\n`;
}

function parseUrls(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s)]+/gi) || [];
  return [...new Set(found.map((u) => u.replace(/[.,;]+$/, "")))].slice(0, 8);
}

async function gatherUrlEvidence(urls: string[]): Promise<BrandKit[]> {
  const out: BrandKit[] = [];
  for (const url of urls.slice(0, 5)) {
    try {
      out.push(await extractBrandFromUrl(url));
    } catch {
      out.push({ site_url: url, visual_summary: "(não deu para ler a página)", source: "url" });
    }
  }
  return out;
}

/**
 * Agente de identidade: cruza research + estratégia + referências soltas
 * (sites, URLs de imagem, notas). Ponto de partida cego se não houver peça.
 * Não aplica contrato de outra campanha.
 */
export async function generateCampaignIdentity(opts: {
  ctx: WorkspaceContext;
  report: ResearchReport;
  strategy: StrategyPlan;
  notes?: string;
  reference_urls?: string[];
  image_urls?: string[];
}): Promise<{ model: IdentityModel; css: string }> {
  const { ctx, report, strategy, notes } = opts;
  const fromNotes = parseUrls(notes || "");
  const urls = [...new Set([...(opts.reference_urls || []), ...fromNotes])].slice(0, 8);
  const imageUrls = (opts.image_urls || []).filter((u) => /^https?:\/\//i.test(u)).slice(0, 12);
  const siteEvidence = urls.length ? await gatherUrlEvidence(urls) : [];
  const blind = !notes?.trim() && !urls.length && !imageUrls.length;

  const model = await chatJson<IdentityModel>(
    `Você é o AGENTE DE IDENTIDADE VISUAL desta campanha (skill visual-identity-audit).

ENTRADAS (cruzar TUDO):
1) Briefing da campanha
2) Research de mercado (o que concorrentes fazem, direcao_visual, hooks)
3) Estratégia (pilares, hooks, formatos)
4) Referências soltas se existirem: sites lidos, URLs de imagem, notas do usuário
   — peças, brandbook, moodboard, print, o que vier. Não precisa estar completo.

PONTO DE PARTIDA CEGO: se não houver peça oficial, CRIE um sistema visual recomendado alinhado ao produto, tom_voz e cenas do research. Marque recommended. Não recuse gerar. Não invente "conflito com outra marca".

PROIBIDO:
- Copiar Flávio Bolsonaro, numeral 22, paleta #005BAA/#FFCB05/#12B24B, retrato político, Gotham de campanha — a menos que ESTA campanha seja claramente essa candidatura no briefing.
- Copiar ProntEPI / teal hospitalar / dashboard SaaS se o produto não for isso.
- Dizer que falta identidade e parar. Seu trabalho É criar o contrato.

SAÍDA: um único JSON rico no shape abaixo (mesmo nível de detalhe de um brandbook operacional, não 3 cores soltas):
${CONTRACT_SHAPE}

generation_prompt = parágrafo para gerador de imagem DESTA marca.
negative_prompt = o que essa marca não é.`,
    JSON.stringify(
      {
        ponto_de_partida_cego: blind,
        campanha: ctx,
        notas_e_intencao: notes || null,
        urls_pedidas: urls,
        imagens_referencia_urls: imageUrls,
        evidencias_de_sites: siteEvidence.map((k) => ({
          site_url: k.site_url,
          colors: k.colors,
          visual_summary: k.visual_summary,
          product_ui_notes: k.product_ui_notes,
          logo_url: k.logo_url,
        })),
        research: {
          resumo: report.resumo,
          oportunidades_unicas: (report.oportunidades_unicas || []).slice(0, 10),
          direcao_visual: (report.direcao_visual || []).slice(0, 12),
          hooks_vencedores: (report.hooks_vencedores || []).slice(0, 10),
          pilares_conteudo: report.pilares_conteudo,
          o_que_concorrentes_fazem_bem: (report.o_que_concorrentes_fazem_bem || []).slice(0, 8),
        },
        strategy: {
          resumo: strategy.resumo,
          pilares: strategy.pilares,
          hooks: (strategy.posts || []).slice(0, 10).map((p) => p.hook),
          formatos: (strategy.posts || []).slice(0, 10).map((p) => p.formato),
          visual_prompts: (strategy.posts || []).slice(0, 6).map((p) => p.visual_prompt),
        },
      },
      null,
      2
    )
  );

  return { model, css: tokensCssFromModel(model) };
}
