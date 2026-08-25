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

export function identityPromptBlock(model: IdentityModel | null | undefined): string {
  if (!model || !Object.keys(model).length) return "";
  const spec = model.landing_page_style_spec;
  const doList = (model as { do?: string[] }).do || [];
  const dont = (model as { dont?: string[] }).dont || [];
  return JSON.stringify({
    skill: "campaign-design-apply",
    identity_summary:
      (model.identity_signature as { summary?: string } | undefined)?.summary || "",
    generation_prompt: String(model.generation_prompt || "").slice(0, 1200),
    negative_prompt: String(model.negative_prompt || "").slice(0, 800),
    landing_page_style_spec: spec,
    do: doList.slice(0, 12),
    dont: dont.slice(0, 12),
    colors: identityColors(model).slice(0, 8),
  });
}

export function identityPickColors(model: IdentityModel | null | undefined): {
  accent: string;
  deep: string;
  ink: string;
  surface: string;
} | null {
  const tokens = (model?.design_tokens as { colors?: unknown } | undefined)?.colors;
  const yellow = tokenValue(tokens, "brand_yellow");
  const blue = tokenValue(tokens, "brand_blue");
  const ink = tokenValue(tokens, "ink");
  const surface = tokenValue(tokens, "surface");
  if (!yellow && !blue) return null;
  return {
    accent: yellow || "#FFCB05",
    deep: blue || "#005BAA",
    ink: ink || blue || "#12324A",
    surface: surface || "#0A1F33",
  };
}
