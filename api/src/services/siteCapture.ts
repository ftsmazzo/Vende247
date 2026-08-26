import { chatJson } from "./llm.js";

export type DesignSystemCapture = {
  source_url: string;
  ok: boolean;
  error?: string;
  tokens: {
    colors: string[];
    fonts: string[];
    radii: string[];
    shadows: string[];
  };
  patterns: {
    hero?: string;
    cards?: string;
    cta?: string;
    density?: string;
  };
  glass_or_motion: string[];
  usable_pieces: string[];
  avoid: string[];
  mood?: string;
  ui_density?: string;
  hero_style?: string;
};

const FETCH_HEADERS = {
  "User-Agent": "Vende247SiteCapture/1.0 (+https://vende247)",
  Accept: "text/html,application/xhtml+xml,text/css,*/*;q=0.8",
};

function absUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function freqTop(items: string[], n: number): string[] {
  const map = new Map<string, number>();
  for (const x of items) {
    const k = x.trim().toLowerCase();
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function extractHexColors(css: string): string[] {
  const found = css.match(/#([0-9a-fA-F]{6})\b/g) || [];
  return freqTop(
    found.map((h) => h.toLowerCase()).filter((h) => {
      // skip near-white / near-black noise unless rare — keep all and rank by freq
      return true;
    }),
    12
  );
}

function extractCssVars(css: string): string[] {
  const vars: string[] = [];
  const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const val = m[2].trim();
    if (/^#([0-9a-fA-F]{3,8})$/.test(val) || /^rgba?\(/.test(val)) {
      vars.push(`${m[1]}:${val}`);
    }
  }
  return vars.slice(0, 24);
}

function extractFonts(cssAndHtml: string): string[] {
  const fonts: string[] = [];
  const family = cssAndHtml.match(/font-family\s*:\s*([^;}{]+)/gi) || [];
  for (const f of family) {
    const raw = f.replace(/font-family\s*:\s*/i, "").replace(/["']/g, "");
    const first = raw.split(",")[0]?.trim();
    if (first && first.length > 1 && first.length < 40 && !/inherit|system-ui|sans-serif|serif|monospace/i.test(first)) {
      fonts.push(first);
    }
  }
  const gf = cssAndHtml.match(/fonts\.googleapis\.com\/css2?\?family=([^"'&\s]+)/gi) || [];
  for (const g of gf) {
    const q = g.split("family=")[1];
    if (q) fonts.push(decodeURIComponent(q.split(":")[0].replace(/\+/g, " ")));
  }
  return freqTop(fonts, 6);
}

function extractRadii(css: string): string[] {
  const found = css.match(/border-radius\s*:\s*([^;}{]+)/gi) || [];
  return freqTop(
    found.map((x) => x.replace(/border-radius\s*:\s*/i, "").trim()).filter((v) => v && v !== "0" && v !== "0px"),
    6
  );
}

function extractShadows(css: string): string[] {
  const found = css.match(/box-shadow\s*:\s*([^;}{]+)/gi) || [];
  return freqTop(
    found
      .map((x) => x.replace(/box-shadow\s*:\s*/i, "").trim())
      .filter((v) => v && !/^none$/i.test(v))
      .map((v) => v.slice(0, 80)),
    5
  );
}

function extractMotion(css: string): string[] {
  const cues: string[] = [];
  if (/backdrop-filter\s*:\s*[^;]*blur/i.test(css)) cues.push("glass-blur");
  if (/animation\s*:/i.test(css)) cues.push("css-animation");
  if (/transition\s*:[^;]{8,}/i.test(css)) cues.push("transitions");
  if (/transform\s*:\s*[^;]*scale|translate|rotate/i.test(css)) cues.push("transforms");
  if (/linear-gradient|radial-gradient/i.test(css)) cues.push("gradients");
  return cues;
}

function detectSectionPatterns(html: string): DesignSystemCapture["patterns"] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const patterns: DesignSystemCapture["patterns"] = {};
  if (/hero|headline|get started|começar|comece|agende/.test(text)) {
    patterns.hero = "hero-with-cta";
  }
  if (/como funciona|how it works|step|passo|processo/.test(text)) {
    patterns.cards = "steps-or-process";
  }
  if (/preço|pricing|plano|planos|assine|comprar/.test(text)) {
    patterns.cta = "pricing-or-offer";
  } else if (/demo|fale conosco|contato|whatsapp|agendar/.test(text)) {
    patterns.cta = "demo-contact";
  }
  const headingCount = (html.match(/<h[1-3]\b/gi) || []).length;
  patterns.density = headingCount > 12 ? "high" : headingCount > 6 ? "medium" : "airy";
  return patterns;
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function collectStylesheetUrls(html: string, base: string): string[] {
  const hrefs: string[] = [];
  const re = /<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi;
  const tags = html.match(re) || [];
  for (const tag of tags) {
    const m = tag.match(/href=["']([^"']+)["']/i);
    if (m?.[1]) {
      const abs = absUrl(base, m[1]);
      if (abs && /^https?:\/\//i.test(abs)) hrefs.push(abs);
    }
  }
  // inline @import
  const imports = html.match(/@import\s+(?:url\()?["']?([^"')\s]+)/gi) || [];
  for (const imp of imports) {
    const m = imp.match(/["']?([^"')\s]+)$/);
    if (m?.[1]) {
      const abs = absUrl(base, m[1]);
      if (abs) hrefs.push(abs);
    }
  }
  return [...new Set(hrefs)].slice(0, 8);
}

function extractInlineCss(html: string): string {
  const blocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  return blocks.map((b) => b.replace(/<\/?style[^>]*>/gi, " ")).join("\n");
}

/**
 * Captura design system de uma URL pública (fetch + HTML/CSS).
 * Não renderiza SPA com Chromium — extrai tokens e padrões do CSS/HTML servido.
 */
export async function captureDesignSystem(siteUrl: string): Promise<DesignSystemCapture> {
  const url = siteUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    return emptyCapture(url, "URL inválida");
  }

  try {
    const html = await fetchText(url);
    const finalBase = url;
    const inlineCss = extractInlineCss(html);
    const sheetUrls = collectStylesheetUrls(html, finalBase);
    const sheets: string[] = [];
    for (const sheetUrl of sheetUrls) {
      try {
        const css = await fetchText(sheetUrl, 8000);
        sheets.push(css.slice(0, 180_000));
      } catch {
        /* ignore failed stylesheet */
      }
    }
    const cssBlob = `${inlineCss}\n${sheets.join("\n")}`.slice(0, 400_000);

    const colors = [
      ...extractHexColors(cssBlob),
      ...extractHexColors(html),
    ];
    const colorTop = freqTop(colors, 10);
    const fonts = extractFonts(`${cssBlob}\n${html}`);
    const radii = extractRadii(cssBlob);
    const shadows = extractShadows(cssBlob);
    const glass_or_motion = extractMotion(cssBlob);
    const patterns = detectSectionPatterns(html);
    const cssVars = extractCssVars(cssBlob);

    const labeled = await chatJson<{
      mood: string;
      ui_density: string;
      hero_style: string;
      usable_pieces: string[];
      avoid: string[];
    }>(
      `Você é diretor de arte. A partir de sinais CSS/HTML de um site de REFERÊNCIA, rotule o design system.
NÃO copie nome, logo ou copy da marca alheia. Extraia só decisões reutilizáveis (tokens, densidade, hero, efeitos).
JSON: {
  mood: string (ex: dark-industrial, soft-editorial, bold-saas),
  ui_density: "high"|"medium"|"airy",
  hero_style: string curto,
  usable_pieces: string[] (3-8 decisões abstratas: glass, tipografia, contraste, etc.),
  avoid: string[] (o que é específico demais da marca alheia)
}`,
      JSON.stringify(
        {
          source_url: url,
          colors: colorTop,
          fonts,
          radii,
          shadows: shadows.slice(0, 4),
          css_vars_sample: cssVars.slice(0, 16),
          glass_or_motion,
          patterns,
          text_sample: html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 1200),
        },
        null,
        2
      ),
      1800
    );

    return {
      source_url: url,
      ok: true,
      tokens: {
        colors: colorTop,
        fonts,
        radii,
        shadows: shadows.slice(0, 5),
      },
      patterns,
      glass_or_motion,
      usable_pieces: (labeled.usable_pieces || []).map(String).slice(0, 8),
      avoid: (labeled.avoid || []).map(String).slice(0, 6),
      mood: labeled.mood,
      ui_density: labeled.ui_density || patterns.density,
      hero_style: labeled.hero_style,
    };
  } catch (err) {
    return emptyCapture(url, err instanceof Error ? err.message : String(err));
  }
}

function emptyCapture(url: string, error: string): DesignSystemCapture {
  return {
    source_url: url,
    ok: false,
    error,
    tokens: { colors: [], fonts: [], radii: [], shadows: [] },
    patterns: {},
    glass_or_motion: [],
    usable_pieces: [],
    avoid: [],
  };
}

export async function captureManyDesignSystems(urls: string[], max = 3): Promise<DesignSystemCapture[]> {
  const unique = [...new Set(urls.filter((u) => /^https?:\/\//i.test(u)))].slice(0, max);
  const out: DesignSystemCapture[] = [];
  for (const u of unique) {
    out.push(await captureDesignSystem(u));
  }
  return out;
}
