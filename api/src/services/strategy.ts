import { chatJson } from "./llm.js";
import type { ResearchReport, WorkspaceContext } from "./research.js";
import type { BrandKit } from "./brandFromUrl.js";

export type CarouselSlide = {
  titulo: string;
  texto: string;
  visual_prompt: string;
};

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
  /** Slides do carrossel (3–5). Obrigatório se formato=carrossel */
  slides?: CarouselSlide[];
  /** Tipo de cena para diversidade */
  cena_tipo:
    | "hero_pessoa"
    | "produto_detalhe"
    | "rotina"
    | "emocao"
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
  "hero_pessoa",
  "produto_detalhe",
  "rotina",
  "emocao",
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
    `Você é diretor criativo de anúncios Instagram (Brasil, 2026).
Produto a vender: use SOMENTE ângulos do produto informado + research (oportunidades_unicas, direcao_visual, hooks).
Nicho: ${ctx.nicho}. NÃO force software B2B / EPI / indústria se o produto for outro.

Plano de exatamente ${n} dias. Cada post DEVE ser visualmente e tematicamente diferente do anterior.

PROIBIDO:
- visual_prompt com mockup de celular / "smartphone showing dashboard" / telas inventadas de app
- captions genéricas tipo "transforme sua vida" sem dor concreta do nicho
- repetir o mesmo layout visual, mesma locação ou mesmo ângulo de câmera em vários dias
- prometer vídeo gerado / motion / reels animado (o sistema ainda NÃO gera vídeo)
- copiar arte de concorrente; só reaproveitar ÂNGULOS de mensagem da research
- cenas industriais / EPI / fábrica salvo se o nicho for isso

OBRIGATÓRIO em cada post:
- hook específico à dor/desejo do público do nicho
- caption curta (máx 320 caracteres), 1ª linha = hook, CTA no fim
- visual_prompt = FOTO/CENA realista ÚNICA — use 1 item diferente de research.direcao_visual por dia;
  alinhe ao brand.visual_summary se existir; cores vivas ou soft conforme a marca
  texto no visual: 3–6 palavras em português, tipografia bold, longe das bordas
  especifique: local concreto + ângulo de câmera + hora do dia
- cena_tipo: um de hero_pessoa | produto_detalhe | rotina | emocao | antes_depois | prova_social | oferta
  — varie: não repita a mesma cena_tipo em dias consecutivos

FORMATOS:
- Mix: ~40% feed, 30% carrossel, 30% reels
- feed = 1 imagem
- carrossel = OBRIGATÓRIO campo slides[] com 4 ou 5 itens { titulo, texto, visual_prompt } — cada slide com cena/ângulo/texto DIFERENTE
- reels = ainda é IMAGEM ESTÁTICA estilo capa de reel (9:16 vibe em 4:5); NÃO descreva como vídeo

JSON: { resumo, dias, pilares[], posts[{ day, titulo, pilar, objetivo, formato, hook, estrutura, caption, cta, visual_prompt, slides?, cena_tipo }] }`,
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
              estilo: brand.visual_summary,
              product_ui_notes: brand.product_ui_notes,
            }
          : null,
        cena_rotation_sugerida: CENA_ROTATION.slice(0, n),
        regra_diversidade:
          "Cada visual_prompt deve citar uma cena distinta de direcao_visual; se faltar, invente variação de local/ângulo alinhada ao nicho.",
      },
      null,
      2
    )
  );

  plan.dias = n;
  if (!Array.isArray(plan.posts)) plan.posts = [];
  if (!Array.isArray(plan.pilares)) {
    plan.pilares = typeof plan.pilares === "string" && plan.pilares
      ? [plan.pilares]
      : [];
  } else {
    plan.pilares = plan.pilares.map((x) => (typeof x === "string" ? x : String(x)));
  }
  plan.resumo = typeof plan.resumo === "string" ? plan.resumo : String(plan.resumo ?? "");
  plan.posts = plan.posts.slice(0, n).map((p, i) => {
    const cena = normalizeCena(p.cena_tipo) || CENA_ROTATION[i % CENA_ROTATION.length];
    const hook = coerceText(p.hook) || coerceText(p.titulo) || "Hook";
    const titulo = coerceText(p.titulo) || `Dia ${i + 1}`;
    let visual = coerceText(p.visual_prompt).trim();
    const lower = visual.toLowerCase();
    if (
      !visual ||
      lower.includes("smartphone mockup") ||
      lower.includes("phone mockup") ||
      (lower.includes("smartphone") && lower.includes("dashboard")) ||
      (lower.match(/phone/g) || []).length >= 2
    ) {
      visual = fallbackVisual(ctx, brand, cena, hook);
    }
    const cue = (report.direcao_visual || [])[i % Math.max(report.direcao_visual?.length || 1, 1)];
    if (cue && !visual.toLowerCase().includes(cue.slice(0, 24).toLowerCase())) {
      visual = `${visual}. Scene mood from research: ${cue.slice(0, 160)}`;
    }
    const angles = [
      "wide shot morning light",
      "medium eye-level documentary",
      "close-up details shallow DOF",
      "low angle warm side light",
      "over-shoulder quiet moment",
      "high angle flat lay",
      "candid two-shot lifestyle",
    ];
    visual = `${visual}. Camera: ${angles[i % angles.length]}.`;

    const formato = (["feed", "carrossel", "reels"].includes(String(p.formato))
      ? p.formato
      : "feed") as CreativeBrief["formato"];

    let slides = Array.isArray(p.slides) ? p.slides : undefined;
    if (formato === "carrossel") {
      slides = normalizeCarouselSlides(slides, visual, hook, ctx, brand, cena);
      slides = slides.map((s, si) => ({
        ...s,
        visual_prompt: `${s.visual_prompt}. Camera: ${angles[(i + si + 1) % angles.length]}. Distinct from other slides.`,
      }));
    }

    return {
      ...p,
      day: i + 1,
      titulo,
      hook,
      pilar: coerceText(p.pilar),
      objetivo: p.objetivo,
      estrutura: coerceText(p.estrutura),
      caption: coerceText(p.caption),
      cta: coerceText(p.cta),
      formato,
      cena_tipo: cena,
      visual_prompt: visual,
      slides,
    };
  });

  return plan;
}

function normalizeCena(raw: unknown): CreativeBrief["cena_tipo"] | null {
  const s = String(raw || "");
  const map: Record<string, CreativeBrief["cena_tipo"]> = {
    hero_pessoa: "hero_pessoa",
    produto_detalhe: "produto_detalhe",
    rotina: "rotina",
    emocao: "emocao",
    antes_depois: "antes_depois",
    prova_social: "prova_social",
    oferta: "oferta",
    // legado EPI → equivalentes genéricos
    trabalhador_epi: "hero_pessoa",
    biometria_entrega: "produto_detalhe",
    estoque_ca: "produto_detalhe",
    gestor_alerta: "emocao",
  };
  return map[s] ?? null;
}

function coerceText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v
      .map((x) => coerceText(x))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const parts = [o.titulo, o.texto, o.body, o.caption, o.hook]
      .map((x) => coerceText(x))
      .filter(Boolean);
    if (parts.length) return parts.join(" — ");
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }
  return "";
}

export function normalizeCarouselSlides(
  slides: CarouselSlide[] | undefined,
  coverVisual: string,
  hook: string,
  ctx: WorkspaceContext,
  brand: BrandKit | null | undefined,
  cena: CreativeBrief["cena_tipo"]
): CarouselSlide[] {
  const h = (hook || ctx.produto.split(/[—\-–]/)[0] || "Oferta").slice(0, 36);
  const defaults: CarouselSlide[] = [
    {
      titulo: "Hook",
      texto: h,
      visual_prompt: coverVisual || fallbackVisual(ctx, brand, cena, h),
    },
    {
      titulo: "Dor",
      texto: "Sem constância no dia a dia?",
      visual_prompt: fallbackVisual(ctx, brand, "emocao", "PARE DE ADIAR"),
    },
    {
      titulo: "Solução",
      texto: ctx.produto.split(/[—\-–]/)[0]?.trim().slice(0, 40) || "Seu novo ritual",
      visual_prompt: fallbackVisual(ctx, brand, "produto_detalhe", "COMECE HOJE"),
    },
    {
      titulo: "Prova",
      texto: "Feito para a sua rotina",
      visual_prompt: fallbackVisual(ctx, brand, "rotina", "ROTINA COM PROPÓSITO"),
    },
    {
      titulo: "CTA",
      texto: ctx.cta || "Chama no Direct",
      visual_prompt: fallbackVisual(ctx, brand, "oferta", (ctx.cta || "QUERO AGORA").slice(0, 28)),
    },
  ];

  if (!slides?.length) return defaults.slice(0, 4);

  const cleaned = slides
    .map((s, i) => ({
      titulo: (s.titulo || `Slide ${i + 1}`).slice(0, 40),
      texto: (s.texto || s.titulo || h).slice(0, 80),
      visual_prompt: (
        s.visual_prompt ||
        coverVisual ||
        fallbackVisual(ctx, brand, cena, s.texto || h)
      ).trim(),
    }))
    .filter((s) => s.visual_prompt);

  while (cleaned.length < 3) {
    cleaned.push(defaults[cleaned.length]);
  }
  return cleaned.slice(0, 5);
}

function fallbackVisual(
  ctx: WorkspaceContext,
  brand: BrandKit | null | undefined,
  cena: CreativeBrief["cena_tipo"],
  hook: string
): string {
  const h = (hook || ctx.produto.split(/[—\-–]/)[0] || "Oferta").slice(0, 40);
  const mood =
    brand?.visual_summary?.slice(0, 160) ||
    "warm soft editorial lighting, authentic lifestyle, Instagram 4:5";
  const product = ctx.produto.slice(0, 100);
  const scenes: Record<CreativeBrief["cena_tipo"], string> = {
    hero_pessoa: `Woman in a calm lifestyle moment connected to "${product}", bold Portuguese text "${h}", ${mood}, cinematic photo, no phone mockups`,
    produto_detalhe: `Close-up of digital planner / journal pages and cozy props for "${product}", text "${h}", ${mood}, shallow depth of field`,
    rotina: `Morning quiet-time ritual with coffee, open notebook and soft natural light for "${product}", text "${h}", ${mood}`,
    emocao: `Emotional authentic portrait, hopeful soft expression, warm tones, text "${h}", product mood: ${product}, ${mood}`,
    antes_depois: `Split concept: scattered notes and overwhelm vs calm organized faith routine with planner, text "${h}", ${mood}`,
    prova_social: `Warm community / friendship moment of women sharing encouragement, authentic photo, text "${h}", ${mood}`,
    oferta: `Inviting product showcase of "${product}" with clear CTA text "${h}", bright commercial lifestyle photo, ${mood}`,
  };
  return scenes[cena];
}
