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

/** Cenas industriais distintas — evita “sempre o mesmo técnico + tablet”. */
const INDUSTRIAL_SCENES = [
  "PPE delivery desk: gloved hands scanning tags, crates of safety gear, documentary close-up",
  "morning admission desk: clerk at computer station, badge printer, queue soft-focus behind",
  "auditor walkthrough: safety lead with checklist board, plant aisle blurred",
  "toolbox talk: 3–4 workers listening under shed light, tablet only briefly visible",
  "evidence moment: worker taking timestamped PPE photo on phone, racking behind",
  "control room: dual monitors with charts, cool teal ambient — no fake UI stickers",
  "loading dock: supervisor with radio, trucks/doors, cinematic wide shot",
  "hands-only macro: EPI gloves packing labeled kit, no faces",
];

export function isIndustrialNiche(
  ctx: NicheCtx | { nicho: string; produto: string; oferta?: string }
): boolean {
  return INDUSTRIAL_RE.test(`${ctx.nicho} ${ctx.produto} ${ctx.oferta || ""}`);
}

export function isFaithLifestyleNiche(
  ctx: NicheCtx | { nicho: string; produto: string; oferta?: string }
): boolean {
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
 * Industrial: operação real + cena rotativa (diversityIndex).
 */
export function lockVisualToNiche(
  prompt: string,
  ctx: NicheCtx,
  brand?: BrandKit | null,
  hook?: string,
  diversityIndex = 0
): string {
  const base = (prompt || "").trim();
  const blob = `${ctx.nicho} ${ctx.produto} ${ctx.oferta || ""} ${brand?.visual_summary || ""} ${brand?.product_ui_notes || ""}`;
  const scene =
    INDUSTRIAL_SCENES[Math.abs(diversityIndex) % INDUSTRIAL_SCENES.length];

  if (isIndustrialNiche(ctx) || /prontepi|sst|\bepi\b/i.test(blob)) {
    return [
      `NICHE LOCK INDUSTRIAL/SST: product="${ctx.produto.slice(0, 140)}"; niche="${ctx.nicho.slice(0, 120)}".`,
      `UNIQUE SCENE THIS IMAGE (must differ from sibling posts): ${scene}.`,
      "Brand mood: dark navy, deep teal, authoritative, technical — NOT cozy lifestyle.",
      "Do NOT repeat the same hard-hat portrait + glowing tablet hero every time.",
      "FORBIDDEN artwork layout: numbered feature cards 01/02/03, multi-box grids, fake Canva templates, huge CTA banners.",
      "FORBIDDEN props: Bible, planner journal, faith quiet-time, beige terracotta morning, purple SaaS gradient.",
      brand?.visual_summary
        ? `Brand colors/mood only (ignore LP layout recipes): ${brand.visual_summary.slice(0, 160)}.`
        : "",
      hook ? `On-image hook idea: "${String(hook).slice(0, 56)}".` : "",
      base,
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 3500);
  }

  if (isFaithLifestyleNiche(ctx)) {
    const faithScene =
      brand?.product_ui_notes?.trim() ||
      "Woman in calm morning quiet time: open planner or Bible, coffee, soft window light — cozy faith lifestyle";
    return [
      `NICHE LOCK FAITH: product="${ctx.produto.slice(0, 120)}".`,
      faithScene,
      "FORBIDDEN: industrial PPE, hard hats, factory, EPI management UI.",
      base,
    ]
      .join(" ")
      .slice(0, 3500);
  }

  const contaminatedFaith =
    /\b(bible|b[ií]blia|quiet time|devotional|planner journal|terracotta cozy|faith lifestyle)\b/i.test(
      base
    );
  const contaminatedIndustrial = looksIndustrialVisual(base) && !isIndustrialNiche(ctx);

  const genericScene =
    brand?.product_ui_notes?.trim() ||
    `Authentic product-in-use scene for "${ctx.produto}". Real people and context. No unrelated religious or industrial props.`;

  const rebuilt =
    contaminatedFaith || contaminatedIndustrial
      ? [
          `Instagram ad for "${ctx.produto}".`,
          `Niche: ${ctx.nicho}.`,
          genericScene,
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
