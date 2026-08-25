import type { BrandKit } from "./brandFromUrl.js";

export type IdentityModel = Record<string, unknown>;

export type IdentityVersion = {
  id: number;
  campaign_id: number;
  version: number;
  source: string;
  model: IdentityModel;
  css: string;
  status: string;
  confidence: string;
};

function tokenValue(tokens: unknown, key: string): string | undefined {
  if (!tokens || typeof tokens !== "object") return undefined;
  const node = (tokens as Record<string, { value?: string }>)[key];
  return typeof node?.value === "string" ? node.value : undefined;
}

export function identityColors(model: IdentityModel | null | undefined): string[] {
  const colors = (model?.design_tokens as { colors?: Record<string, { value?: string }> } | undefined)
    ?.colors;
  if (!colors) return [];
  return Object.values(colors)
    .map((c) => c?.value)
    .filter((v): v is string => typeof v === "string" && /^#/.test(v));
}

export function identityToBrandKit(model: IdentityModel | null | undefined): BrandKit {
  const sig = model?.identity_signature as { summary?: string } | undefined;
  const img = model?.image_treatment as { observed?: string; hero_recipe?: string } | undefined;
  return {
    colors: identityColors(model),
    visual_summary: sig?.summary || "",
    product_ui_notes: [img?.observed, img?.hero_recipe].filter(Boolean).join(" "),
    source: "manual",
    extracted_at: new Date().toISOString(),
  };
}

export function identityLooksCampaignLayout(model: IdentityModel | null | undefined): boolean {
  if (!model) return false;
  const num = String((model.candidate as { number?: string } | undefined)?.number || "");
  return num === "22";
}

export function identityGenerationHints(model: IdentityModel | null | undefined): {
  positive: string;
  negative: string;
  palette: string;
} {
  const colors = identityColors(model).slice(0, 5).join(", ");
  return {
    positive: String(model?.generation_prompt || "").slice(0, 1800),
    negative: String(model?.negative_prompt || "").slice(0, 1200),
    palette: colors,
  };
}

export function identityContextForLlm(model: IdentityModel | null | undefined): Record<string, unknown> | null {
  if (!model || !Object.keys(model).length) return null;
  const sig = model.identity_signature as Record<string, unknown> | undefined;
  const tokens = model.design_tokens as { colors?: Record<string, { value?: string }> } | undefined;
  const colorMap: Record<string, string> = {};
  if (tokens?.colors) {
    for (const [k, v] of Object.entries(tokens.colors)) {
      if (v?.value) colorMap[k] = v.value;
    }
  }
  return {
    skill: "campaign-design-apply",
    candidate: model.candidate ?? null,
    campaign_label: (model.campaign as { label?: string } | undefined)?.label ?? null,
    identity_summary: sig?.summary || "",
    recognition_cues: Array.isArray(sig?.recognition_cues) ? sig.recognition_cues.slice(0, 8) : [],
    colors: colorMap,
    color_list: identityColors(model).slice(0, 10),
    hierarchy_rules: model.hierarchy_rules ?? null,
    image_treatment: model.image_treatment ?? null,
    iconography_and_graphics: model.iconography_and_graphics ?? null,
    landing_page_style_spec: model.landing_page_style_spec ?? null,
    responsive_strategy: model.responsive_strategy ?? null,
    do: Array.isArray(model.do) ? model.do.slice(0, 16) : [],
    dont: Array.isArray(model.dont) ? model.dont.slice(0, 16) : [],
    generation_prompt: String(model.generation_prompt || "").slice(0, 2200),
    negative_prompt: String(model.negative_prompt || "").slice(0, 1400),
    acceptance_criteria: model.acceptance_criteria ?? null,
  };
}

export function identityPromptBlock(model: IdentityModel | null | undefined): string {
  const ctx = identityContextForLlm(model);
  return ctx ? JSON.stringify(ctx) : "";
}

export function identityPickColors(model: IdentityModel | null | undefined): {
  accent: string;
  deep: string;
  ink: string;
  surface: string;
} | null {
  const tokens = (model?.design_tokens as { colors?: unknown } | undefined)?.colors;
  const yellow = tokenValue(tokens, "brand_yellow") || tokenValue(tokens, "brand_accent");
  const blue =
    tokenValue(tokens, "brand_blue") ||
    tokenValue(tokens, "brand_primary") ||
    tokenValue(tokens, "ink");
  const green = tokenValue(tokens, "brand_green") || tokenValue(tokens, "brand_secondary");
  const ink = tokenValue(tokens, "ink");
  const surface = tokenValue(tokens, "surface");
  const list = identityColors(model);
  if (!yellow && !blue && list.length < 2) return null;
  return {
    accent: yellow || list.find((c) => luminanceGuess(c) > 0.4) || green || "#FFCB05",
    deep: blue || list.find((c) => luminanceGuess(c) < 0.25) || "#005BAA",
    ink: ink || blue || "#005BAA",
    surface: surface || "#003D73",
  };
}

function luminanceGuess(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
