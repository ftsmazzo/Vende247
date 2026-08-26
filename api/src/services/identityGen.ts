import { captureManyDesignSystems, type DesignSystemCapture } from "./siteCapture.js";
import { chatJson } from "./llm.js";
import type { IdentityModel } from "./identityContract.js";
import type { ResearchReport, WorkspaceContext } from "./research.js";
import type { StrategyPlan } from "./strategy.js";

function clip(s: unknown, n: number): string {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);
}

function clipList(xs: unknown, n: number, each = 120): string[] {
  if (!Array.isArray(xs)) return [];
  return xs
    .map((x) => clip(typeof x === "string" ? x : JSON.stringify(x), each))
    .filter(Boolean)
    .slice(0, n);
}

/**
 * Contrato operacional sintetizado — mesmo shape, sem ensaio.
 * Qualidade = decisão certa, não volume.
 */
const CONTRACT_SHAPE = `{
  identity_signature: { summary: string<=180, recognition_cues: string[3..5] },
  design_tokens: { colors: { brand_primary, brand_secondary, brand_accent, ink, surface: { value: "#hex" } } },
  image_treatment: { hero_recipe: string<=160, prohibited: string[2..4] },
  landing_page_style_spec: { page_personality: string[2..4], content_density: string, reading_flow: string<=80 },
  landing_system: {
    theme: "dark"|"light",
    tokens: { accent, deep, ink, surface, text: "#hex" },
    hero_recipe: "split-media"|"full-bleed"|"stacked"|"diagonal-band" (prefira split-media se houver foto de produto),
    section_order: string[] (subset of hero,pain,benefits,steps,pillars,angles,offer),
    effects: string[] (subset: glass, soft-shadow, diagonal, gradient-hero, tight-radius, pill-cta, square-cta),
    typography: { display: string, body: string },
    density: "high"|"medium"|"airy",
    cta_style: "pill"|"square"|"underline"
  },
  assets: {
    logo_url?: string;   // URL pública do logo da campanha (das image_urls do usuário)
    image_urls?: string[];
  },
  do: string[3..6],
  dont: string[3..6],
  generation_prompt: string<=280,
  negative_prompt: string<=180,
  overall_confidence: "high"|"medium"|"low",
  evidence_policy: "observed"|"inferred"|"recommended"
}`;

export function tokensCssFromModel(model: IdentityModel): string {
  const colors =
    (model.design_tokens as { colors?: Record<string, { value?: string }> } | undefined)?.colors ||
    {};
  const lines = Object.entries(colors)
    .filter(([, v]) => v?.value)
    .map(([k, v]) => `  --${k.replace(/_/g, "-")}: ${v!.value};`);
  const ls = model.landing_system as { tokens?: Record<string, string> } | undefined;
  if (ls?.tokens) {
    for (const [k, v] of Object.entries(ls.tokens)) {
      if (typeof v === "string" && /^#/.test(v)) {
        lines.push(`  --ls-${k.replace(/_/g, "-")}: ${v};`);
      }
    }
  }
  return `:root{\n${lines.join("\n")}\n}\n`;
}

function parseUrls(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s)]+/gi) || [];
  return [...new Set(found.map((u) => u.replace(/[.,;]+$/, "")))].slice(0, 5);
}

export async function generateCampaignIdentity(opts: {
  ctx: WorkspaceContext;
  report: ResearchReport;
  strategy: StrategyPlan;
  notes?: string;
  reference_urls?: string[];
  image_urls?: string[];
}): Promise<{ model: IdentityModel; css: string; captures: DesignSystemCapture[] }> {
  const { ctx, report, strategy, notes } = opts;
  const fromNotes = parseUrls(notes || "");
  const urls = [...new Set([...(opts.reference_urls || []), ...fromNotes])].slice(0, 5);
  const imageUrls = (opts.image_urls || []).filter((u) => /^https?:\/\//i.test(u)).slice(0, 6);
  const captures = urls.length ? await captureManyDesignSystems(urls, 3) : [];
  const blind = !notes?.trim() && !urls.length && !imageUrls.length;

  const model = await chatJson<IdentityModel>(
    `Você é o AGENTE DE IDENTIDADE. Trabalho = SINTETIZAR, não expandir.

Cruze briefing + research + estratégia + capturas de design system (sites de referência).
Das capturas: SELECIONE e FUNDA peças úteis (tokens, densidade, hero, efeitos). NÃO copie nome, logo ou copy do site alheio.
Preencha landing_system com decisões OPERACIONAIS para a LP (tema, tipografia, section_order, effects).

Ponto cego (sem peça): invente um sistema recommended. Não recuse. Não copie Flávio/22/#005BAA/#FFCB05 nem ProntEPI/teal SaaS se o briefing não for isso.

PROIBIDO: brandbook longo, nested specs enormes, listas de 10+, parágrafos, markdown, HTML alheio.
OBRIGATÓRIO: um JSON no shape abaixo, denso, operacional. Cabe em ~2.5k tokens de saída.

${CONTRACT_SHAPE}`,
    JSON.stringify({
      cego: blind,
      campanha: {
        nome: clip(ctx.produto || ctx.name, 80),
        tipo: ctx.type,
        nicho: clip(ctx.nicho, 100),
        oferta: clip(ctx.oferta, 120),
        tom: clip(ctx.tom_voz, 80),
      },
      notas: clip(notes, 400) || null,
      urls,
      imagens: imageUrls,
      design_system_captures: captures.map((c) => ({
        url: c.source_url,
        ok: c.ok,
        error: c.error || null,
        mood: c.mood,
        ui_density: c.ui_density,
        hero_style: c.hero_style,
        tokens: {
          colors: c.tokens.colors.slice(0, 8),
          fonts: c.tokens.fonts.slice(0, 4),
          radii: c.tokens.radii.slice(0, 4),
          shadows: c.tokens.shadows.slice(0, 3),
        },
        patterns: c.patterns,
        glass_or_motion: c.glass_or_motion,
        usable_pieces: c.usable_pieces,
        avoid: c.avoid,
      })),
      research: {
        resumo: clip(report.resumo, 280),
        visual: clipList(report.direcao_visual, 4, 90),
        hooks: clipList(report.hooks_vencedores, 4, 90),
      },
      strategy: {
        resumo: clip(strategy.resumo, 200),
        pilares: clipList(strategy.pilares, 4, 80),
        formatos: clipList(
          (strategy.posts || []).map((p) => p.formato),
          4,
          40
        ),
      },
    }),
    4000
  );

  // Logos/imagens coladas pelo usuário entram no contrato (não somem após o LLM).
  if (imageUrls.length) {
    const assets = (model.assets as { logo_url?: string; image_urls?: string[] } | undefined) || {};
    model.assets = {
      logo_url: assets.logo_url || imageUrls[0],
      image_urls: [...new Set([...(assets.image_urls || []), ...imageUrls])].slice(0, 8),
    };
  }

  return { model, css: tokensCssFromModel(model), captures };
}
