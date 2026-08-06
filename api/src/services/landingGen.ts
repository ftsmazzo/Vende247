import { chatJson } from "./llm.js";
import type { BrandKit } from "./brandFromUrl.js";
import type { ResearchReport, WorkspaceContext } from "./research.js";
import type { StrategyPlan } from "./strategy.js";
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
  audience: string;
  differentiator: string;
  pain_title: string;
  pains: string[];
  solution_title: string;
  benefits: Array<{ title: string; body: string }>;
  how_title: string;
  how_steps: Array<{ title: string; body: string }>;
  pillars_title: string;
  pillars: Array<{ title: string; body: string }>;
  angles_title: string;
  angles: string[];
  proof_title: string;
  proof_items: string[];
  metrics: Array<{ value: string; label: string }>;
  faq_title: string;
  faq: Array<{ q: string; a: string }>;
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
    sources: { research: boolean; strategy: boolean };
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

/** Fundo quase preto; accent só cor viva; deep = teal escuro de apoio. */
function pickColors(brand?: BrandKit | null): {
  accent: string;
  deep: string;
  ink: string;
  surface: string;
} {
  const raw = (brand?.colors ?? [])
    .map((c) => (c.startsWith("#") ? c.toLowerCase() : `#${c}`.toLowerCase()))
    .filter((c) => parseHex(c));

  const bright = raw
    .filter((c) => luminance(c) > 0.35 && saturation(c) > 0.2)
    .sort((a, b) => saturation(b) - saturation(a));

  const midDark = raw
    .filter((c) => luminance(c) < 0.25 && saturation(c) > 0.15)
    .sort((a, b) => saturation(b) - saturation(a));

  return {
    accent: bright[0] || "#D4F34A",
    deep: midDark[0] || "#0E3D38",
    ink: "#060908",
    surface: "#0C1412",
  };
}

const ICONS = [
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="9" r="3.2"/><path d="M5 20c1.5-3.2 4-4.8 7-4.8s5.5 1.6 7 4.8"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".4"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M8 5v14"/></svg>`,
];
const WARN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 9v4M12 17h.01"/><path d="M10.3 4.3L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7L9 18l-5-5"/></svg>`;

function resolveCtaUrl(ctx: WorkspaceContext, copy: LandingCopy): string {
  for (const c of [copy.whatsapp_url, ctx.cta]) {
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

function shortCta(label: string): string {
  const t = label.trim();
  if (t.length <= 36) return t;
  if (/whatsapp|wa\.me|direct|demo|demonstra/i.test(t)) return "Quero uma demonstração";
  return t.slice(0, 34) + "…";
}

export function renderLandingHtml(
  copy: LandingCopy,
  opts: {
    colors: { accent: string; deep: string; ink: string; surface: string };
    logoUrl?: string;
    heroUrl?: string;
    ctaUrl: string;
    concorrentes: string[];
  }
): string {
  const { accent, deep, ink, surface } = opts.colors;
  const ctaHref = opts.ctaUrl;
  const ctaPrimary = shortCta(copy.hero_cta);
  const ctaFinal = shortCta(copy.final_cta || copy.hero_cta);

  const logo = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="${esc(copy.brand_name)}" class="logo" />`
    : `<span class="logo-text">${esc(copy.brand_name)}</span>`;

  const pains = (copy.pains || [])
    .slice(0, 5)
    .map(
      (p, i) =>
        `<li class="pain-item"><span class="num">0${i + 1}</span><span class="ico">${WARN}</span><p>${esc(p)}</p></li>`
    )
    .join("");

  const benefits = (copy.benefits || [])
    .slice(0, 4)
    .map(
      (b, i) =>
        `<article class="card">
          <div class="ico-wrap">${ICONS[i % ICONS.length]}</div>
          <h3>${esc(b.title)}</h3>
          <p>${esc(b.body)}</p>
        </article>`
    )
    .join("");

  const steps = (copy.how_steps || [])
    .slice(0, 4)
    .map(
      (s, i) =>
        `<li class="step"><span class="step-n">${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div></li>`
    )
    .join("");

  const pillars = (copy.pillars || [])
    .slice(0, 4)
    .map(
      (p) =>
        `<article class="pillar"><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></article>`
    )
    .join("");

  const angles = (copy.angles || [])
    .slice(0, 6)
    .map((a) => `<li><span class="ico">${CHECK}</span>${esc(a)}</li>`)
    .join("");

  const proofs = (copy.proof_items || [])
    .slice(0, 4)
    .map((p) => `<li class="proof"><span class="ico">${CHECK}</span>${esc(p)}</li>`)
    .join("");

  const metrics = (copy.metrics || [])
    .slice(0, 4)
    .map(
      (m) =>
        `<div class="metric"><strong>${esc(m.value)}</strong><span>${esc(m.label)}</span></div>`
    )
    .join("");

  const faq = (copy.faq || [])
    .slice(0, 5)
    .map(
      (f) =>
        `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`
    )
    .join("");

  const comps = (opts.concorrentes || [])
    .slice(0, 6)
    .map((c) => `<span class="chip">@${esc(c.replace(/^@/, ""))}</span>`)
    .join("");

  const heroMedia = opts.heroUrl
    ? `<div class="hero-media" style="background-image:url('${esc(opts.heroUrl)}')" role="img" aria-label="Ambiente industrial"></div>`
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
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
:root{
  --accent:${accent};
  --deep:${deep};
  --ink:${ink};
  --surface:${surface};
  --paper:#F4F6F5;
  --muted:rgba(244,246,245,.68);
  --line:rgba(255,255,255,.10);
  --radius:1.25rem;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  font-family:"Outfit",system-ui,sans-serif;
  background:var(--ink);
  color:var(--paper);
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
}
a{color:inherit;text-decoration:none}
.wrap{width:min(1120px,90vw);margin:0 auto}
.display{font-family:"Fraunces",Georgia,serif;font-weight:600;letter-spacing:-.03em;line-height:1.05}
.ico{width:1.2rem;height:1.2rem;flex-shrink:0;display:block}
.ico-wrap{
  width:2.6rem;height:2.6rem;border-radius:.9rem;display:grid;place-items:center;
  color:var(--accent);margin-bottom:1rem;
  background:color-mix(in srgb,var(--accent) 14%,transparent);
  border:1px solid color-mix(in srgb,var(--accent) 28%,transparent);
}
.topbar{
  position:sticky;top:0;z-index:50;padding:.75rem 0;
  background:rgba(6,9,8,.72);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-bottom:1px solid var(--line);
}
.brand{display:flex;align-items:center;justify-content:space-between;gap:1rem}
.logo{height:36px;width:auto;object-fit:contain}
.logo-text{font-family:"Fraunces",serif;font-size:1.35rem;color:var(--accent)}
.nav-cta{
  font-size:.8rem;font-weight:700;padding:.6rem 1rem;border-radius:999px;
  background:var(--accent);color:var(--ink);
}
.hero{position:relative;min-height:min(88vh,860px);display:grid;align-items:end;padding:3rem 0 4rem;isolation:isolate}
.hero-media{position:absolute;inset:0;z-index:-2;background-size:cover;background-position:center 28%}
.hero-media--fallback{background:radial-gradient(70% 50% at 80% 10%,color-mix(in srgb,var(--accent) 30%,transparent),transparent 55%),linear-gradient(165deg,var(--ink),var(--deep))}
.hero::before{
  content:"";position:absolute;inset:0;z-index:-1;
  background:linear-gradient(100deg,rgba(6,9,8,.96) 0%,rgba(6,9,8,.82) 38%,rgba(6,9,8,.45) 68%,rgba(6,9,8,.72) 100%);
}
.hero-inner{max-width:38rem}
.eyebrow{
  display:inline-flex;font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:var(--accent);margin-bottom:1.1rem;padding:.4rem .75rem;border-radius:999px;
  border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);
  background:color-mix(in srgb,var(--accent) 10%,transparent);
}
.hero h1{font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:clamp(2.5rem,6.5vw,4.4rem);letter-spacing:-.035em;line-height:1.02;margin:0 0 1rem}
.accent-line{display:block;color:var(--accent);font-style:italic;font-weight:500;margin-top:.12em}
.lead{font-size:clamp(1.02rem,1.8vw,1.18rem);color:var(--muted);margin-bottom:1.2rem;font-weight:450;max-width:32rem}
.meta-line{font-size:.9rem;color:rgba(244,246,245,.55);margin-bottom:1.6rem}
.cta-row{display:flex;flex-wrap:wrap;gap:.75rem}
.btn{
  display:inline-flex;align-items:center;justify-content:center;
  background:var(--accent);color:var(--ink);font-weight:700;font-size:.95rem;
  padding:.95rem 1.35rem;border-radius:999px;border:0;
  box-shadow:0 10px 36px color-mix(in srgb,var(--accent) 28%,transparent);
  transition:transform .18s ease;
}
.btn:hover{transform:translateY(-2px)}
.btn-ghost{background:transparent;color:var(--paper);border:1px solid rgba(255,255,255,.22);box-shadow:none}
.section{padding:5rem 0}
.section-kicker{font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:.85rem}
.section h2.display{font-size:clamp(1.9rem,4vw,3rem);max-width:16ch;margin-bottom:1.6rem}
.metrics{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;
  padding:1.4rem;border-radius:var(--radius);border:1px solid var(--line);
  background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));
  margin-top:2rem;
}
.metric strong{display:block;font-family:"Fraunces",serif;font-size:1.55rem;color:var(--accent);margin-bottom:.25rem}
.metric span{font-size:.82rem;color:var(--muted)}
.pain{background:linear-gradient(180deg,var(--surface),var(--ink))}
.pain-list{list-style:none;display:grid;gap:.85rem;max-width:46rem}
.pain-item{
  display:grid;grid-template-columns:auto auto 1fr;gap:.85rem;align-items:start;
  padding:1.1rem 1.2rem;border-radius:1.1rem;border:1px solid var(--line);
  background:rgba(255,255,255,.035);
}
.pain-item .num{font-family:"Fraunces",serif;color:var(--accent);font-size:1.05rem;min-width:1.6rem}
.pain-item .ico{color:var(--accent);margin-top:.2rem}
.pain-item p{font-weight:560;font-size:1.02rem}
.grid-4{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.card{
  padding:1.35rem 1.25rem;border-radius:var(--radius);border:1px solid var(--line);
  background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.02));
}
.card h3,.pillar h3,.step h3{font-size:1.12rem;font-weight:700;margin-bottom:.4rem;letter-spacing:-.02em}
.card p,.pillar p,.step p,.faq-item p{color:var(--muted);font-size:.94rem;font-weight:450}
.steps{list-style:none;display:grid;gap:1rem}
.step{
  display:grid;grid-template-columns:3rem 1fr;gap:1rem;align-items:start;
  padding:1.2rem 1.25rem;border-radius:var(--radius);border:1px solid var(--line);
  background:rgba(255,255,255,.03);
}
.step-n{
  width:2.6rem;height:2.6rem;border-radius:999px;display:grid;place-items:center;
  font-family:"Fraunces",serif;font-weight:600;background:var(--accent);color:var(--ink);
}
.pillars{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.pillar{padding:1.4rem;border-radius:var(--radius);background:color-mix(in srgb,var(--deep) 55%,#000);border:1px solid color-mix(in srgb,var(--accent) 18%,transparent)}
.angle-list,.proof-list{list-style:none;display:grid;gap:.75rem}
.angle-list li,.proof{display:flex;gap:.75rem;align-items:flex-start;padding:1rem 1.1rem;border-radius:1rem;border:1px solid var(--line);background:rgba(255,255,255,.03);font-weight:550}
.angle-list .ico,.proof .ico{color:var(--accent);margin-top:.15rem}
.chips{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1.25rem}
.chip{font-size:.78rem;padding:.35rem .7rem;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.offer{
  margin:0 auto;width:min(1120px,90vw);padding:2.5rem;border-radius:1.5rem;
  background:
    radial-gradient(90% 120% at 100% 0%,color-mix(in srgb,var(--accent) 22%,transparent),transparent 55%),
    linear-gradient(135deg,var(--deep),#071210);
  border:1px solid color-mix(in srgb,var(--accent) 22%,transparent);
}
.offer p{color:var(--muted);margin:1rem 0 1.4rem;max-width:36rem}
.faq-item{border:1px solid var(--line);border-radius:1rem;padding:1rem 1.15rem;background:rgba(255,255,255,.03);margin-bottom:.65rem}
.faq-item summary{cursor:pointer;font-weight:650;list-style:none}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item p{margin-top:.65rem}
.final{text-align:center;padding:5rem 0 4rem}
.final h2{max-width:14ch;margin:0 auto 1rem}
.final .sub{color:var(--muted);margin:0 auto 1.5rem;max-width:32rem}
.hint{display:block;margin-top:1rem;font-size:.85rem;color:var(--muted)}
footer{padding:2rem 0 2.75rem;border-top:1px solid var(--line);color:var(--muted);font-size:.78rem;text-align:center}
@media (max-width:720px){
  .hero{min-height:84vh;padding-bottom:3rem}
  .offer{padding:1.5rem}
  .pain-item{grid-template-columns:auto 1fr}
  .pain-item .num{display:none}
}
</style>
</head>
<body>
<div class="topbar"><div class="wrap brand">${logo}<a class="nav-cta" href="${esc(ctaHref)}">${esc(ctaPrimary)}</a></div></div>
<header class="hero">
  ${heroMedia}
  <div class="wrap hero-inner">
    ${copy.eyebrow ? `<div class="eyebrow">${esc(copy.eyebrow)}</div>` : ""}
    <h1>${esc(copy.headline).replace(/\n/g, "<br/>")}${
      copy.headline_accent
        ? `<span class="accent-line">${esc(copy.headline_accent)}</span>`
        : ""
    }</h1>
    <p class="lead">${esc(copy.subheadline)}</p>
    ${
      copy.audience || copy.differentiator
        ? `<p class="meta-line">${esc(
            [copy.audience, copy.differentiator].filter(Boolean).join(" · ")
          )}</p>`
        : ""
    }
    <div class="cta-row">
      <a class="btn" href="${esc(ctaHref)}">${esc(ctaPrimary)}</a>
      <a class="btn btn-ghost" href="#dor">${esc(copy.hero_cta_secondary || "Ver o problema")}</a>
    </div>
    ${metrics ? `<div class="metrics">${metrics}</div>` : ""}
  </div>
</header>

<section class="section pain" id="dor">
  <div class="wrap">
    <p class="section-kicker">O problema</p>
    <h2 class="display">${esc(copy.pain_title)}</h2>
    <ul class="pain-list">${pains}</ul>
  </div>
</section>

<section class="section" id="solucao">
  <div class="wrap">
    <p class="section-kicker">A solução</p>
    <h2 class="display">${esc(copy.solution_title)}</h2>
    <div class="grid-4">${benefits}</div>
  </div>
</section>

${
  steps
    ? `<section class="section" id="como">
  <div class="wrap">
    <p class="section-kicker">Como funciona</p>
    <h2 class="display">${esc(copy.how_title || "Do caos ao controle")}</h2>
    <ol class="steps">${steps}</ol>
  </div>
</section>`
    : ""
}

${
  pillars
    ? `<section class="section" id="pilares">
  <div class="wrap">
    <p class="section-kicker">Pilares da estratégia</p>
    <h2 class="display">${esc(copy.pillars_title || "Sobre o que vamos falar")}</h2>
    <div class="pillars">${pillars}</div>
  </div>
</section>`
    : ""
}

${
  angles
    ? `<section class="section" id="angulos">
  <div class="wrap">
    <p class="section-kicker">Ângulos que performam</p>
    <h2 class="display">${esc(copy.angles_title || "Hooks validados na research")}</h2>
    <ul class="angle-list">${angles}</ul>
    ${comps ? `<div class="chips">${comps}</div>` : ""}
  </div>
</section>`
    : ""
}

<section class="section" id="prova">
  <div class="wrap">
    <p class="section-kicker">Por que agora</p>
    <h2 class="display">${esc(copy.proof_title)}</h2>
    <ul class="proof-list">${proofs}</ul>
  </div>
</section>

${
  faq
    ? `<section class="section" id="faq">
  <div class="wrap">
    <p class="section-kicker">Dúvidas</p>
    <h2 class="display">${esc(copy.faq_title || "Perguntas frequentes")}</h2>
    ${faq}
  </div>
</section>`
    : ""
}

<section class="section" style="padding-top:1rem" id="oferta">
  <div class="offer" id="contato">
    <p class="section-kicker">Próximo passo</p>
    <h2 class="display">${esc(copy.offer_title)}</h2>
    <p>${esc(copy.offer_body)}</p>
    <a class="btn" href="${esc(ctaHref)}">${esc(ctaFinal)}</a>
    <span class="hint">${esc(copy.whatsapp_hint)}</span>
  </div>
</section>

<section class="final">
  <div class="wrap">
    <h2 class="display">${esc(ctaFinal)}</h2>
    <p class="sub">${esc(copy.final_sub)}</p>
    <a class="btn" href="${esc(ctaHref)}">${esc(ctaPrimary)}</a>
  </div>
</section>
<footer><div class="wrap">${esc(copy.brand_name)} · montado com research, estratégia e brand no Vende247</div></footer>
</body>
</html>`;
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export async function generateLanding(opts: {
  ctx: WorkspaceContext;
  report?: ResearchReport | null;
  strategy?: StrategyPlan | null;
  brand?: BrandKit | null;
  withHeroImage?: boolean;
}): Promise<LandingResult> {
  const { ctx, report, strategy, brand } = opts;
  const colors = pickColors(brand);

  const strategyDigest = strategy
    ? {
        resumo: strategy.resumo,
        pilares: strategy.pilares,
        posts_amostra: (strategy.posts || []).slice(0, 8).map((p) => ({
          titulo: p.titulo,
          formato: p.formato,
          hook: p.hook,
          objetivo: p.objetivo,
          pilar: p.pilar,
        })),
      }
    : null;

  const copy = await chatJson<LandingCopy>(
    `Você é diretor de copy de landing pages B2B de alta conversão (Brasil, 2026).
Monte uma LP RICA usando research + estratégia + produto. Não invente métricas falsas (% ou "500 empresas").
Métricas devem ser MECANISMOS curtos (ex.: value:"Biometria", label:"na entrega de EPI").

Tom: sofisticado, direto, específico. PROIBIDO clichê SaaS ("revolucione", "otimize sua gestão", "solução completa").

Campos:
- eyebrow, headline (máx 9 palavras), headline_accent (2–6 palavras em itálico), subheadline
- audience (para quem), differentiator (1 frase do que só este produto faz)
- hero_cta curto (máx 32 chars), hero_cta_secondary
- pains[4-5] bem concretas da research/gaps
- benefits[4] do produto
- how_steps[3-4] jornada do usuário
- pillars[3-4] a partir dos pilares/estratégia
- angles[4-6] hooks/ângulos da research (frases curtas)
- proof_items[3-4] mecanismos de credibilidade (sem números inventados)
- metrics[3-4] {value,label} mecanismos
- faq[4] objeções reais B2B SST/EPI
- offer_*, final_*, whatsapp_hint, whatsapp_url se houver número
- seo_title, seo_description

JSON estrito com todas as chaves acima.`,
    JSON.stringify(
      {
        workspace: ctx,
        research: report
          ? {
              resumo: report.resumo,
              oportunidades_unicas: report.oportunidades_unicas,
              o_que_concorrentes_fazem_bem: report.o_que_concorrentes_fazem_bem,
              hooks_vencedores: report.hooks_vencedores,
              pilares_conteudo: report.pilares_conteudo,
              ctas_comuns: report.ctas_comuns,
              gaps_do_seu_perfil: report.gaps_do_seu_perfil,
              insights_ads: report.insights_ads,
              direcao_visual: report.direcao_visual,
            }
          : null,
        strategy: strategyDigest,
        brand: brand
          ? { colors: brand.colors, visual_summary: brand.visual_summary }
          : null,
      },
      null,
      2
    )
  );

  copy.brand_name = copy.brand_name || ctx.produto.split(/[—\-–]/)[0]?.trim() || "Produto";
  copy.pains = arr<string>(copy.pains);
  copy.benefits = arr(copy.benefits);
  copy.how_steps = arr(copy.how_steps);
  copy.pillars = arr(copy.pillars);
  copy.angles = arr<string>(copy.angles);
  copy.proof_items = arr<string>(copy.proof_items);
  copy.metrics = arr(copy.metrics);
  copy.faq = arr(copy.faq);
  copy.eyebrow = copy.eyebrow || "Gestão de EPI com prova real";
  copy.headline = copy.headline || "Menos papel.";
  copy.headline_accent = copy.headline_accent || "Mais controle na entrega.";
  copy.subheadline =
    copy.subheadline ||
    "Biometria na entrega, CA sob alerta e operação multi-cliente em um fluxo só.";
  copy.hero_cta = shortCta(copy.hero_cta || "Quero demonstração");
  copy.hero_cta_secondary = copy.hero_cta_secondary || "Ver o problema";
  copy.final_cta = shortCta(copy.final_cta || copy.hero_cta);
  copy.pain_title = copy.pain_title || "Isso ainda trava a sua operação?";
  copy.solution_title = copy.solution_title || "O que muda com o produto";
  copy.how_title = copy.how_title || "Como funciona na prática";
  copy.pillars_title = copy.pillars_title || "Pilares da narrativa";
  copy.angles_title = copy.angles_title || "Ângulos da research";
  copy.proof_title = copy.proof_title || "Credibilidade sem enrolação";
  copy.faq_title = copy.faq_title || "Perguntas frequentes";
  copy.offer_title = copy.offer_title || ctx.oferta || "Peça uma demonstração";
  copy.offer_body =
    copy.offer_body ||
    ctx.oferta ||
    "Veja o fluxo de entrega com biometria e o painel multi-cliente ao vivo.";
  copy.final_sub = copy.final_sub || "Resposta rápida no WhatsApp para times SST.";
  copy.whatsapp_hint =
    copy.whatsapp_hint || ctx.cta || "Chama no WhatsApp e peça uma demo";

  // Fallbacks ricos se a LLM vier magra
  if (!copy.how_steps.length) {
    copy.how_steps = [
      { title: "Cadastre operações", body: "Clientes, colaboradores e EPIs com CA no mesmo painel." },
      { title: "Entregue com biometria", body: "Registro facial na hora da entrega — prova auditável." },
      { title: "Receba alertas", body: "Validade de CA e vida útil antes da multa chegar." },
    ];
  }
  if (!copy.pillars.length && strategy?.pilares?.length) {
    copy.pillars = strategy.pilares.slice(0, 4).map((t) => ({
      title: String(t),
      body: "Pilar da estratégia de conteúdo alinhado à oferta do produto.",
    }));
  }
  if (!copy.angles.length && report?.hooks_vencedores?.length) {
    copy.angles = report.hooks_vencedores.slice(0, 6).map(String);
  }
  if (!copy.metrics.length) {
    copy.metrics = [
      { value: "Biometria", label: "na entrega de EPI" },
      { value: "CA", label: "com alerta de validade" },
      { value: "Multi-cliente", label: "para consultores SST" },
    ];
  }

  let heroUrl: string | undefined;
  if (opts.withHeroImage !== false && isStorageConfigured()) {
    try {
      heroUrl = await gerarImagemViral(
        [
          "Workers wearing hard hats and EPI on a clean modern factory floor.",
          "Cinematic lighting, shallow depth of field, premium editorial photo.",
          "Empty visual space on the left third for website text overlay.",
          `Mood for product: ${ctx.produto.slice(0, 120)}`,
        ].join(" "),
        brand,
        { mode: "photo", overlayLogo: false }
      );
    } catch {
      heroUrl = brand?.og_image_url || undefined;
    }
  } else {
    heroUrl = brand?.og_image_url || undefined;
  }

  const html = renderLandingHtml(copy, {
    colors,
    logoUrl: brand?.logo_url,
    heroUrl,
    ctaUrl: resolveCtaUrl(ctx, copy),
    concorrentes: ctx.concorrentes || [],
  });

  return {
    html,
    meta: {
      brand_name: copy.brand_name,
      headline: `${copy.headline} ${copy.headline_accent}`.trim(),
      hero_image_url: heroUrl,
      colors: [colors.accent, colors.deep, colors.ink],
      sources: { research: Boolean(report), strategy: Boolean(strategy) },
    },
  };
}
