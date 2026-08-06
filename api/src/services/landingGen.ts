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

function isFakePhone(digits: string): boolean {
  // exemplos inventados comuns pela LLM
  return (
    /^(55)?11912345678$/.test(digits) ||
    /^(55)?11999999999$/.test(digits) ||
    /^(55)?5511999999999$/.test(digits) ||
    /^0+$/.test(digits) ||
    /12345678/.test(digits)
  );
}

function resolveCtaUrl(ctx: WorkspaceContext, copy: LandingCopy): string {
  for (const c of [copy.whatsapp_url, ctx.cta]) {
    const t = (c || "").trim();
    if (!t) continue;
    if (/^https?:\/\//i.test(t)) {
      try {
        const u = new URL(t);
        const phone = (u.searchParams.get("phone") || u.pathname.replace(/\D/g, "")).replace(/\D/g, "");
        if (phone && isFakePhone(phone)) continue;
        return t;
      } catch {
        return t;
      }
    }
    if (/^wa\.me\//i.test(t)) {
      const digits = t.replace(/\D/g, "");
      if (isFakePhone(digits)) continue;
      return `https://${t}`;
    }
    const digits = t.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13 && !isFakePhone(digits)) {
      return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
    }
  }
  return "#contato";
}

function shortCta(label: string): string {
  const t = cleanPublicText(label).trim();
  if (!t) return "Quero uma demonstração";
  if (t.length <= 34) return t;
  if (/whatsapp|wa\.me|direct|demo|demonstra|prontepi/i.test(t)) return "Quero uma demonstração";
  return t.slice(0, 32) + "…";
}

function cleanPublicText(v: unknown): string {
  let s = String(v ?? "");
  s = s.replace(/[*_`#]+/g, "");
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
  s = s.replace(/^["'«»]+|["'«»]+$/g, "");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(
    /\b(research|estratégia de conteúdo|ângulos da research|hooks validados|vende247|gaps? do perfil)\b/gi,
    ""
  );
  return s.replace(/\s+/g, " ").trim();
}

/** Copy de marketing Instagram / meta interna — NÃO serve para LP do produto. */
function isIgOrInternalNoise(s: string): boolean {
  const t = s.toLowerCase();
  return (
    /\b(perfil|instagram|engajamento|seguidores|followers|bio\b|destaques|reels|carrossel|stories|conteúdo|posts?\b|feed\b|hook\b|copy\b|vende247|research)\b/i.test(
      t
    ) ||
    /falta de (conteúdo|engajamento)/i.test(t) ||
    /perfil ainda vazio/i.test(t) ||
    /estratégia clara de conteúdo/i.test(t) ||
    /prova(s)? sociais? e depoimento/i.test(t) ||
    /eduque e informe o público/i.test(t) ||
    /cases de sucesso/i.test(t) ||
    /demonstrações práticas/i.test(t) ||
    /educação sobre normas/i.test(t)
  );
}

function filterProductLines(lines: string[]): string[] {
  return lines.map(cleanPublicText).filter((s) => s.length > 8 && !isIgOrInternalNoise(s));
}

function pairFrom(raw: unknown): { title: string; body: string } | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = cleanPublicText(raw);
    return t ? { title: t.slice(0, 48), body: t } : null;
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = cleanPublicText(
    o.title ?? o.titulo ?? o.name ?? o.nome ?? o.q ?? o.pergunta ?? o.question ?? ""
  );
  const body = cleanPublicText(
    o.body ?? o.texto ?? o.descricao ?? o.description ?? o.a ?? o.resposta ?? o.answer ?? o.desc ?? ""
  );
  if (!title && !body) return null;
  return { title: title || body.slice(0, 40), body: body || title };
}

function normalizePairs(raw: unknown): Array<{ title: string; body: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.map(pairFrom).filter((x): x is { title: string; body: string } => Boolean(x));
}

function normalizeFaq(raw: unknown): Array<{ q: string; a: string }> {
  return normalizePairs(raw).map((p) => ({ q: p.title, a: p.body }));
}

function normalizeStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (typeof x === "string") return cleanPublicText(x);
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        return cleanPublicText(o.texto ?? o.title ?? o.titulo ?? o.hook ?? o.body ?? "");
      }
      return "";
    })
    .filter((s) => s.length > 2);
}

function shortTitle(s: string, max = 52): string {
  const t = cleanPublicText(s);
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function splitHeadline(headline: string, accent: string): { main: string; accent: string } {
  let main = cleanPublicText(headline);
  let acc = cleanPublicText(accent);
  // remove accent duplicado dentro do headline
  if (acc && main.toLowerCase().includes(acc.toLowerCase())) {
    main = main.replace(new RegExp(acc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "").trim();
    main = main.replace(/[\s*]+$/g, "").trim();
  }
  if (!main) main = "Menos papel. Mais controle.";
  if (!acc) acc = "Na entrega de EPIs.";
  return { main, accent: acc };
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

  const head = splitHeadline(copy.headline, copy.headline_accent);

  const pains = (copy.pains || [])
    .map(cleanPublicText)
    .filter(Boolean)
    .slice(0, 5)
    .map(
      (p, i) =>
        `<li class="pain-item"><span class="num">0${i + 1}</span><span class="ico">${WARN}</span><p>${esc(p)}</p></li>`
    )
    .join("");

  const benefitItems = (copy.benefits || []).filter((b) => b.title || b.body).slice(0, 4);
  const benefits = benefitItems
    .map(
      (b, i) =>
        `<article class="card">
          <div class="ico-wrap">${ICONS[i % ICONS.length]}</div>
          <h3>${esc(b.title)}</h3>
          <p>${esc(b.body)}</p>
        </article>`
    )
    .join("");

  const stepItems = (copy.how_steps || []).filter((s) => s.title || s.body).slice(0, 4);
  const steps = stepItems
    .map(
      (s, i) =>
        `<li class="step"><span class="step-n">${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div></li>`
    )
    .join("");

  const pillarItems = (copy.pillars || []).filter((p) => p.title || p.body).slice(0, 4);
  const pillars = pillarItems
    .map((p) => `<article class="pillar"><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></article>`)
    .join("");

  const angleItems = (copy.angles || []).map(cleanPublicText).filter(Boolean).slice(0, 6);
  const angles = angleItems
    .map((a) => `<li><span class="ico">${CHECK}</span>${esc(a)}</li>`)
    .join("");

  const proofItems = (copy.proof_items || []).map(cleanPublicText).filter(Boolean).slice(0, 4);
  const proofs = proofItems
    .map((p) => `<li class="proof"><span class="ico">${CHECK}</span>${esc(p)}</li>`)
    .join("");

  const metricItems = (copy.metrics || [])
    .map((m) => ({
      value: cleanPublicText(m.value),
      label: cleanPublicText(m.label),
    }))
    .filter((m) => m.value)
    .slice(0, 4);
  const metrics = metricItems
    .map(
      (m) =>
        `<div class="metric"><strong>${esc(m.value)}</strong><span>${esc(m.label)}</span></div>`
    )
    .join("");

  const faqItems = (copy.faq || []).filter((f) => f.q || f.a).slice(0, 5);
  const faq = faqItems
    .map(
      (f) =>
        `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`
    )
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
.hero{
  position:relative;isolation:isolate;
  min-height:auto;
  display:grid;align-items:center;
  padding:2.75rem 0 2.5rem;
}
.hero-grid{
  display:grid;gap:2rem;align-items:center;
  grid-template-columns:minmax(0,1.15fr) minmax(0,.95fr);
}
.hero-media{
  position:relative;z-index:0;min-height:340px;max-height:460px;
  border-radius:1.35rem;overflow:hidden;
  background-size:cover;background-position:center;
  border:1px solid var(--line);
  box-shadow:0 24px 60px rgba(0,0,0,.35);
}
.hero-media--fallback{background:radial-gradient(70% 50% at 80% 10%,color-mix(in srgb,var(--accent) 30%,transparent),transparent 55%),linear-gradient(165deg,var(--ink),var(--deep))}
.hero-media::after{
  content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,transparent 45%,rgba(6,9,8,.55));
}
.hero-inner{position:relative;z-index:1;max-width:40rem}
.eyebrow{
  display:inline-flex;font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:var(--accent);margin-bottom:.85rem;padding:.35rem .7rem;border-radius:999px;
  border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);
  background:color-mix(in srgb,var(--accent) 10%,transparent);
}
.hero h1{font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:clamp(2.1rem,4.6vw,3.35rem);letter-spacing:-.035em;line-height:1.05;margin:0 0 .85rem}
.accent-line{display:block;color:var(--accent);font-style:italic;font-weight:500;margin-top:.1em}
.lead{font-size:clamp(1.02rem,1.6vw,1.15rem);color:var(--muted);margin-bottom:1.1rem;font-weight:450;max-width:34rem}
.meta-line{font-size:.88rem;color:rgba(244,246,245,.55);margin-bottom:1.25rem}
.cta-row{display:flex;flex-wrap:wrap;gap:.75rem}
.btn{
  display:inline-flex;align-items:center;justify-content:center;
  background:var(--accent);color:var(--ink);font-weight:700;font-size:.95rem;
  padding:.9rem 1.25rem;border-radius:999px;border:0;
  box-shadow:0 10px 36px color-mix(in srgb,var(--accent) 28%,transparent);
  transition:transform .18s ease;
}
.btn:hover{transform:translateY(-2px)}
.btn-ghost{background:transparent;color:var(--paper);border:1px solid rgba(255,255,255,.22);box-shadow:none}
.section{padding:4rem 0}
.section-kicker{font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:.85rem}
.section h2.display{font-size:clamp(1.75rem,3.5vw,2.6rem);max-width:18ch;margin-bottom:1.4rem}
.metrics{
  display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;
  padding:1.1rem;border-radius:var(--radius);border:1px solid var(--line);
  background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));
  margin-top:1.4rem;
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
@media (max-width:900px){
  .hero-grid{grid-template-columns:1fr}
  .hero-media{min-height:220px;max-height:280px;order:-1}
}
@media (max-width:720px){
  .hero{padding:1.75rem 0 1.5rem}
  .offer{padding:1.5rem}
  .pain-item{grid-template-columns:auto 1fr}
  .pain-item .num{display:none}
  .metrics{grid-template-columns:1fr}
}
</style>
</head>
<body>
<div class="topbar"><div class="wrap brand">${logo}<a class="nav-cta" href="${esc(ctaHref)}">${esc(ctaPrimary)}</a></div></div>
<header class="hero">
  <div class="wrap hero-grid">
    <div class="hero-inner">
      ${copy.eyebrow ? `<div class="eyebrow">${esc(cleanPublicText(copy.eyebrow))}</div>` : ""}
      <h1>${esc(head.main).replace(/\n/g, "<br/>")}<span class="accent-line">${esc(head.accent)}</span></h1>
      <p class="lead">${esc(cleanPublicText(copy.subheadline))}</p>
      ${
        copy.audience || copy.differentiator
          ? `<p class="meta-line">${esc(
              [cleanPublicText(copy.audience), cleanPublicText(copy.differentiator)]
                .filter(Boolean)
                .join(" · ")
            )}</p>`
          : ""
      }
      <div class="cta-row">
        <a class="btn" href="${esc(ctaHref)}">${esc(ctaPrimary)}</a>
        <a class="btn btn-ghost" href="#dor">${esc(cleanPublicText(copy.hero_cta_secondary) || "Ver o problema")}</a>
      </div>
      ${metrics ? `<div class="metrics">${metrics}</div>` : ""}
    </div>
    ${heroMedia}
  </div>
</header>

<section class="section pain" id="dor">
  <div class="wrap">
    <p class="section-kicker">O problema</p>
    <h2 class="display">${esc(cleanPublicText(copy.pain_title) || "Isso ainda trava a sua operação?")}</h2>
    <ul class="pain-list">${pains}</ul>
  </div>
</section>

${
  benefits
    ? `<section class="section" id="solucao">
  <div class="wrap">
    <p class="section-kicker">A solução</p>
    <h2 class="display">${esc(cleanPublicText(copy.solution_title) || "O que muda na prática")}</h2>
    <div class="grid-4">${benefits}</div>
  </div>
</section>`
    : ""
}

${
  steps
    ? `<section class="section" id="como">
  <div class="wrap">
    <p class="section-kicker">Como funciona</p>
    <h2 class="display">${esc(cleanPublicText(copy.how_title) || "Do caos ao controle")}</h2>
    <ol class="steps">${steps}</ol>
  </div>
</section>`
    : ""
}

${
  pillars
    ? `<section class="section" id="pilares">
  <div class="wrap">
    <p class="section-kicker">Por que escolhem</p>
    <h2 class="display">${esc(cleanPublicText(copy.pillars_title) || "Pilares do produto")}</h2>
    <div class="pillars">${pillars}</div>
  </div>
</section>`
    : ""
}

${
  angles
    ? `<section class="section" id="angulos">
  <div class="wrap">
    <p class="section-kicker">Mensagens que convertem</p>
    <h2 class="display">${esc(cleanPublicText(copy.angles_title) || "O que o mercado responde")}</h2>
    <ul class="angle-list">${angles}</ul>
  </div>
</section>`
    : ""
}

${
  proofs
    ? `<section class="section" id="prova">
  <div class="wrap">
    <p class="section-kicker">Por que agora</p>
    <h2 class="display">${esc(cleanPublicText(copy.proof_title) || "Prova sem enrolação")}</h2>
    <ul class="proof-list">${proofs}</ul>
  </div>
</section>`
    : ""
}

${
  faq
    ? `<section class="section" id="faq">
  <div class="wrap">
    <p class="section-kicker">Dúvidas</p>
    <h2 class="display">${esc(cleanPublicText(copy.faq_title) || "Perguntas frequentes")}</h2>
    ${faq}
  </div>
</section>`
    : ""
}

<section class="section" style="padding-top:1rem" id="oferta">
  <div class="offer" id="contato">
    <p class="section-kicker">Próximo passo</p>
    <h2 class="display">${esc(shortTitle(copy.offer_title, 48) || "Peça uma demonstração")}</h2>
    <p>${esc(cleanPublicText(copy.offer_body))}</p>
    <a class="btn" href="${esc(ctaHref)}">${esc(ctaFinal)}</a>
    <span class="hint">${esc(cleanPublicText(copy.whatsapp_hint))}</span>
  </div>
</section>

<section class="final">
  <div class="wrap">
    <h2 class="display">${esc(ctaFinal)}</h2>
    <p class="sub">${esc(cleanPublicText(copy.final_sub))}</p>
    <a class="btn" href="${esc(ctaHref)}">${esc(ctaPrimary)}</a>
  </div>
</section>
<footer><div class="wrap">${esc(copy.brand_name)}</div></footer>
</body>
</html>`;
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

  // Research de Instagram NÃO é brief de LP. Só ângulos de PRODUTO / mercado.
  const productSignals = report
    ? {
        oportunidades_unicas: (report.oportunidades_unicas || []).filter(
          (s) => !isIgOrInternalNoise(String(s))
        ),
        o_que_mercado_faz_bem: (report.o_que_concorrentes_fazem_bem || []).filter(
          (s) => !isIgOrInternalNoise(String(s))
        ),
        mensagens_produto: (report.hooks_vencedores || []).filter(
          (s) => !isIgOrInternalNoise(String(s))
        ),
        insights_ads: (report.insights_ads || []).filter(
          (s) => !isIgOrInternalNoise(String(s))
        ),
      }
    : null;

  const copy = await chatJson<LandingCopy>(
    `Você escreve landing pages B2B de SOFTWARE (Brasil) para o COMPRADOR do produto — gestor SST, técnico de segurança, consultor multi-cliente, comprador de EPI.

MISSÃO: vender o PRODUTO do workspace (descrição + oferta). NÃO vender "presença no Instagram".

PROIBIDO ABSOLUTO nas dores/pains/pillars/angles:
- perfil vazio, falta de conteúdo, engajamento, posts, reels, carrossel, bio, seguidores
- "estratégia de conteúdo", "prova social / depoimentos" como dor de marketing
- research, Vende247, hooks internos, @ de concorrentes
- copy genérica tipo "tecnologia de ponta", "otimize seus gastos", "transforme sua gestão"

OBRIGATÓRIO:
- pains = dores OPERACIONAIS do comprador: CA vencido, planilha, multa, entrega sem prova, estoque, multi-cliente, auditoria
- headline com tensão concreta (máx 6 palavras na linha principal) + accent com benefício
- subheadline = 1 frase com o mecanismo (biometria / CA / multi-cliente) amarrado ao produto
- benefits: título curto + body com resultado concreto (não feature vazia)
- pillars: diferenciais do PRODUTO (não pilares editoriais de Instagram)
- angles: gatilhos de compra duros e específicos
- faq: objeções reais de compra B2B
- Preencha TODOS os arrays; nunca {}
- Sem markdown, sem emoji, sem métricas inventadas (% / "500 empresas"), sem telefone inventado
- hero_cta ≤ 32 caracteres; offer_title ≤ 8 palavras
- benefits/how_steps/pillars/faq: title+body (ou titulo+texto)

JSON estrito.`,
    JSON.stringify(
      {
        produto: {
          nome_sugerido: ctx.produto.split(/[—\-–]/)[0]?.trim(),
          descricao_completa: ctx.produto,
          nicho: ctx.nicho,
          oferta: ctx.oferta,
          cta: ctx.cta,
          tom_voz: ctx.tom_voz,
          publico_alvo:
            "Consultores SST multi-cliente, técnicos de segurança e empresas que controlam entrega de EPI",
        },
        sinais_de_mercado_somente_produto: productSignals,
        brand: brand
          ? { colors: brand.colors, visual_summary: brand.visual_summary }
          : null,
        lembrete:
          "gaps do Instagram / pilares de conteúdo / plano de posts NÃO entram nesta LP.",
      },
      null,
      2
    )
  );

  const brandName = cleanPublicText(copy.brand_name) || ctx.produto.split(/[—\-–]/)[0]?.trim() || "Produto";

  const defaultBenefits = [
    {
      title: "Biometria na entrega",
      body: "Registro facial na hora de entregar EPI — prova auditável para auditoria.",
    },
    {
      title: "Multi-cliente",
      body: "Consultor SST gerencia várias empresas; cada uma com painel próprio.",
    },
    {
      title: "Alertas de CA",
      body: "Avisos de validade e vida útil antes da multa ou da falha na fiscalização.",
    },
    {
      title: "Estoque e custo",
      body: "Controle de EPI, consumo e custo sem planilha solta.",
    },
  ];
  const defaultSteps = [
    { title: "Cadastre a operação", body: "Clientes, colaboradores e EPIs com CA no mesmo fluxo." },
    { title: "Entregue com biometria", body: "Confirme identidade na entrega e gere o histórico." },
    { title: "Opere com alertas", body: "CA e vida útil sob controle — menos surpresa na auditoria." },
  ];
  const defaultFaq = [
    {
      q: "Serve para consultor com vários clientes?",
      a: "Sim. O modelo multi-cliente foi feito para consultores SST acompanharem várias empresas.",
    },
    {
      q: "A biometria substitui assinatura em papel?",
      a: "Ela registra a entrega com identificação facial, gerando prova mais forte que planilha.",
    },
    {
      q: "Como ajuda com CA vencido?",
      a: "Alertas de validade e vida útil ajudam a agir antes da fiscalização.",
    },
    {
      q: "Dá para ver demonstração?",
      a: "Sim. Peça uma demo e veja o fluxo de entrega e o painel ao vivo.",
    },
  ];

  copy.brand_name = brandName;
  copy.pains = filterProductLines(normalizeStrings(copy.pains));
  copy.benefits = normalizePairs(copy.benefits).filter(
    (b) => !isIgOrInternalNoise(`${b.title} ${b.body}`)
  );
  copy.how_steps = normalizePairs(copy.how_steps).filter(
    (b) => !isIgOrInternalNoise(`${b.title} ${b.body}`)
  );
  copy.pillars = normalizePairs(copy.pillars).filter(
    (b) => !isIgOrInternalNoise(`${b.title} ${b.body}`)
  );
  copy.angles = filterProductLines(normalizeStrings(copy.angles));
  copy.proof_items = filterProductLines(normalizeStrings(copy.proof_items));
  copy.metrics = normalizePairs(copy.metrics)
    .filter((p) => !isIgOrInternalNoise(`${p.title} ${p.body}`))
    .map((p) => ({ value: p.title, label: p.body }));
  copy.faq = normalizeFaq(copy.faq).filter((f) => !isIgOrInternalNoise(`${f.q} ${f.a}`));

  const defaultPains = [
    "Entrega de EPI sem prova auditável — risco na fiscalização",
    "CA vencido ou vida útil estourada sem alerta a tempo",
    "Planilha que não escala quando o consultor tem vários clientes",
    "Estoque e custo de EPI sem visão clara por empresa",
  ];

  if (copy.pains.length < 3) {
    const fromOpp = filterProductLines(normalizeStrings(report?.oportunidades_unicas));
    copy.pains = [...copy.pains, ...fromOpp, ...defaultPains]
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 5);
  }
  if (!copy.benefits.length) copy.benefits = defaultBenefits;
  if (!copy.how_steps.length) copy.how_steps = defaultSteps;
  if (!copy.faq.length) copy.faq = defaultFaq;

  if (!copy.pillars.length) {
    copy.pillars = [
      {
        title: "Prova na entrega",
        body: "Biometria facial e histórico — base mais forte que assinatura em papel.",
      },
      {
        title: "Operação multi-cliente",
        body: "Consultor SST com vários painéis no mesmo fluxo, sem planilha paralela.",
      },
      {
        title: "Alerta antes da multa",
        body: "CA e vida útil no radar operacional — não no susto da auditoria.",
      },
    ];
  }

  if (copy.angles.length < 3) {
    copy.angles = filterProductLines([
      ...copy.angles,
      ...normalizeStrings(report?.hooks_vencedores),
      "Auditoria sem prova de entrega é risco caro",
      "Biometria na entrega muda o jogo da conformidade",
      "CA vencido não pode ser surpresa",
      "Multi-cliente sem planilha solta",
    ]).slice(0, 6);
  }

  if (!copy.proof_items.length) {
    copy.proof_items = [
      "Entrega com identificação facial e histórico",
      "Alertas de CA e vida útil no fluxo operacional",
      "Painel multi-cliente para consultores SST",
    ];
  }
  if (!copy.metrics.length) {
    copy.metrics = [
      { value: "Biometria", label: "na entrega de EPI" },
      { value: "CA", label: "com alerta de validade" },
      { value: "Multi-cliente", label: "para consultores SST" },
    ];
  }

  // Headline fraca / genérica → força tensão de produto
  const weakHeadline =
    !copy.headline ||
    /menos papel/i.test(copy.headline) ||
    isIgOrInternalNoise(copy.headline) ||
    cleanPublicText(copy.headline).split(/\s+/).length < 2;

  const head = splitHeadline(
    weakHeadline ? "CA vencido na auditoria?" : copy.headline,
    weakHeadline || !copy.headline_accent
      ? "Controle EPI com prova."
      : copy.headline_accent
  );
  copy.headline = head.main;
  copy.headline_accent = head.accent;
  copy.eyebrow = cleanPublicText(copy.eyebrow);
  if (!copy.eyebrow || isIgOrInternalNoise(copy.eyebrow)) {
    copy.eyebrow = "Software de gestão de EPI";
  }
  copy.subheadline = cleanPublicText(copy.subheadline);
  if (!copy.subheadline || isIgOrInternalNoise(copy.subheadline) || copy.subheadline.length < 40) {
    copy.subheadline =
      cleanPublicText(ctx.oferta)?.slice(0, 180) ||
      "Biometria na entrega, alerta de CA e painel multi-cliente — menos papel, menos multa, mais controle.";
  }
  copy.audience = cleanPublicText(copy.audience);
  if (isIgOrInternalNoise(copy.audience)) copy.audience = "";
  if (!copy.audience) {
    copy.audience = "Para consultores SST e times de segurança do trabalho";
  }
  copy.differentiator = cleanPublicText(copy.differentiator);
  if (isIgOrInternalNoise(copy.differentiator)) copy.differentiator = "";
  if (!copy.differentiator) {
    copy.differentiator = "Prova na entrega + CA sob alerta";
  }
  copy.hero_cta = shortCta(copy.hero_cta || "Quero demonstração");
  copy.hero_cta_secondary = cleanPublicText(copy.hero_cta_secondary) || "Ver o problema";
  copy.final_cta = shortCta(copy.final_cta || copy.hero_cta);
  copy.pain_title = cleanPublicText(copy.pain_title) || "Isso ainda trava a sua operação?";
  if (isIgOrInternalNoise(copy.pain_title)) {
    copy.pain_title = "Isso ainda trava a sua operação?";
  }
  copy.solution_title = cleanPublicText(copy.solution_title) || "O que muda na prática";
  copy.how_title = cleanPublicText(copy.how_title) || "Como funciona";
  copy.pillars_title = cleanPublicText(copy.pillars_title) || "Por que o produto";
  copy.angles_title = cleanPublicText(copy.angles_title) || "O que o mercado responde";
  copy.proof_title = cleanPublicText(copy.proof_title) || "Prova sem enrolação";
  copy.faq_title = cleanPublicText(copy.faq_title) || "Perguntas frequentes";
  copy.offer_title = shortTitle(copy.offer_title || "Peça uma demonstração", 48);
  copy.offer_body =
    cleanPublicText(copy.offer_body) ||
    cleanPublicText(ctx.oferta) ||
    "Veja o fluxo de entrega com biometria e o painel multi-cliente ao vivo.";
  if (isIgOrInternalNoise(copy.offer_body)) {
    copy.offer_body =
      cleanPublicText(ctx.oferta) ||
      "Veja o fluxo de entrega com biometria e o painel multi-cliente ao vivo.";
  }
  if (copy.offer_title.length > 60 || isIgOrInternalNoise(copy.offer_title)) {
    copy.offer_title = "Peça uma demonstração";
  }
  copy.final_sub = cleanPublicText(copy.final_sub) || "Resposta rápida para times SST.";
  copy.whatsapp_hint = cleanPublicText(copy.whatsapp_hint || ctx.cta) || "Chama no WhatsApp e peça uma demo";
  if (isIgOrInternalNoise(copy.whatsapp_hint)) {
    copy.whatsapp_hint = "Peça uma demonstração do produto";
  }
  copy.whatsapp_url = copy.whatsapp_url && !isFakePhone(String(copy.whatsapp_url).replace(/\D/g, ""))
    ? copy.whatsapp_url
    : undefined;
  copy.seo_title =
    cleanPublicText(copy.seo_title) ||
    `${brandName} — gestão de EPI com biometria`;
  copy.seo_description =
    cleanPublicText(copy.seo_description) || copy.subheadline.slice(0, 155);

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
        { mode: "photo", purpose: "photo", overlayLogo: false, aspectRatio: "4:5" }
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
    concorrentes: [],
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
