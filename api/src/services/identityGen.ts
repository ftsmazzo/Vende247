import { extractBrandFromUrl, type BrandKit } from "./brandFromUrl.js";
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
  return `:root{\n${lines.join("\n")}\n}\n`;
}

function parseUrls(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s)]+/gi) || [];
  return [...new Set(found.map((u) => u.replace(/[.,;]+$/, "")))].slice(0, 5);
}

async function gatherUrlEvidence(urls: string[]): Promise<BrandKit[]> {
  const out: BrandKit[] = [];
  for (const url of urls.slice(0, 3)) {
    try {
      out.push(await extractBrandFromUrl(url));
    } catch {
      out.push({ site_url: url, visual_summary: "(não deu para ler a página)", source: "url" });
    }
  }
  return out;
}

export async function generateCampaignIdentity(opts: {
  ctx: WorkspaceContext;
  report: ResearchReport;
  strategy: StrategyPlan;
  notes?: string;
  reference_urls?: string[];
  image_urls?: string[];
}): Promise<{ model: IdentityModel; css: string }> {
  const { ctx, report, strategy, notes } = opts;
  const fromNotes = parseUrls(notes || "");
  const urls = [...new Set([...(opts.reference_urls || []), ...fromNotes])].slice(0, 5);
  const imageUrls = (opts.image_urls || []).filter((u) => /^https?:\/\//i.test(u)).slice(0, 6);
  const siteEvidence = urls.length ? await gatherUrlEvidence(urls) : [];
  const blind = !notes?.trim() && !urls.length && !imageUrls.length;

  const model = await chatJson<IdentityModel>(
    `Você é o AGENTE DE IDENTIDADE. Trabalho = SINTETIZAR, não expandir.

Cruze briefing + research + estratégia + referências. Extraia decisões visuais. Descarte repetição.

Ponto cego (sem peça): invente um sistema recommended. Não recuse. Não copie Flávio/22/#005BAA/#FFCB05 nem ProntEPI/teal SaaS se o briefing não for isso.

PROIBIDO: brandbook longo, nested specs enormes, listas de 10+, parágrafos, markdown.
OBRIGATÓRIO: um JSON no shape abaixo, denso, operacional. Cabe em ~2k tokens de saída.

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
      sites: siteEvidence.map((k) => ({
        url: k.site_url,
        cores: (k.colors || []).slice(0, 5),
        resumo: clip(k.visual_summary, 160),
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
    3500
  );

  return { model, css: tokensCssFromModel(model) };
}
