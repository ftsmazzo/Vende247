import type { BrandKit } from "./brandFromUrl.js";

export type NicheCtx = {
  nicho: string;
  produto: string;
  oferta?: string;
};

const INDUSTRIAL_RE =
  /\b(epi|ppe|sst|ca\b|biometria|capacete|protetor auricular|earmuff|f[aá]brica|factory|warehouse|industrial|seguran[cç]a do trabalho|gest[aã]o de epi|hard\s*hat|plant floor|safety yellow|estoque de epi)\b/i;

const FAITH_RE =
  /\b(crist[aã]|planner|b[ií]blia|f[eé]\b|devocional|ora[cç][aã]o|gratid[aã]o|igreja|mulher|quiet time|vers[ií]culo)\b/i;

/** Workspace é claramente industrial/EPI (aí EPI é permitido). */
export function isIndustrialNiche(ctx: NicheCtx): boolean {
  return INDUSTRIAL_RE.test(`${ctx.nicho} ${ctx.produto}`);
}

export function isFaithLifestyleNiche(ctx: NicheCtx): boolean {
  return FAITH_RE.test(`${ctx.nicho} ${ctx.produto} ${ctx.oferta || ""}`);
}

/** Prompt/cena contaminada com EPI/indústria. */
export function looksIndustrialVisual(text: string): boolean {
  return INDUSTRIAL_RE.test(text);
}

/** Remove cues de research antigos (EPI) quando o produto atual não é isso. */
export function filterResearchCues(cues: string[], ctx: NicheCtx): string[] {
  if (isIndustrialNiche(ctx)) return cues.filter(Boolean);
  return cues.filter((c) => c && !looksIndustrialVisual(c));
}

/**
 * Trava o prompt visual no nicho atual.
 * Evita misturar capacete/EPI com legendas de planner.
 */
export function lockVisualToNiche(
  prompt: string,
  ctx: NicheCtx,
  brand?: BrandKit | null,
  hook?: string
): string {
  const base = (prompt || "").trim();
  if (isIndustrialNiche(ctx)) {
    return base.slice(0, 2200);
  }

  const contaminated =
    looksIndustrialVisual(base) ||
    looksIndustrialVisual(hook || "") ||
    /simplifique a gest[aã]o|comece com seguran[cç]a|controle!/i.test(base);

  const safeHook = (() => {
    const h = (hook || "").trim();
    if (!h || looksIndustrialVisual(h)) return "";
    return h.slice(0, 48);
  })();

  const scene =
    brand?.product_ui_notes?.trim() ||
    (isFaithLifestyleNiche(ctx)
      ? "Woman in calm morning quiet time: open planner or Bible, coffee, soft window light, beige terracotta tones, handwritten notes, flowers — cozy faith lifestyle, never industrial"
      : `Authentic lifestyle scene for: ${ctx.produto}. Real people and product in use. No industrial props.`);

  const rebuilt = contaminated
    ? [
        `Instagram ad for "${ctx.produto}".`,
        `Niche: ${ctx.nicho}.`,
        scene,
        safeHook ? `Bold Portuguese overlay text ONLY: "${safeHook}" (3–6 words max).` : "",
        "Warm soft editorial photo, Instagram 4:5.",
      ]
        .filter(Boolean)
        .join(" ")
    : base;

  const lock = [
    `NICHE LOCK (mandatory): product="${ctx.produto.slice(0, 120)}"; niche="${ctx.nicho.slice(0, 120)}".`,
    "EVERY object, person, prop AND on-image text MUST match this niche only.",
    "ABSOLUTELY FORBIDDEN in the photo AND in overlay typography: EPI, PPE, hard hats, earmuffs, factory, warehouse, industrial safety, SST, CA certificate, yellow safety gear, construction workers, biometria delivery.",
    "FORBIDDEN overlay words: gestão de EPI, segurança industrial, Simplifique a Gestão, Comece com Segurança (industrial sense).",
    brand?.visual_summary
      ? `Brand mood: ${brand.visual_summary.slice(0, 200)}.`
      : "",
    brand?.product_ui_notes && !contaminated
      ? `Preferred scenes: ${brand.product_ui_notes.slice(0, 220)}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `${lock} ${rebuilt}`.slice(0, 3500);
}
