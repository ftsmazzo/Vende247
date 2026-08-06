import { scrapeCompetitors, type CompetitorProfile } from "./apify.js";
import { searchAdLibrary, type AdSnippet } from "./adLibrary.js";
import { chatJson } from "./llm.js";

export type ResearchReport = {
  resumo: string;
  /** O que os concorrentes fazem de concreto (não genérico) */
  o_que_concorrentes_fazem_bem: string[];
  /** Lacunas / ângulos que o produto pode dominar */
  oportunidades_unicas: string[];
  formatos_que_performam: string[];
  hooks_vencedores: string[];
  ctas_comuns: string[];
  pilares_conteudo: string[];
  /** Direção visual: cenas humanas, EPI, fábrica — NÃO lista de mockups de celular */
  direcao_visual: string[];
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
      .slice(0, 10)
      .map((p) => ({
        type: p.type,
        likes: p.likes,
        comments: p.comments,
        caption: p.caption.slice(0, 500),
      })),
  }));

  const report = await chatJson<ResearchReport>(
    `Você é estrategista de conteúdo B2B para Instagram no Brasil (SST / EPI / software industrial).
Sua missão: insights DECISIVOS para vender ESTE produto — não platitudes de marketing.

PROIBIDO (genérico demais):
- "segurança é compromisso", "vídeos e imagens", "saiba mais na bio" sem contexto
- listas vagas tipo "formatos: vídeo, carrossel"
- repetir o óbvio do nicho sem amarrar ao produto

OBRIGATÓRIO:
- Citar padrões REAIS vistos nas captions/posts dos concorrentes (temas, ângulos, provas)
- Separar o que concorrentes fazem bem vs o que o produto pode ganhar (oportunidades_unicas)
- Hooks concretos, no tom do produto (ex.: biometria na entrega, CA vencendo, consultor multi-cliente, planilha vs painel)
- direcao_visual: 5–8 cenas HUMANAS / operação (trabalhador com EPI, entrega facial, estoque, auditoria, gestor no pátio). PROIBIDO sugerir "só mockup de celular/dashboard genérico"
- Bio e pilares específicos do produto informado

Se dados Apify estiverem vazios, diga isso em resumo e ainda proponha ângulos com base no produto (não invente likes).

JSON com chaves:
resumo, o_que_concorrentes_fazem_bem[], oportunidades_unicas[], formatos_que_performam[],
hooks_vencedores[], ctas_comuns[], pilares_conteudo[], direcao_visual[],
padrao_perfil_engajador { bio_sugerida, destaques[], ritmo_posts_semana, mix_formatos {feed,carrossel,reels} },
gaps_do_seu_perfil[], insights_ads[], fontes { apify, ad_library, modo_degradado }.`,
    JSON.stringify(
      {
        produto_a_vender: {
          nicho: ctx.nicho,
          produto: ctx.produto,
          oferta: ctx.oferta,
          cta: ctx.cta,
          tom_voz: ctx.tom_voz,
          meu_ig: ctx.ig_username || "(perfil quase vazio — construir do zero)",
        },
        concorrentes_analisados: compactCompetitors,
        ads_nicho: ads.slice(0, 15),
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
  report.o_que_concorrentes_fazem_bem = report.o_que_concorrentes_fazem_bem ?? [];
  report.oportunidades_unicas = report.oportunidades_unicas ?? [];
  report.direcao_visual = report.direcao_visual ?? [];

  return { raw: { competitors, ads }, report };
}
