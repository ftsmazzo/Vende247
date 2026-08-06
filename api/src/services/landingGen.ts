import { chatJson } from "./llm.js";
import type { BrandKit } from "./brandFromUrl.js";
import type { ResearchReport, WorkspaceContext } from "./research.js";
import { gerarImagemViral } from "./imageGen.js";
import { isStorageConfigured } from "./storage.js";

export type LandingCopy = {
  brand_name: string;
  headline: string;
  subheadline: string;
  hero_cta: string;
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

function pickColors(brand?: BrandKit | null): { accent: string; deep: string; ink: string } {
  const c = brand?.colors?.filter(Boolean) ?? [];
  return {
    accent: c[0] || "#C8F542",
    deep: c[1] || "#0B1F3A",
    ink: c[2] || "#061018",
  };
}

/** Monta HTML self-contained — layout fixo forte; LLM só fornece copy. */
export function renderLandingHtml(
  copy: LandingCopy,
  opts: { colors: { accent: string; deep: string; ink: string }; logoUrl?: string; heroUrl?: string; ctaUrl?: string }
): string {
  const { accent, deep, ink } = opts.colors;
  const ctaHref = opts.ctaUrl || "#contato";
  const logo = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="${esc(copy.brand_name)}" class="logo" />`
    : `<span class="logo-text">${esc(copy.brand_name)}</span>`;

  const pains = copy.pains
    .slice(0, 4)
    .map((p) => `<li>${esc(p)}</li>`)
    .join("");
  const benefits = copy.benefits
    .slice(0, 4)
    .map(
      (b) =>
        `<article class="benefit"><h3>${esc(b.title)}</h3><p>${esc(b.body)}</p></article>`
    )
    .join("");
  const proofs = copy.proof_items
    .slice(0, 4)
    .map((p) => `<li>${esc(p)}</li>`)
    .join("");

  const heroBg = opts.heroUrl
    ? `background-image:linear-gradient(105deg,rgba(6,16,24,.88) 0%,rgba(6,16,24,.45) 55%,rgba(6,16,24,.2) 100%),url('${esc(opts.heroUrl)}');background-size:cover;background-position:center;`
    : `background:radial-gradient(120% 80% at 70% 20%,${accent}33 0%,transparent 55%),linear-gradient(160deg,${ink} 0%,${deep} 55%,#02080f 100%);`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(copy.seo_title || copy.headline)}</title>
<meta name="description" content="${esc(copy.seo_description || copy.subheadline)}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet"/>
<style>
:root{--accent:${accent};--deep:${deep};--ink:${ink};--paper:#F4F7FA;--muted:rgba(244,247,250,.68)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:"DM Sans",system-ui,sans-serif;background:var(--ink);color:var(--paper);line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{width:min(1120px,92vw);margin:0 auto}
.brand{display:flex;align-items:center;justify-content:space-between;padding:1.1rem 0;position:relative;z-index:2}
.logo{height:40px;width:auto;object-fit:contain}
.logo-text{font-family:"Bebas Neue",sans-serif;font-size:1.6rem;letter-spacing:.04em;color:var(--accent)}
.nav-cta{font-size:.85rem;font-weight:700;padding:.55rem 1rem;border:1px solid var(--accent);color:var(--accent);border-radius:999px}
.hero{min-height:100vh;min-height:100svh;display:flex;flex-direction:column;${heroBg}}
.hero-inner{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:0 0 4.5rem;max-width:38rem}
.hero h1{font-family:"Bebas Neue",sans-serif;font-size:clamp(3.2rem,9vw,6.2rem);line-height:.92;letter-spacing:.01em;margin:.6rem 0 1rem}
.hero h1 em{font-style:normal;color:var(--accent)}
.hero p.lead{font-size:clamp(1.05rem,2.2vw,1.25rem);color:var(--muted);max-width:34rem;margin-bottom:1.75rem}
.btn{display:inline-flex;align-items:center;gap:.5rem;background:var(--accent);color:var(--ink);font-weight:700;font-size:1rem;padding:.95rem 1.5rem;border-radius:999px;border:0;cursor:pointer;transition:transform .2s ease}
.btn:hover{transform:translateY(-2px)}
.section{padding:5rem 0}
.section h2{font-family:"Bebas Neue",sans-serif;font-size:clamp(2.2rem,5vw,3.4rem);line-height:1;margin-bottom:1.5rem;letter-spacing:.02em}
.pain{background:linear-gradient(180deg,#0a1524 0%,var(--ink) 100%)}
.pain ul{list-style:none;display:grid;gap:.85rem;max-width:40rem}
.pain li{padding:1rem 1.15rem;border-left:3px solid var(--accent);background:rgba(255,255,255,.04);font-size:1.05rem}
.benefits{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:1.5rem}
.benefit{padding:1.4rem 1.25rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:4px}
.benefit h3{font-size:1.15rem;margin-bottom:.45rem;color:var(--accent)}
.benefit p{color:var(--muted);font-size:.95rem}
.proof ul{list-style:none;display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.proof li{padding:1.1rem;border:1px solid rgba(200,245,66,.25);border-radius:4px;font-weight:500}
.offer{background:var(--deep);position:relative;overflow:hidden}
.offer::before{content:"";position:absolute;inset:auto -20% -40% auto;width:60%;height:80%;background:radial-gradient(circle,${accent}44,transparent 65%);pointer-events:none}
.offer-inner{position:relative;max-width:36rem}
.offer p{color:var(--muted);margin:1rem 0 1.5rem;font-size:1.1rem}
.final{text-align:center;padding:5.5rem 0 4rem}
.final h2{max-width:18ch;margin:0 auto 1rem}
.final .sub{color:var(--muted);margin-bottom:1.75rem}
.hint{display:block;margin-top:1rem;font-size:.85rem;color:var(--muted)}
footer{padding:2rem 0 3rem;border-top:1px solid rgba(255,255,255,.08);color:var(--muted);font-size:.8rem;text-align:center}
@media (max-width:640px){.hero-inner{padding-bottom:3rem}.nav-cta{display:none}}
</style>
</head>
<body>
<header class="hero">
  <div class="wrap brand">${logo}<a class="nav-cta" href="${esc(ctaHref)}">${esc(copy.hero_cta)}</a></div>
  <div class="wrap hero-inner">
    <h1>${esc(copy.headline).replace(/\n/g, "<br/>")}</h1>
    <p class="lead">${esc(copy.subheadline)}</p>
    <a class="btn" href="${esc(ctaHref)}">${esc(copy.hero_cta)}</a>
  </div>
</header>
<section class="section pain" id="dor">
  <div class="wrap">
    <h2>${esc(copy.pain_title)}</h2>
    <ul>${pains}</ul>
  </div>
</section>
<section class="section" id="solucao">
  <div class="wrap">
    <h2>${esc(copy.solution_title)}</h2>
    <div class="benefits">${benefits}</div>
  </div>
</section>
<section class="section proof" id="prova">
  <div class="wrap">
    <h2>${esc(copy.proof_title)}</h2>
    <ul>${proofs}</ul>
  </div>
</section>
<section class="section offer" id="oferta">
  <div class="wrap offer-inner">
    <h2>${esc(copy.offer_title)}</h2>
    <p>${esc(copy.offer_body)}</p>
    <a class="btn" href="${esc(ctaHref)}">${esc(copy.final_cta)}</a>
  </div>
</section>
<section class="final" id="contato">
  <div class="wrap">
    <h2>${esc(copy.final_cta)}</h2>
    <p class="sub">${esc(copy.final_sub)}</p>
    <a class="btn" href="${esc(ctaHref)}">${esc(copy.hero_cta)}</a>
    <span class="hint">${esc(copy.whatsapp_hint)}</span>
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
    `Você é copywriter de landing pages B2B de alta conversão (Brasil, 2026).
Escreva copy em português brasileiro, direto, sem enrolação, tom moderno e comercial.
PROIBIDO: clichês vazios ("revolucione", "solução completa"), layout genérico de SaaS.
headline: curta e punchy (pode usar \\n para quebra); destaque a dor ou o ganho.
benefits: 3–4 itens concretos do produto.
pains: 3–4 dores reais do nicho.
proof_items: provas / ângulos de credibilidade (mesmo sem números inventados — use mecanismos: biometria, CA, auditoria, etc.).
whatsapp_hint: como falar no WhatsApp/DM.
Responda SOMENTE JSON com as chaves:
brand_name, headline, subheadline, hero_cta, pain_title, pains[], solution_title,
benefits[{title,body}], proof_title, proof_items[], offer_title, offer_body,
final_cta, final_sub, whatsapp_hint, seo_title, seo_description.`,
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
  copy.pains = copy.pains || [];
  copy.benefits = copy.benefits || [];
  copy.proof_items = copy.proof_items || [];
  copy.hero_cta = copy.hero_cta || ctx.cta || "Falar agora";
  copy.final_cta = copy.final_cta || copy.hero_cta;

  let heroUrl: string | undefined;
  if (opts.withHeroImage !== false && isStorageConfigured()) {
    try {
      heroUrl = await gerarImagemViral(
        `Landing page hero photo full bleed, cinematic industrial workplace, people with EPI hard hats, product vibe for ${ctx.produto}. NO text overlay, NO phone mockups, powerful atmosphere, 4:5 crop ok`,
        brand
      );
    } catch {
      heroUrl = brand?.og_image_url || undefined;
    }
  } else {
    heroUrl = brand?.og_image_url || undefined;
  }

  const ctaUrl =
    ctx.cta?.toLowerCase().includes("http") ? ctx.cta : "#contato";

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
      headline: copy.headline,
      hero_image_url: heroUrl,
      colors: [colors.accent, colors.deep, colors.ink],
    },
  };
}
