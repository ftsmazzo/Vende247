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

/** Aceita brand_primary / brand-primary / primary. */
function tokenValueAny(tokens: unknown, keys: string[]): string | undefined {
  if (!tokens || typeof tokens !== "object") return undefined;
  const map = tokens as Record<string, { value?: string }>;
  for (const k of keys) {
    const direct = map[k]?.value;
    if (typeof direct === "string") return direct;
    const snake = map[k.replace(/-/g, "_")]?.value;
    if (typeof snake === "string") return snake;
    const kebab = map[k.replace(/_/g, "-")]?.value;
    if (typeof kebab === "string") return kebab;
  }
  return undefined;
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
  const pos =
    String(model?.generation_prompt || model?.positive_prompt || "").slice(0, 1800) ||
    String((model?.identity_signature as { summary?: string } | undefined)?.summary || "").slice(0, 1800);
  const neg =
    String(model?.negative_prompt || "").slice(0, 1200) ||
    (Array.isArray(model?.dont) ? model.dont.map(String).join(", ") : "").slice(0, 1200);
  return { positive: pos, negative: neg, palette: colors };
}

export function identityContextForLlm(model: IdentityModel | null | undefined): Record<string, unknown> | null {
  if (!model || !Object.keys(model).length) return null;
  const sig = (model.identity_signature || model.brand_signature) as Record<string, unknown> | undefined;
  const tokens = (model.design_tokens || model.tokens) as
    | { colors?: Record<string, { value?: string }> }
    | undefined;
  const colorMap: Record<string, string> = {};
  if (tokens?.colors) {
    for (const [k, v] of Object.entries(tokens.colors)) {
      if (v?.value) colorMap[k] = v.value;
    }
  }
  const doList = Array.isArray(model.do) ? model.do : Array.isArray(model.dos) ? model.dos : [];
  const dontList = Array.isArray(model.dont) ? model.dont : Array.isArray(model.donts) ? model.donts : [];
  return {
    skill: "campaign-design-apply",
    identity_summary:
      (sig?.summary as string) ||
      String((model.brand_signature as { summary?: string } | undefined)?.summary || ""),
    recognition_cues: Array.isArray(sig?.recognition_cues)
      ? sig.recognition_cues.slice(0, 8)
      : Array.isArray(sig?.recognition_signals)
        ? (sig.recognition_signals as unknown[]).slice(0, 8)
        : [],
    colors: colorMap,
    color_list: identityColors(model).slice(0, 10),
    image_treatment: model.image_treatment ?? null,
    landing_page_style_spec: model.landing_page_style_spec ?? null,
    landing_system: model.landing_system ?? null,
    do: doList.slice(0, 16),
    dont: dontList.slice(0, 16),
    generation_prompt: String(model.generation_prompt || model.positive_prompt || "").slice(0, 2200),
    negative_prompt: String(model.negative_prompt || "").slice(0, 1400),
  };
}

export type LandingSystem = {
  theme?: "dark" | "light";
  tokens?: Partial<Record<"accent" | "deep" | "ink" | "surface" | "text", string>>;
  hero_recipe?: string;
  section_order?: string[];
  effects?: string[];
  typography?: { display?: string; body?: string };
  density?: string;
  cta_style?: string;
};

export function identityLandingSystem(model: IdentityModel | null | undefined): LandingSystem | null {
  if (!model?.landing_system || typeof model.landing_system !== "object") return null;
  return model.landing_system as LandingSystem;
}

/** Logo da campanha: assets da identidade → brand kit. */
export function identityLogoUrl(
  model: IdentityModel | null | undefined,
  brandLogo?: string | null
): string | undefined {
  const assets = model?.assets as { logo_url?: string; image_urls?: string[] } | undefined;
  const fromAssets =
    (typeof assets?.logo_url === "string" && /^https?:\/\//i.test(assets.logo_url)
      ? assets.logo_url
      : null) ||
    (Array.isArray(assets?.image_urls)
      ? assets!.image_urls!.find((u) => /^https?:\/\//i.test(String(u)))
      : null);
  if (fromAssets) return String(fromAssets);
  if (brandLogo && /^https?:\/\//i.test(brandLogo)) return brandLogo;
  return undefined;
}

/**
 * Banco de imagens da identidade (URLs públicas).
 * No Kairogen, viram `params.images` → modo Editar (não gera do zero).
 * Exclui o logo para não “editar” o símbolo da marca como cena.
 */
export function identityReferenceImageUrls(
  model: IdentityModel | null | undefined,
  opts?: { excludeLogo?: boolean; limit?: number }
): string[] {
  const assets = model?.assets as { logo_url?: string; image_urls?: string[] } | undefined;
  const logo = typeof assets?.logo_url === "string" ? assets.logo_url.trim() : "";
  const urls = Array.isArray(assets?.image_urls) ? assets!.image_urls! : [];
  const out: string[] = [];
  for (const u of urls) {
    const s = String(u || "").trim();
    if (!/^https?:\/\//i.test(s)) continue;
    if (opts?.excludeLogo !== false && logo && s === logo) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, opts?.limit ?? 4);
}

/**
 * A cada geração de LP, compõe uma variante viva a partir do contrato base.
 * Mesma identidade ≠ mesmo HTML: hero, ordem, efeitos e densidade mudam.
 */
export function composeLiveLandingSystem(
  base: LandingSystem | null | undefined,
  seed = Date.now()
): LandingSystem {
  const b = base || {};
  const heroes = ["split-media", "diagonal-band", "stacked", "full-bleed"] as const;
  const densities = ["high", "medium", "airy"] as const;
  const ctas = ["pill", "square"] as const;
  const mid = ["pain", "benefits", "steps", "pillars", "angles"] as const;

  const pick = <T,>(arr: readonly T[], n: number) => arr[Math.abs(n) % arr.length];
  const shuffle = <T,>(arr: T[], n: number): T[] => {
    const a = [...arr];
    let s = n;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const hero_recipe = pick(heroes, seed);
  const density = pick(densities, Math.floor(seed / 7));
  const cta_style = pick(ctas, Math.floor(seed / 13));
  const section_order = ["hero", ...shuffle([...mid], seed), "offer"];

  const baseEffects = (b.effects || []).map((e) => String(e).toLowerCase());
  const polish = [
    "glass",
    "soft-shadow",
    "gradient-hero",
    "gradient-blobs",
    "hover-lift",
    "motion",
    "curve-divider",
  ];
  // Alterna raio: umas gerações mais redondas, outras mais tight
  if (seed % 2 === 0) polish.push("soft-radius");
  else polish.push("tight-radius");
  if (hero_recipe.includes("diagonal")) polish.push("diagonal");

  const effects = [...new Set([...baseEffects.filter((e) => !/^tight-radius|soft-radius$/.test(e)), ...polish])];

  return {
    ...b,
    hero_recipe: b.hero_recipe && seed % 5 === 0 ? b.hero_recipe : hero_recipe,
    density: b.density && seed % 5 === 0 ? b.density : density,
    cta_style: b.cta_style && seed % 5 === 0 ? b.cta_style : cta_style,
    section_order: Array.isArray(b.section_order) && b.section_order.length >= 4 && seed % 5 === 0
      ? b.section_order
      : section_order,
    effects,
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
  /** Fundo da página (sempre escuro o bastante OU claro o bastante — nunca ink-de-texto). */
  ink: string;
  surface: string;
  theme: "light" | "dark";
  text: string;
  textMuted: string;
  ctaInk: string;
};

/**
 * Tokens de design (Figma/CSS):
 * - surface = fundo de superfície/página
 * - ink = cor de texto
 * - brand_primary / brand_secondary / brand_accent = marca
 *
 * NUNCA use ink claro como background (bug clássico: texto some).
 */
export function identityPickColors(model: IdentityModel | null | undefined): LandingPalette | null {
  const tokens = (model?.design_tokens as { colors?: Record<string, { value?: string }> } | undefined)
    ?.colors;
  const list = identityColors(model)
    .map((c) => normHex(c))
    .filter(Boolean) as string[];
  if (!list.length && !tokens) return null;

  const primary = normHex(
    tokenValueAny(tokens, ["brand_primary", "brand-primary", "primary", "brand_blue"])
  );
  const secondary = normHex(
    tokenValueAny(tokens, ["brand_secondary", "brand-secondary", "secondary", "brand_green"])
  );
  const accentTok = normHex(
    tokenValueAny(tokens, ["brand_accent", "brand-accent", "accent", "brand_yellow"])
  );
  const tokenInk = normHex(tokenValueAny(tokens, ["ink", "text", "foreground"]));
  const tokenSurface = normHex(tokenValueAny(tokens, ["surface", "background", "bg", "canvas"]));

  const accent =
    accentTok ||
    [...list].sort((a, b) => luminanceGuess(b) - luminanceGuess(a)).find((c) => luminanceGuess(c) > 0.4) ||
    primary ||
    list[0] ||
    "#14B8A6";

  const deep = primary || secondary || "#0F766E";

  const inkLum = tokenInk ? luminanceGuess(tokenInk) : -1;
  const surfaceLum = tokenSurface ? luminanceGuess(tokenSurface) : -1;

  // Tema dark: surface escuro OU ink claro (texto sobre fundo escuro)
  const darkTheme =
    (surfaceLum >= 0 && surfaceLum < 0.4) ||
    (inkLum >= 0 && inkLum > 0.55 && surfaceLum >= 0 && surfaceLum < 0.55) ||
    (inkLum >= 0 && inkLum > 0.55 && !tokenSurface);

  if (darkTheme) {
    const pageBg =
      (tokenSurface && surfaceLum < 0.45 ? tokenSurface : null) ||
      (secondary && luminanceGuess(secondary) < 0.35 ? secondary : null) ||
      (primary && luminanceGuess(primary) < 0.25 ? primary : null) ||
      [...list].sort((a, b) => luminanceGuess(a) - luminanceGuess(b)).find((c) => luminanceGuess(c) < 0.3) ||
      "#0F172A";
    const pageAlt =
      list.find((c) => c !== pageBg && luminanceGuess(c) < 0.35 && luminanceGuess(c) > 0.08) ||
      secondary ||
      "#1E293B";
    const text =
      (tokenInk && inkLum > 0.55 ? tokenInk : null) ||
      list.find((c) => luminanceGuess(c) > 0.7) ||
      "#F8FAFC";
    return {
      theme: "dark",
      accent,
      deep,
      ink: pageBg,
      surface: pageAlt,
      text,
      textMuted: "rgba(248,250,252,.68)",
      ctaInk: luminanceGuess(accent) > 0.55 ? pageBg : "#FFFFFF",
    };
  }

  // Tema light: surface claro, ink escuro
  const pageBg =
    (tokenSurface && surfaceLum > 0.55 ? tokenSurface : null) ||
    list.find((c) => luminanceGuess(c) > 0.85) ||
    "#FAFAF8";
  const pageAlt =
    list.find((c) => luminanceGuess(c) > 0.72 && luminanceGuess(c) < 0.95 && c !== pageBg) || "#F1F5F9";
  const text =
    (tokenInk && inkLum < 0.45 ? tokenInk : null) ||
    list.find((c) => luminanceGuess(c) < 0.35) ||
    secondary ||
    "#0F172A";
  return {
    theme: "light",
    accent,
    deep,
    ink: pageBg,
    surface: pageAlt,
    text,
    textMuted: "rgba(15,23,42,.62)",
    ctaInk: luminanceGuess(accent) > 0.55 ? text : "#FFFFFF",
  };
}
