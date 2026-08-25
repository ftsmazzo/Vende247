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

function luminanceGuess(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function normHex(c: string | undefined): string | null {
  if (!c) return null;
  const h = c.startsWith("#") ? c.toLowerCase() : `#${c.toLowerCase()}`;
  return /^#[0-9a-f]{6}$/.test(h) ? h : null;
}

export type LandingPalette = {
  accent: string;
  deep: string;
  ink: string;
  surface: string;
  theme: "light" | "dark";
  text: string;
  textMuted: string;
  ctaInk: string;
};

export function identityPickColors(model: IdentityModel | null | undefined): LandingPalette | null {
  const tokens = (model?.design_tokens as { colors?: Record<string, { value?: string }> } | undefined)?.colors;
  const list = identityColors(model).map((c) => normHex(c)).filter(Boolean) as string[];
  if (!list.length && !tokens) return null;

  const tokenInk = normHex(tokenValue(tokens, "ink"));
  const tokenSurface = normHex(tokenValue(tokens, "surface"));
  const tokenPrimary = normHex(tokenValue(tokens, "brand_primary"));
  const tokenAccent =
    normHex(tokenValue(tokens, "brand_accent")) ||
    normHex(tokenValue(tokens, "brand_yellow"));
  const tokenSecondary = normHex(tokenValue(tokens, "brand_secondary"));

  const vivid = [...list].sort((a, b) => luminanceGuess(b) - luminanceGuess(a));
  const accent =
    tokenAccent ||
    vivid.find((c) => luminanceGuess(c) > 0.35) ||
    tokenPrimary ||
    list[0] ||
    "#C4A484";
  const deep =
    tokenSecondary ||
    tokenPrimary ||
    [...list].sort((a, b) => luminanceGuess(a) - luminanceGuess(b)).find((c) => luminanceGuess(c) < 0.45) ||
    "#3D5A50";

  // Tokens de design: surface = fundo da página, ink = cor do texto (escuro)
  const surfaceIsPage = tokenSurface && luminanceGuess(tokenSurface) > 0.55;
  const inkIsText = tokenInk && luminanceGuess(tokenInk) < 0.45;

  if (surfaceIsPage || (inkIsText && tokenSurface)) {
    const pageBg = surfaceIsPage ? tokenSurface! : "#FAFAF8";
    const pageAlt =
      list.find((c) => luminanceGuess(c) > 0.72 && luminanceGuess(c) < 0.96 && c !== pageBg) ||
      "#F0EDE8";
    const text = inkIsText ? tokenInk! : "#1A1410";
    return {
      theme: "light",
      accent,
      deep,
      ink: pageBg,
      surface: pageAlt,
      text,
      textMuted: "rgba(26,20,16,.62)",
      ctaInk: luminanceGuess(accent) > 0.55 ? deep : "#FFFFFF",
    };
  }

  const darkCandidates = [tokenPrimary, tokenSecondary, tokenInk, tokenSurface, ...list].filter(
    (c): c is string => Boolean(c && luminanceGuess(c) < 0.22)
  );
  const ink = darkCandidates[0] || "#1A1410";
  const surface =
    darkCandidates.find((c) => c !== ink && luminanceGuess(c) < 0.28) || "#120E0C";

  return {
    theme: "dark",
    accent,
    deep,
    ink,
    surface,
    text: "#F4F6F5",
    textMuted: "rgba(244,246,245,.68)",
    ctaInk: luminanceGuess(accent) > 0.55 ? deep : ink,
  };
}
