import type { BrandKit } from "./brandFromUrl.js";

export type NicheCtx = {
  nicho: string;
  produto: string;
  oferta?: string;
};

const INDUSTRIAL_RE =
  /\b(epi|ppe|sst|nr\b|ca\b|biometria|capacete|protetor|f[aá]brica|factory|warehouse|industrial|seguran[cç]a do trabalho|gest[aã]o de epi|hard\s*hat|prontepi|pront\s*epi|sa[uú]de no trabalho|ordem de servi[cç]o|trabalhador|auditoria)\b/i;

/** Fé explícita — NÃO incluir "mulher" ou "planner" sozinhos (contaminava SST). */
const FAITH_RE =
  /\b(crist[aã]|devocional|b[ií]blia|ora[cç][aã]o|igreja|vers[ií]culo|quiet time|mulher crist[aã]|planner crist[aã]|planner mulher)\b/i;

export function isIndustrialNiche(ctx: NicheCtx | { nicho: string; produto: string; oferta?: string }): boolean {
  return INDUSTRIAL_RE.test(`${ctx.nicho} ${ctx.produto} ${ctx.oferta || ""}`);
}

export function isFaithLifestyleNiche(ctx: NicheCtx | { nicho: string; produto: string; oferta?: string }): boolean {
  return FAITH_RE.test(`${ctx.nicho} ${ctx.produto} ${ctx.oferta || ""}`) && !isIndustrialNiche(ctx);
}

export function looksIndustrialVisual(text: string): boolean {
  return INDUSTRIAL_RE.test(text);
}

export function filterResearchCues(cues: string[], ctx: NicheCtx): string[] {
  if (isIndustrialNiche(ctx)) return cues.filter(Boolean);
  return cues.filter((c) => c && !looksIndustrialVisual(c));
}

/**
 * Trava o prompt no nicho da campanha.
 * Industrial/SST → operação real. Faith só se briefing for fé. Sem misturar.
 */
export function lockVisualToNiche(
  prompt: string,
  ctx: NicheCtx,
  brand?: BrandKit | null,
  hook?: string
): string {
  const base = (prompt || "").trim();
  const blob = `${ctx.nicho} ${ctx.produto} ${ctx.oferta || ""} ${brand?.visual_summary || ""} ${brand?.product_ui_notes || ""}`;

  if (isIndustrialNiche(ctx) || /prontepi|sst|\bepi\b/i.test(blob)) {
    return [
      `NICHE LOCK INDUSTRIAL/SST: product="${ctx.produto.slice(0, 140)}"; niche="${ctx.nicho.slice(0, 120)}".`,
      "Show real workplace SST/EPI operations: warehouse, plant floor, safety technician, tablet with compliance UI, PPE delivery evidence.",
      "Brand mood: dark navy, deep teal, authoritative, technical — NOT cozy lifestyle.",
      "FORBIDDEN: Bible, planner journal, faith quiet-time, beige terracotta morning, purple SaaS gradient, smiling generic stock.",
      brand?.visual_summary ? `Brand: ${brand.visual_summary.slice(0, 200)}.` : "",
      brand?.product_ui_notes ? `Scenes: ${brand.product_ui_notes.slice(0, 220)}.` : "",
      hook ? `Overlay: "${String(hook).slice(0, 48)}".` : "",
      base,
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 3500);
  }

  if (isFaithLifestyleNiche(ctx)) {
    const scene =
      brand?.product_ui_notes?.trim() ||
      "Woman in calm morning quiet time: open planner or Bible, coffee, soft window light — cozy faith lifestyle";
    return [
      `NICHE LOCK FAITH: product="${ctx.produto.slice(0, 120)}".`,
      scene,
      "FORBIDDEN: industrial PPE, hard hats, factory, EPI management UI.",
      base,
    ]
      .join(" ")
      .slice(0, 3500);
  }

  const contaminatedFaith =
    /\b(bible|b[ií]blia|quiet time|devotional|planner journal|terracotta cozy|faith lifestyle)\b/i.test(base);
  const contaminatedIndustrial = looksIndustrialVisual(base) && !isIndustrialNiche(ctx);

  const scene =
    brand?.product_ui_notes?.trim() ||
    `Authentic product-in-use scene for "${ctx.produto}". Real people and context. No unrelated religious or industrial props.`;

  const rebuilt =
    contaminatedFaith || contaminatedIndustrial
      ? [
          `Instagram ad for "${ctx.produto}".`,
          `Niche: ${ctx.nicho}.`,
          scene,
          hook ? `Overlay text: "${String(hook).slice(0, 48)}".` : "",
        ]
          .filter(Boolean)
          .join(" ")
      : base;

  return [
    `NICHE LOCK: product="${ctx.produto.slice(0, 120)}"; niche="${ctx.nicho.slice(0, 120)}".`,
    "EVERY object and on-image text MUST match this product only.",
    "FORBIDDEN unless niche is faith: Bible, quiet time, planner journal faith aesthetic.",
    "FORBIDDEN unless niche is industrial SST/EPI: hard hats, factory PPE overlays.",
    brand?.visual_summary ? `Brand mood: ${brand.visual_summary.slice(0, 200)}.` : "",
    rebuilt,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 3500);
}
