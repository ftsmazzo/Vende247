import { chatJson } from "./llm.js";
import type { BrandKit } from "./brandFromUrl.js";
import type { ResearchReport, WorkspaceContext } from "./research.js";
import { gerarImagemViral } from "./imageGen.js";
import { isStorageConfigured } from "./storage.js";

export type LandingCopy = {
  brand_name: string;
  eyebrow: string;
  headline: string;
  headline_accent: string;
  subheadline: string;
  hero_cta: string;
  hero_cta_secondary: string;
  pain_title: string;
  pains: string[];
  solution_title: string;
  benefits: Array<{ title: string; body: string }>;
  proof_title: string;
  proof_items: string[];
  offer_title: string;
  offer_body: string;
  final_cta: string;
  final_sub: string;
  whatsapp_hint: string;
  whatsapp_url?: string;
  seo_title: string;
  seo_description: string;
};

export type LandingResult = {
  html: string;
  meta: {
    brand_name: string;
    headline: string;
    hero_image_url?: string;
    colors: string[];
  };
};

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function saturation(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const max = Math.max(rgb.r, rgb.g, rgb.b) / 255;
  const min = Math.min(rgb.r, rgb.g, rgb.b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

/** Accent deve ser claro/vivo — nunca cinza-azulado escuro do theme-color. */
function pickColors(brand?: BrandKit | null): {
  accent: string;
  deep: string;
  ink: string;
  glow: string;
} {
  const raw = (brand?.colors ?? [])
    .map((c) => (c.startsWith("#") ? c.toLowerCase() : `#${c}`.toLowerCase()))
    .filter((c) => parseHex(c));

  const bright = raw
    .filter((c) => luminance(c) > 0.22 && saturation(c) > 0.25)
    .sort((a, b) => saturation(b) + luminance(b) * 0.5 - (saturation(a) + luminance(a) * 0.5));

  const darks = raw
    .filter((c) => luminance(c) < 0.2)
    .sort((a, b) => luminance(a) - luminance(b));

  const accent = bright[0] || "#B8F23A";
  const deep = darks[0] || "#0B3D3A";
  const ink = darks[1] || darks[0] || "#061412";
  return { accent, deep, ink, glow: accent };
}

const ICONS = [
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="9" r="3.5"/><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/><path d="M19 4l1 2 2 .5-1.5 1.5.5 2-2-1-2 1 .5-2L16 6.5 18 6l1-2z"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7.5" opacity=".45"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M8 5v14M14 14h3"/></svg>`,
];

const PAIN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 4.3L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z"/></svg>`;
const PROOF_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7L9 18l-5-5"/></svg>`;

function resolveCtaUrl(ctx: WorkspaceContext, copy: LandingCopy): string {
  const candidates = [copy.whatsapp_url, ctx.cta];
  for (const c of candidates) {
    const t = (c || "").trim();
    if (/^https?:\/\//i.test(t)) return t;
    if (/^wa\.me\//i.test(t)) return `https://${t}`;
    const digits = t.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13) {
      return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
    }
  }
  return "#contato";
}

export function renderLandingHtml(
  copy: LandingCopy,
  opts: {
    colors: { accent: string; deep: string; ink: string; glow: string };
    logoUrl?: string;
    heroUrl?: string;
    ctaUrl: string;
  }
): string {
  const { accent, deep, ink, glow } = opts.colors;
  const ctaHref = opts.ctaUrl;
  const logo = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="${esc(copy.brand_name)}" class="logo" />`
    : `<span class="logo-text">${esc(copy.brand_name)}</span>`;

  const headMain = esc(copy.headline).replace(/\n/g, "<br/>");
  const headAccent = copy.headline_accent
    ? `<span class="accent-line">${esc(copy.headline_accent)}</span>`
    : "";

  const pains = copy.pains
    .slice(0, 4)
    .map(
      (p) =>
        `<li class="glass-row"><span class="ico">${PAIN_ICON}</span><span>${esc(p)}</span></li>`
    )
    .join("");

  const benefits = copy.benefits
    .slice(0, 4)
    .map(
      (b, i) =>
        `<article class="benefit glass">
          <div class="ico-wrap">${ICONS[i % ICONS.length]}</div>
          <h3>${esc(b.title)}</h3>
          <p>${esc(b.body)}</p>
        </article>`
    )
    .join("");

  const proofs = copy.proof_items
    .slice(0, 4)
    .map(
      (p) =>
        `<li class="proof-pill glass"><span class="ico">${PROOF_ICON}</span>${esc(p)}</li>`
    )
    .join("");

  const heroMedia = opts.heroUrl
    ? `<div class="hero-media" style="background-image:url('${esc(opts.heroUrl)}')"></div>`
    : `<div class="hero-media hero-media--fallback"></div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(copy.seo_title || copy.headline)}</title>
<meta name="description" content="${esc(copy.seo_description || copy.subheadline)}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
:root{
  --accent:${accent};
  --deep:${deep};
  --ink:${ink};
  --glow:${glow};
  --paper:#F3F7F5;
  --muted:rgba(243,247,245,.72);
  --glass:rgba(255,255,255,.08);
  --glass-border:rgba(255,255,255,.16);
  --radius:1.35rem;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  font-family:"Manrope",system-ui,sans-serif;
  background:var(--ink);
  color:var(--paper);
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}
a{color:inherit;text-decoration:none}
.wrap{width:min(1140px,92vw);margin:0 auto}
.ico,.ico-wrap svg{width:1.35rem;height:1.35rem;display:block;flex-shrink:0}
.ico-wrap{
  width:2.75rem;height:2.75rem;border-radius:1rem;
  display:grid;place-items:center;
  background:color-mix(in srgb,var(--accent) 18%,transparent);
  color:var(--accent);margin-bottom:1rem;
  border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);
}
.glass{
  background:linear-gradient(145deg,rgba(255,255,255,.1),rgba(255,255,255,.03));
  border:1px solid var(--glass-border);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  border-radius:var(--radius);
  box-shadow:0 20px 50px rgba(0,0,0,.25);
}
.topbar{
  position:sticky;top:0;z-index:40;
  padding:.85rem 0;
  background:rgba(6,20,18,.55);
  backdrop-filter:blur(18px);
  -webkit-backdrop-filter:blur(18px);
  border-bottom:1px solid rgba(255,255,255,.08);
}
.brand{display:flex;align-items:center;justify-content:space-between;gap:1rem}
.logo{height:42px;width:auto;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,.35))}
.logo-text{font-family:"Syne",sans-serif;font-weight:800;font-size:1.45rem;letter-spacing:-.02em;color:var(--accent)}
.nav-cta{
  font-size:.82rem;font-weight:800;padding:.65rem 1.1rem;
  border-radius:999px;background:var(--accent);color:var(--ink);
  box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 40%,transparent),0 8px 28px color-mix(in srgb,var(--accent) 35%,transparent);
}
.hero{
  position:relative;min-height:min(92vh,920px);
  display:grid;align-items:end;
  padding:2.5rem 0 4.5rem;
  isolation:isolate;
}
.hero-media{
  position:absolute;inset:0;z-index:-2;
  background-size:cover;background-position:center 30%;
  transform:scale(1.02);
}
.hero-media--fallback{
  background:
    radial-gradient(80% 60% at 80% 20%, color-mix(in srgb,var(--accent) 35%,transparent), transparent 55%),
    linear-gradient(160deg,var(--ink),var(--deep) 50%,#020a09);
}
.hero::before{
  content:"";position:absolute;inset:0;z-index:-1;
  background:
    linear-gradient(105deg,rgba(4,14,12,.94) 0%,rgba(4,14,12,.78) 42%,rgba(4,14,12,.35) 70%,rgba(4,14,12,.55) 100%),
    radial-gradient(60% 50% at 15% 85%, color-mix(in srgb,var(--accent) 22%,transparent), transparent 60%);
}
.hero-inner{max-width:40rem;padding-top:1rem}
.eyebrow{
  display:inline-flex;align-items:center;gap:.5rem;
  font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--accent);
  padding:.45rem .85rem;border-radius:999px;
  background:color-mix(in srgb,var(--accent) 12%,transparent);
  border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);
  margin-bottom:1.15rem;
}
.hero h1{
  font-family:"Syne",sans-serif;font-weight:800;
  font-size:clamp(2.6rem,7.2vw,4.85rem);
  line-height:.98;letter-spacing:-.03em;margin:0 0 1.1rem;
  text-wrap:balance;
}
.accent-line{display:block;color:var(--accent);margin-top:.15em}
.hero .lead{
  font-size:clamp(1.05rem,2vw,1.22rem);color:var(--muted);
  max-width:34rem;margin-bottom:1.85rem;font-weight:500;
}
.cta-row{display:flex;flex-wrap:wrap;gap:.85rem;align-items:center}
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:.55rem;
  background:var(--accent);color:var(--ink);
  font-weight:800;font-size:1rem;padding:1rem 1.45rem;
  border-radius:999px;border:0;cursor:pointer;
  box-shadow:0 12px 40px color-mix(in srgb,var(--accent) 32%,transparent);
  transition:transform .2s ease, box-shadow .2s ease;
}
.btn:hover{transform:translateY(-2px);box-shadow:0 16px 48px color-mix(in srgb,var(--accent) 42%,transparent)}
.btn-ghost{
  background:transparent;color:var(--paper);
  border:1px solid rgba(255,255,255,.28);
  box-shadow:none;backdrop-filter:blur(8px);
}
.btn-ghost:hover{background:rgba(255,255,255,.06);box-shadow:none}
.section{padding:5.25rem 0;position:relative}
.section h2{
  font-family:"Syne",sans-serif;font-weight:800;
  font-size:clamp(2rem,4.5vw,3.1rem);
  line-height:1.05;letter-spacing:-.03em;margin-bottom:1.75rem;max-width:18ch;
}
.pain{background:linear-gradient(180deg,color-mix(in srgb,var(--ink) 70%,#000),var(--ink))}
.pain-list{list-style:none;display:grid;gap:.9rem;max-width:44rem}
.glass-row{
  display:flex;gap:1rem;align-items:flex-start;
  padding:1.15rem 1.25rem;border-radius:1.15rem;
  background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.1);
  font-size:1.05rem;font-weight:600;
}
.glass-row .ico{color:var(--accent);margin-top:.15rem}
.benefits{
  display:grid;gap:1.1rem;
  grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
}
.benefit{padding:1.45rem 1.35rem}
.benefit h3{font-family:"Syne",sans-serif;font-size:1.2rem;margin-bottom:.45rem;letter-spacing:-.02em}
.benefit p{color:var(--muted);font-size:.95rem;font-weight:500}
.proof-grid{list-style:none;display:grid;gap:.85rem;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.proof-pill{
  display:flex;gap:.75rem;align-items:flex-start;
  padding:1.15rem 1.2rem;font-weight:650;font-size:.98rem;
}
.proof-pill .ico{color:var(--accent);margin-top:.1rem}
.offer-band{
  margin:0 auto;width:min(1140px,92vw);
  padding:2.4rem;border-radius:1.75rem;
  background:
    radial-gradient(80% 120% at 100% 0%, color-mix(in srgb,var(--accent) 28%,transparent), transparent 55%),
    linear-gradient(135deg,var(--deep), color-mix(in srgb,var(--ink) 40%,var(--deep)));
  border:1px solid color-mix(in srgb,var(--accent) 28%,transparent);
  box-shadow:0 30px 80px rgba(0,0,0,.35);
}
.offer-band p{color:var(--muted);margin:1rem 0 1.5rem;font-size:1.08rem;max-width:36rem;font-weight:500}
.final{text-align:center;padding:5.5rem 0 4.5rem}
.final h2{max-width:16ch;margin:0 auto 1rem}
.final .sub{color:var(--muted);margin-bottom:1.75rem;max-width:34rem;margin-left:auto;margin-right:auto}
.hint{display:block;margin-top:1.1rem;font-size:.88rem;color:var(--muted)}
footer{padding:2rem 0 3rem;border-top:1px solid rgba(255,255,255,.08);color:var(--muted);font-size:.8rem;text-align:center}
@media (max-width:720px){
  .hero{min-height:88vh;padding-bottom:3.2rem}
  .offer-band{padding:1.6rem}
  .nav-cta{font-size:.72rem;padding:.55rem .85rem}
}
@keyframes floatIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.hero-inner,.benefit,.glass-row,.proof-pill,.offer-band{animation:floatIn .7s ease both}
.benefit:nth-child(2){animation-delay:.06s}
.benefit:nth-child(3){animation-delay:.12s}
.benefit:nth-child(4){animation-delay:.18s}
</style>
</head>
<body>
<div class="topbar">
  <div class="wrap brand">${logo}<a class="nav-cta" href="${esc(ctaHref)}">${esc(copy.hero_cta)}</a></div>
</div>
<header class="hero">
  ${heroMedia}
  <div class="wrap hero-inner">
    ${copy.eyebrow ? `<div class="eyebrow">${esc(copy.eyebrow)}</div>` : ""}
    <h1>${headMain}${headAccent}</h1>
    <p class="lead">${esc(copy.subheadline)}</p>
    <div class="cta-row">
      <a class="btn" href="${esc(ctaHref)}">${esc(copy.hero_cta)}</a>
      <a class="btn btn-ghost" href="#dor">${esc(copy.hero_cta_secondary || "Ver as dores")}</a>
    </div>
  </div>
</header>
<section class="section pain" id="dor">
  <div class="wrap">
    <h2>${esc(copy.pain_title)}</h2>
    <ul class="pain-list">${pains}</ul>
  </div>
</section>
<section class="section" id="solucao">
  <div class="wrap">
    <h2>${esc(copy.solution_title)}</h2>
    <div class="benefits">${benefits}</div>
  </div>
</section>
<section class="section" id="prova">
  <div class="wrap">
    <h2>${esc(copy.proof_title)}</h2>
    <ul class="proof-grid">${proofs}</ul>
  </div>
</section>
<section class="section" id="oferta" style="padding-top:1rem">
  <div class="offer-band" id="contato">
    <h2>${esc(copy.offer_title)}</h2>
    <p>${esc(copy.offer_body)}</p>
    <a class="btn" href="${esc(ctaHref)}">${esc(copy.final_cta)}</a>
    <span class="hint">${esc(copy.whatsapp_hint)}</span>
  </div>
</section>
<section class="final">
  <div class="wrap">
    <h2>${esc(copy.final_cta)}</h2>
    <p class="sub">${esc(copy.final_sub)}</p>
    <a class="btn" href="${esc(ctaHref)}">${esc(copy.hero_cta)}</a>
  </div>
</section>
<footer><div class="wrap">${esc(copy.brand_name)} · gerado com Vende247</div></footer>
</body>
</html>`;
}

export async function generateLanding(opts: {
  ctx: WorkspaceContext;
  report?: ResearchReport | null;
  brand?: BrandKit | null;
  withHeroImage?: boolean;
}): Promise<LandingResult> {
  const { ctx, report, brand } = opts;
  const colors = pickColors(brand);

  const copy = await chatJson<LandingCopy>(
    `Você é copywriter sênior de landing pages B2B de alta conversão (Brasil, 2026), estilo anúncio viral.
Tom: direto, afiado, específico do produto — NÃO genérico SaaS.

REGRAS DE COPY:
- eyebrow: 4–8 palavras com gancho (dor ou mecanismo único)
- headline: punchy, máx 10 palavras; pode usar \\n
- headline_accent: 2–5 palavras que completam o impacto (vai em destaque colorido)
- subheadline: 1 frase concreta com benefício mensurável ou mecanismo (biometria, CA, multi-cliente…)
- hero_cta: CTA curto e forte (ex.: "Quero demonstração no WhatsApp")
- hero_cta_secondary: CTA secundário suave (ex.: "Ver se isso é pra mim")
- pains: 4 dores ESPECÍFICAS (auditoria, CA vencido, planilha, multas) — sem "falta de eficiência" vago
- benefits: 4 itens com título curto + body concreto
- proof_items: 3–4 provas/mecanismos (sem inventar % falsos)
- offer_*: oferta/demo clara
- whatsapp_hint: frase do que digitar no WhatsApp
- whatsapp_url: se houver número no contexto use https://wa.me/55... senão omita
PROIBIDO: "revolucione", "solução completa", "otimize sua gestão", "transforme sua empresa" soltos.

JSON estrito com:
brand_name, eyebrow, headline, headline_accent, subheadline, hero_cta, hero_cta_secondary,
pain_title, pains[], solution_title, benefits[{title,body}], proof_title, proof_items[],
offer_title, offer_body, final_cta, final_sub, whatsapp_hint, whatsapp_url?, seo_title, seo_description.`,
    JSON.stringify(
      {
        workspace: ctx,
        research: report
          ? {
              resumo: report.resumo,
              oportunidades_unicas: report.oportunidades_unicas,
              hooks_vencedores: report.hooks_vencedores,
              ctas_comuns: report.ctas_comuns,
              direcao_visual: report.direcao_visual,
            }
          : null,
        brand: brand
          ? { colors: brand.colors, visual_summary: brand.visual_summary }
          : null,
      },
      null,
      2
    )
  );

  copy.brand_name = copy.brand_name || ctx.produto.split(/[—\-–]/)[0]?.trim() || "Produto";
  copy.pains = Array.isArray(copy.pains) ? copy.pains : [];
  copy.benefits = Array.isArray(copy.benefits) ? copy.benefits : [];
  copy.proof_items = Array.isArray(copy.proof_items) ? copy.proof_items : [];
  copy.eyebrow = copy.eyebrow || "Gestão de EPI com prova real";
  copy.headline = copy.headline || "Pare de perder auditoria";
  copy.headline_accent = copy.headline_accent || "por falta de prova.";
  copy.subheadline =
    copy.subheadline ||
    "Biometria na entrega, CA sob controle e multi-cliente num só fluxo.";
  copy.hero_cta = copy.hero_cta || "Quero demonstração";
  copy.hero_cta_secondary = copy.hero_cta_secondary || "Ver as dores";
  copy.final_cta = copy.final_cta || copy.hero_cta;
  copy.whatsapp_hint =
    copy.whatsapp_hint || ctx.cta || "Chama no WhatsApp e peça uma demo do ProntEPI";

  let heroUrl: string | undefined;
  if (opts.withHeroImage !== false && isStorageConfigured()) {
    try {
      heroUrl = await gerarImagemViral(
        `Cinematic wide industrial safety photo for landing hero, workers in hard hats and EPI on factory floor, dramatic light, NO text overlay, NO logos, NO phone mockups, shallow depth, powerful atmosphere for ${ctx.produto}`,
        brand
      );
    } catch {
      heroUrl = brand?.og_image_url || undefined;
    }
  } else {
    heroUrl = brand?.og_image_url || undefined;
  }

  const ctaUrl = resolveCtaUrl(ctx, copy);

  const html = renderLandingHtml(copy, {
    colors,
    logoUrl: brand?.logo_url,
    heroUrl,
    ctaUrl,
  });

  return {
    html,
    meta: {
      brand_name: copy.brand_name,
      headline: `${copy.headline} ${copy.headline_accent}`.trim(),
      hero_image_url: heroUrl,
      colors: [colors.accent, colors.deep, colors.ink],
    },
  };
}
