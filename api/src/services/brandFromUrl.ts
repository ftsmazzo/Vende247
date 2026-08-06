import { chatJson } from "./llm.js";

export type BrandKit = {
  site_url?: string;
  logo_url?: string;
  og_image_url?: string;
  colors?: string[];
  visual_summary?: string;
  product_ui_notes?: string;
  extracted_at?: string;
};

function absUrl(base: string, href: string | undefined | null): string | undefined {
  if (!href?.trim()) return undefined;
  try {
    return new URL(href.trim(), base).toString();
  } catch {
    return undefined;
  }
}

function metaContent(html: string, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      "i"
    );
    const m = html.match(re) || html.match(re2);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function linkHref(html: string, rel: string): string | undefined {
  const re = new RegExp(`<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]+href=["']([^"']+)["']`, "i");
  const re2 = new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${rel}[^"']*["']`, "i");
  const m = html.match(re) || html.match(re2);
  return m?.[1]?.trim();
}

function extractColors(html: string): string[] {
  const colors = new Set<string>();
  const theme = metaContent(html, "theme-color");
  if (theme && /^#?[0-9a-fA-F]{3,8}$/.test(theme.replace(/\s/g, ""))) {
    colors.add(theme.startsWith("#") ? theme : `#${theme}`);
  }
  const hexes = html.match(/#([0-9a-fA-F]{6})\b/g) ?? [];
  for (const h of hexes.slice(0, 40)) {
    colors.add(h.toLowerCase());
    if (colors.size >= 6) break;
  }
  return [...colors].slice(0, 6);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

/**
 * Lê landing/página pública e monta brand_kit (logo, cores, resumo visual via IA).
 * Não faz screenshot de app logado — use URL de marketing pública.
 */
export async function extractBrandFromUrl(siteUrl: string): Promise<BrandKit> {
  const url = siteUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL inválida. Use https://...");
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Vende247BrandBot/1.0 (+https://vende247)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Não consegui abrir o site (HTTP ${res.status}). Use uma landing pública.`);
  }
  const html = await res.text();
  const finalUrl = res.url || url;

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
  const description =
    metaContent(html, "description", "og:description", "twitter:description") || "";
  const ogImage = absUrl(finalUrl, metaContent(html, "og:image", "twitter:image"));
  const icon =
    absUrl(finalUrl, linkHref(html, "apple-touch-icon")) ||
    absUrl(finalUrl, linkHref(html, "icon")) ||
    absUrl(finalUrl, linkHref(html, "shortcut icon"));
  const colors = extractColors(html);
  const textSample = stripHtml(html);

  const ai = await chatJson<{
    visual_summary: string;
    product_ui_notes: string;
    suggested_colors: string[];
  }>(
    `Você é diretor de arte. Com base no HTML/texto de uma landing, descreva a identidade visual
para criativos de Instagram impactantes (pessoas, operação, emoção) — NÃO peça mockups de celular.
Responda JSON: {
  visual_summary: string (cores, mood, tipografia — 2-4 frases PT),
  product_ui_notes: string (o que o produto RESOLVE na operação física: entrega EPI, biometria, estoque — cenas humanas),
  suggested_colors: string[] (hex, máx 4)
}`,
    JSON.stringify(
      {
        url: finalUrl,
        title,
        description,
        colors_found: colors,
        has_og_image: Boolean(ogImage),
        text_sample: textSample.slice(0, 2500),
      },
      null,
      2
    )
  );

  const mergedColors = [...new Set([...(ai.suggested_colors || []), ...colors])]
    .filter((c) => /^#?[0-9a-fA-F]{3,8}$/.test(String(c).replace(/\s/g, "")))
    .map((c) => (String(c).startsWith("#") ? String(c) : `#${c}`))
    .slice(0, 5);

  return {
    site_url: finalUrl,
    logo_url: icon || ogImage,
    og_image_url: ogImage,
    colors: mergedColors,
    visual_summary: ai.visual_summary || description || title || "",
    product_ui_notes: ai.product_ui_notes || "",
    extracted_at: new Date().toISOString(),
  };
}
