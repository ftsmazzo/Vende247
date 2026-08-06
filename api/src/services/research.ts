import { scrapeCompetitors, type CompetitorProfile } from "./apify.js";
import { searchAdLibrary, type AdSnippet } from "./adLibrary.js";
import { chatJson } from "./llm.js";

export type ResearchReport = {
  resumo: string;
  formatos_que_performam: string[];
  hooks_vencedores: string[];
  ctas_comuns: string[];
  pilares_conteudo: string[];
  padrao_perfil_engajador: {
    bio_sugerida: string;
    destaques: string[];
    ritmo_posts_semana: number;
    mix_formatos: { feed: number; carrossel: number; reels: number };
  };
  gaps_do_seu_perfil: string[];
  insights_ads: string[];
  fontes: {
    apify: boolean;
    ad_library: boolean;
    modo_degradado: boolean;
  };
};

export type WorkspaceContext = {
  nicho: string;
  produto: string;
  oferta: string;
  cta: string;
  tom_voz: string;
  concorrentes: string[];
  ig_username: string;
};

export async function runResearchPipeline(ctx: WorkspaceContext): Promise<{
  raw: { competitors: CompetitorProfile[]; ads: AdSnippet[] };
  report: ResearchReport;
}> {
  const competitors = await scrapeCompetitors(ctx.concorrentes);
  const ads = await searchAdLibrary(ctx.nicho || ctx.produto, 20);
  const apifyOk = competitors.some((c) => c.source === "apify" && c.posts.length > 0);
  const adOk = ads.length > 0;
  const degraded = !apifyOk;

  const compactCompetitors = competitors.map((c) => ({
    username: c.username,
    biography: c.biography,
    followers: c.followers,
    topPosts: [...c.posts]
      .sort((a, b) => b.likes + b.comments * 3 - (a.likes + a.comments * 3))
      .slice(0, 8)
      .map((p) => ({
        type: p.type,
        likes: p.likes,
        comments: p.comments,
        caption: p.caption.slice(0, 400),
      })),
  }));

  const report = await chatJson<ResearchReport>(
    `Você é estrategista sênior de Instagram e performance criativa (2026).
Analise concorrentes e anúncios do nicho. Seja específico, acionável e em português do Brasil.
NÃO invente métricas falsas quando os dados estiverem vazios — diga o que falta e ainda proponha um padrão engajador baseado em melhores práticas do nicho.
Responda em JSON com as chaves:
resumo, formatos_que_performam (array), hooks_vencedores (array), ctas_comuns (array),
pilares_conteudo (array), padrao_perfil_engajador { bio_sugerida, destaques[], ritmo_posts_semana, mix_formatos {feed,carrossel,reels} },
gaps_do_seu_perfil (array), insights_ads (array), fontes { apify, ad_library, modo_degradado }.`,
    JSON.stringify(
      {
        workspace: {
          nicho: ctx.nicho,
          produto: ctx.produto,
          oferta: ctx.oferta,
          cta: ctx.cta,
          tom_voz: ctx.tom_voz,
          meu_ig: ctx.ig_username || "(vazio / quase sem posts)",
        },
        competitors: compactCompetitors,
        ads: ads.slice(0, 15),
        flags: { apifyOk, adOk, degraded },
      },
      null,
      2
    )
  );

  report.fontes = {
    apify: apifyOk,
    ad_library: adOk,
    modo_degradado: degraded,
  };

  return { raw: { competitors, ads }, report };
}
