import { chatJson } from "./llm.js";
import type { BrandKit } from "./brandFromUrl.js";
import type { ResearchReport } from "./research.js";
import type { StrategyPlan } from "./strategy.js";
import { isFaithLifestyleNiche, isIndustrialNiche } from "./nicheVisual.js";
import { PLANNER_MULHER_PRESET } from "./brandPresets.js";

export type BrandSource = "url" | "generated" | "preset" | "manual";

export type WorkspaceBrandCtx = {
  nicho: string;
  produto: string;
  oferta: string;
  tom_voz: string;
  cta: string;
};

/** Identidade antiga (ex.: ProntEPI) ainda grudada num produto novo. */
export function brandMismatchReason(
  brand: BrandKit | null | undefined,
  ctx: WorkspaceBrandCtx
): string | null {
  if (!brand?.visual_summary && !brand?.colors?.length) return null;

  // Motor / preset já são do produto atual — não alertar
  if (brand.source === "generated" || brand.source === "preset") return null;

  if (isIndustrialNiche(ctx)) return null;

  const colors = (brand.colors || []).map((c) =>
    (c.startsWith("#") ? c : `#${c}`).toLowerCase()
  );
  const prontepiHex = ["#0f766e", "#115e59", "#99f6e4", "#0f172a", "#14b8a6", "#0d9488"];
  const hasProntColors = prontepiHex.some((c) => colors.includes(c));

  // Só texto que afirma identidade EPI/SaaS antiga (não "evitar dashboard")
  const blob = `${brand.visual_summary || ""} ${brand.product_ui_notes || ""}`;
  const strongOldBrand =
    /prontepi/i.test(blob) ||
    /azul escuro e verde/i.test(blob) ||
    /gestores e operadores de seguran/i.test(blob) ||
    /seguran[cç]a do trabalho/i.test(blob) ||
    /estoque,? alertas e relat/i.test(blob) ||
    /paleta de cores que remete [àa] seguran/i.test(blob);

  if (hasProntColors || strongOldBrand) {
    return "A identidade salva ainda parece do produto anterior (EPI/SaaS verde-azul). Gere uma nova ou aplique o preset do Planner.";
  }
  return null;
}

/**
 * Motor de identidade visual.
 * Caminho sem site: Config + Research + Estratégia → brand_kit.
 * Opcional: preserva logo_url se o usuário já tiver colado.
 */
export async function generateBrandIdentity(opts: {
  ctx: WorkspaceBrandCtx;
  report?: ResearchReport | null;
  strategy?: StrategyPlan | null;
  keepLogoUrl?: string;
}): Promise<BrandKit> {
  const { ctx, report, strategy, keepLogoUrl } = opts;

  // Atalho sólido para o produto atual (evita alucinação verde/teal)
  if (isFaithLifestyleNiche(ctx) && !isIndustrialNiche(ctx)) {
    const base = PLANNER_MULHER_PRESET.brand_kit;
    try {
      const ai = await chatJson<{
        colors: string[];
        visual_summary: string;
        product_ui_notes: string;
      }>(
        `Você é diretor de arte de marca digital cristã feminina (Brasil).
Crie identidade visual NOVA para este produto — NÃO use estética SaaS, EPI, verde hospitalar, teal tech, dashboard.

OBRIGATÓRIO:
- colors: 4–5 hex (bege, terracotta, off-white, marrom café ou rosa suave — NUNCA #0f766e #99f6e4 #0f172a)
- visual_summary: 2–4 frases PT (mood, tipografia, atmosfera)
- product_ui_notes: cenas humanas para criativos/landing (planner, Bíblia, quiet time) — SEM mockup de app/dashboard

Use research/estratégia só como clima de campanha (pilares/hooks), não como cores de outro produto.`,
        JSON.stringify(
          {
            produto: ctx,
            research: report
              ? {
                  resumo: report.resumo,
                  direcao_visual: (report.direcao_visual || []).slice(0, 8),
                  pilares: report.pilares_conteudo,
                }
              : null,
            strategy: strategy
              ? {
                  resumo: strategy.resumo,
                  pilares: strategy.pilares,
                  hooks: (strategy.posts || []).slice(0, 5).map((p) => p.hook),
                }
              : null,
            referencia_segura: {
              colors: base.colors,
              mood: base.visual_summary,
            },
          },
          null,
          2
        )
      );

      const colors = sanitizeColors(ai.colors?.length ? ai.colors : base.colors || []);
      return {
        colors,
        visual_summary: ai.visual_summary || base.visual_summary,
        product_ui_notes: ai.product_ui_notes || base.product_ui_notes,
        logo_url: keepLogoUrl || undefined,
        source: "generated",
        extracted_at: new Date().toISOString(),
      };
    } catch {
      return {
        ...base,
        logo_url: keepLogoUrl || undefined,
        source: "generated",
        extracted_at: new Date().toISOString(),
      };
    }
  }

  const ai = await chatJson<{
    colors: string[];
    visual_summary: string;
    product_ui_notes: string;
  }>(
    `Você é diretor de arte. Gere identidade visual para landing + criativos Instagram do PRODUTO informado.
NÃO invente estética de outro nicho. Se o produto não for industrial/EPI, PROIBIDO verde segurança, capacete, dashboard SaaS.

JSON: {
  colors: string[] (4–5 hex),
  visual_summary: string (2–4 frases PT),
  product_ui_notes: string (cenas humanas / produto em uso para fotos)
}`,
    JSON.stringify(
      {
        produto: ctx,
        research: report
          ? {
              resumo: report.resumo,
              direcao_visual: (report.direcao_visual || []).slice(0, 8),
              pilares: report.pilares_conteudo,
            }
          : null,
        strategy: strategy
          ? {
              resumo: strategy.resumo,
              pilares: strategy.pilares,
              hooks: (strategy.posts || []).slice(0, 5).map((p) => p.hook),
            }
          : null,
      },
      null,
      2
    )
  );

  return {
    colors: sanitizeColors(ai.colors || []),
    visual_summary: ai.visual_summary || "",
    product_ui_notes: ai.product_ui_notes || "",
    logo_url: keepLogoUrl || undefined,
    source: "generated",
    extracted_at: new Date().toISOString(),
  };
}

function sanitizeColors(colors: string[]): string[] {
  const banned = new Set(["#0f766e", "#115e59", "#99f6e4", "#0f172a", "#14b8a6", "#0d9488"]);
  return [...new Set(colors)]
    .map((c) => (c.startsWith("#") ? c.toLowerCase() : `#${c}`.toLowerCase()))
    .filter((c) => /^#[0-9a-f]{3,8}$/i.test(c) && !banned.has(c))
    .slice(0, 5);
}
