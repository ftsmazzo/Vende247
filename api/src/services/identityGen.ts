import { chatJson } from "./llm.js";
import type { IdentityModel } from "./identityContract.js";
import type { ResearchReport, WorkspaceContext } from "./research.js";
import type { StrategyPlan } from "./strategy.js";

export function tokensCssFromModel(model: IdentityModel): string {
  const colors =
    (model.design_tokens as { colors?: Record<string, { value?: string }> } | undefined)?.colors ||
    {};
  const lines = Object.entries(colors)
    .filter(([, v]) => v?.value)
    .map(([k, v]) => `  --${k.replace(/_/g, "-")}: ${v!.value};`);
  return `:root{\n${lines.join("\n")}\n}\n`;
}

/**
 * Gera o contrato de identidade DESTA campanha a partir de research + estratégia.
 * Não lê brand_kit da conta. Não aplica contrato de outra campanha.
 */
export async function generateCampaignIdentity(opts: {
  ctx: WorkspaceContext;
  report: ResearchReport;
  strategy: StrategyPlan;
  notes?: string;
}): Promise<{ model: IdentityModel; css: string }> {
  const { ctx, report, strategy, notes } = opts;

  const model = await chatJson<IdentityModel>(
    `Você é diretor de arte. Vai CRIAR a identidade visual desta campanha (não auditar outra marca).

Ordem do produto: a pesquisa e a estratégia JÁ EXISTEM. Extraia padrões visuais do mercado (direcao_visual, hooks, tom) e invente um sistema coerente para ESTE produto.

NÃO copie identidade política, numeral 22, paleta de outra campanha, ProntEPI, teal hospitalar, dashboard SaaS, a menos que o briefing DESTA campanha seja exatamente isso.

Tipo de campanha: ${ctx.type || "produto"}.
Produto: ${ctx.produto}. Nicho: ${ctx.nicho}. Tom: ${ctx.tom_voz}.

JSON no schema:
{
  "identity_signature": { "summary": string, "recognition_cues": string[] },
  "design_tokens": { "colors": { "brand_primary": {"value":"#hex"}, "brand_secondary": {"value":"#hex"}, "brand_accent": {"value":"#hex"}, "ink": {"value":"#hex"}, "surface": {"value":"#hex"} } },
  "landing_page_style_spec": {
    "page_personality": string[],
    "content_density": string,
    "reading_flow": string,
    "sections": { "header": string, "hero": string, "cta": string, "footer": string },
    "components": { "button_primary": string, "card": string }
  },
  "image_treatment": { "observed": string, "hero_recipe": string, "prohibited": string[] },
  "do": string[],
  "dont": string[],
  "generation_prompt": string,
  "negative_prompt": string,
  "overall_confidence": "high"|"medium"|"low",
  "acceptance_criteria": string[]
}

Cores: 5 hex reais, contraste AA no CTA. generation_prompt = 1 parágrafo para gerador de imagem (cena + paleta + tipo). negative_prompt = o que NÃO gerar.`,
    JSON.stringify(
      {
        campanha: ctx,
        notas_usuario: notes || null,
        research: {
          resumo: report.resumo,
          oportunidades_unicas: (report.oportunidades_unicas || []).slice(0, 8),
          direcao_visual: (report.direcao_visual || []).slice(0, 12),
          hooks_vencedores: (report.hooks_vencedores || []).slice(0, 10),
          pilares_conteudo: report.pilares_conteudo,
          o_que_concorrentes_fazem_bem: (report.o_que_concorrentes_fazem_bem || []).slice(0, 8),
        },
        strategy: {
          resumo: strategy.resumo,
          pilares: strategy.pilares,
          hooks: (strategy.posts || []).slice(0, 8).map((p) => p.hook),
          formatos: (strategy.posts || []).slice(0, 8).map((p) => p.formato),
        },
      },
      null,
      2
    )
  );

  const css = tokensCssFromModel(model);
  return { model, css };
}
