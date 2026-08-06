import { chatJson } from "./llm.js";
import type { ResearchReport, WorkspaceContext } from "./research.js";
import type { BrandKit } from "./brandFromUrl.js";

export type CreativeBrief = {
  day: number;
  titulo: string;
  pilar: string;
  objetivo: "atracao" | "autoridade" | "prova" | "oferta" | "engajamento";
  formato: "feed" | "carrossel" | "reels";
  hook: string;
  estrutura: string;
  caption: string;
  cta: string;
  /** Cena visual — NÃO mockup de celular repetido */
  visual_prompt: string;
  /** Tipo de cena para diversidade */
  cena_tipo:
    | "trabalhador_epi"
    | "biometria_entrega"
    | "estoque_ca"
    | "gestor_alerta"
    | "antes_depois"
    | "prova_social"
    | "oferta";
};

export type StrategyPlan = {
  resumo: string;
  dias: number;
  pilares: string[];
  posts: CreativeBrief[];
};

const CENA_ROTATION: CreativeBrief["cena_tipo"][] = [
  "trabalhador_epi",
  "biometria_entrega",
  "estoque_ca",
  "gestor_alerta",
  "antes_depois",
  "prova_social",
  "oferta",
];

export async function generateStrategy(
  ctx: WorkspaceContext,
  report: ResearchReport,
  days = 7,
  brand?: BrandKit | null
): Promise<StrategyPlan> {
  const n = Math.min(Math.max(days, 7), 14);

  const plan = await chatJson<StrategyPlan>(
    `Você é diretor criativo de anúncios Instagram para software SST/EPI (Brasil, 2026).
Produto a vender: use SOMENTE ângulos do produto informado + research (oportunidades_unicas, direcao_visual, hooks).

Plano de exatamente ${n} dias. Cada post DEVE ser diferente do anterior.

PROIBIDO:
- visual_prompt com mockup de celular / "smartphone showing dashboard" / telas inventadas de app
- captions genéricas tipo "transforme sua gestão" sem dor concreta
- repetir o mesmo layout visual em vários dias

OBRIGATÓRIO em cada post:
- hook específico (dor: CA vencido, planilha, multa, biometria, consultor multi-cliente, auditoria)
- caption curta (máx 320 caracteres), 1ª linha = hook, CTA no fim
- visual_prompt = FOTO/CENA realista de ambiente industrial ou operação SST:
  trabalhador com capacete/luvas/óculos, entrega com reconhecimento facial, estoque de EPI, gestor no pátio, auditoria — cores vivas, impacto emocional
  texto no visual: 3–6 palavras em português, tipografia bold
- cena_tipo: um de trabalhador_epi | biometria_entrega | estoque_ca | gestor_alerta | antes_depois | prova_social | oferta
  — varie: no máximo 1 post com celular E só se for mão de operador no pátio (não mockup 3D de marketing)

Mix: ~40% feed, 30% carrossel, 30% reels (carrossel = estrutura em slides na campo estrutura).

JSON: { resumo, dias, pilares[], posts[{ day, titulo, pilar, objetivo, formato, hook, estrutura, caption, cta, visual_prompt, cena_tipo }] }`,
    JSON.stringify(
      {
        workspace: ctx,
        research: {
          resumo: report.resumo,
          oportunidades_unicas: report.oportunidades_unicas,
          o_que_concorrentes_fazem_bem: report.o_que_concorrentes_fazem_bem,
          hooks_vencedores: report.hooks_vencedores,
          pilares_conteudo: report.pilares_conteudo,
          direcao_visual: report.direcao_visual,
          ctas_comuns: report.ctas_comuns,
        },
        brand: brand
          ? {
              colors: brand.colors,
              visual_summary: brand.visual_summary,
              // UI notes só como referência de cor/estilo — NÃO pedir mockup de tela
              estilo: brand.visual_summary,
            }
          : null,
        cena_rotation_sugerida: CENA_ROTATION.slice(0, n),
      },
      null,
      2
    )
  );

  plan.dias = n;
  if (!Array.isArray(plan.posts)) plan.posts = [];
  plan.posts = plan.posts.slice(0, n).map((p, i) => {
    const cena = CENA_ROTATION[i % CENA_ROTATION.length];
    let visual = (p.visual_prompt || "").trim();
    const lower = visual.toLowerCase();
    if (
      !visual ||
      lower.includes("smartphone mockup") ||
      lower.includes("phone mockup") ||
      (lower.includes("smartphone") && lower.includes("dashboard")) ||
      (lower.match(/phone/g) || []).length >= 2
    ) {
      visual = fallbackVisual(ctx, cena, p.hook || p.titulo);
    }
    return {
      ...p,
      day: i + 1,
      formato: (["feed", "carrossel", "reels"].includes(p.formato)
        ? p.formato
        : "feed") as CreativeBrief["formato"],
      cena_tipo: p.cena_tipo || cena,
      visual_prompt: visual,
    };
  });

  return plan;
}

function fallbackVisual(
  ctx: WorkspaceContext,
  cena: CreativeBrief["cena_tipo"],
  hook: string
): string {
  const h = (hook || "ProntEPI").slice(0, 40);
  const scenes: Record<CreativeBrief["cena_tipo"], string> = {
    trabalhador_epi: `Industrial worker wearing hard hat, safety glasses and gloves on factory floor, bold Portuguese text "${h}", vibrant safety yellow and deep blue, cinematic lighting, Instagram 4:5, no phone mockups`,
    biometria_entrega: `PPE delivery moment: worker face recognition at warehouse counter with safety gear on shelf, supervisor tablet discreetly in background, text "${h}", high contrast, documentary photo style, no fake app UI`,
    estoque_ca: `Organized EPI warehouse shelves with helmets and gloves, label tags for CA certificates, inspector checking validity, text "${h}", colorful industrial photo`,
    gestor_alerta: `Safety manager on plant floor looking concerned at clipboard/alerts, workers with PPE behind, urgent bold text "${h}", dramatic light`,
    antes_depois: `Split concept: messy paper spreadsheets vs calm organized PPE control operation, workers with EPI, text "${h}", bold graphic photo collage`,
    prova_social: `Diverse industrial team in full PPE smiling after successful safety check, authentic workplace, text "${h}", warm energetic colors`,
    oferta: `Confident SST consultant presenting to plant managers in hard hats, handshake energy, product ${ctx.produto.slice(0, 80)}, CTA text "${h}", bright commercial photo`,
  };
  return scenes[cena];
}
