import { chatJson } from "./llm.js";
import type { ResearchReport } from "./research.js";
import type { WorkspaceContext } from "./research.js";

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
  visual_prompt: string;
};

export type StrategyPlan = {
  resumo: string;
  dias: number;
  pilares: string[];
  posts: CreativeBrief[];
};

export async function generateStrategy(
  ctx: WorkspaceContext,
  report: ResearchReport,
  days = 7
): Promise<StrategyPlan> {
  const n = Math.min(Math.max(days, 7), 14);

  const plan = await chatJson<StrategyPlan>(
    `Você é diretor criativo de Instagram focado em conteúdo que PARA o scroll e CONVERTE (2026).
Crie um plano de ${n} dias para anunciar/vender o produto usando padrões do research.
Regras de caption: curta (máx ~400 caracteres), hook na 1ª linha, CTA claro. SEM textão.
visual_prompt: descreva cena fotográfica/comercial viral, texto curto no visual (hook de 3–6 palavras), contraste alto.
formato: preferir mix alinhado ao research (feed/carrossel/reels).
Responda JSON: { resumo, dias, pilares[], posts[{ day, titulo, pilar, objetivo, formato, hook, estrutura, caption, cta, visual_prompt }] }
posts deve ter exatamente ${n} itens, day de 1 a ${n}.`,
    JSON.stringify({ workspace: ctx, research: report }, null, 2)
  );

  plan.dias = n;
  if (!Array.isArray(plan.posts)) plan.posts = [];
  plan.posts = plan.posts.slice(0, n).map((p, i) => ({
    ...p,
    day: i + 1,
    formato: (["feed", "carrossel", "reels"].includes(p.formato) ? p.formato : "feed") as CreativeBrief["formato"],
  }));

  return plan;
}
