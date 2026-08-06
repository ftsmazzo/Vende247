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
    /** Por que Meta veio vazia / limitada — honestidade com o usuário */
    ad_library_nota?: string;
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

  const adQueries = [
    ctx.nicho,
    ctx.produto.split(/[—\-–]/).map((s) => s.trim()).find(Boolean) || "",
    "gestão de EPI",
    "software SST",
    "entrega de EPI",
    "NR-6",
  ].filter((q) => q.length > 3);

  const adsNested = await Promise.all(
    adQueries.slice(0, 4).map((q) => searchAdLibrary(q, 12))
  );
  const adsMap = new Map<string, AdSnippet>();
  let adStatus = adsNested[0]?.status ?? "empty";
  let adDetail = adsNested[0]?.detail;
  for (const batch of adsNested) {
    if (batch.status === "ok") adStatus = "ok";
    else if (adStatus !== "ok" && batch.detail) {
      adStatus = batch.status;
      adDetail = batch.detail;
    }
    for (const ad of batch.ads) {
      const key = `${ad.pageName}|${ad.body?.slice(0, 80)}`;
      if (!adsMap.has(key)) adsMap.set(key, ad);
    }
  }
  const ads = [...adsMap.values()].slice(0, 25);
  const apifyOk = competitors.some((c) => c.source === "apify" && c.posts.length > 0);
  const adOk = ads.length > 0;
  const degraded = !apifyOk;

  const adLibraryNota =
    adDetail ||
    (adOk
      ? "Ads retornados pela API (escopo limitado por país)."
      : "Ad Library API sem resultados comerciais úteis para BR — não interprete como ‘nicho sem tráfego pago’.");

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
        // URL do post (não baixamos a foto — só inspira análise de formato/tema)
        postUrl: p.url?.slice(0, 120),
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
- direcao_visual: 8–12 cenas HUMANAS / operação DIFERENTES entre si (trabalhador EPI, entrega facial, estoque, auditoria, gestor pátio, consultor, antes/depois documental, close de CA, equipe em checklist). Cada item = 1 frase de cena concreta. PROIBIDO: "mockup de celular", "dashboard genérico", "foto profissional genérica"
- Inferir o que as mídias dos top posts sugerem pelo tipo (GraphImage/Video/Sidecar) + caption — mesmo sem ver o JPEG
- Bio e pilares específicos do produto informado

Se dados Apify estiverem vazios, diga isso em resumo e ainda proponha ângulos com base no produto (não invente likes).

Sobre Meta Ad Library (CRÍTICO):
- Se ads_nicho estiver vazio OU flags.ad_library_limitacao indicar cobertura limitada no BR: NÃO diga que “o nicho não tem anúncios pagos” ou “Ad Library vazia = sem tráfego pago”.
- Explique em 1 frase que a API oficial da Meta no Brasil quase não devolve ads comerciais (só políticos/sociais; comerciais plenos via API são tipicamente UE/UK).
- Em insights_ads: foque em hipóteses a partir do Apify + produto; sugira validar ads manuais em facebook.com/ads/library se o usuário quiser.
- Só afirme padrões de ads pagos se houver itens reais em ads_nicho.

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
        flags: {
          apifyOk,
          adOk,
          degraded,
          ad_library_status: adStatus,
          ad_library_limitacao: adLibraryNota,
        },
        nota: "As imagens dos concorrentes NÃO são reutilizadas pixel a pixel; use captions+tipo para extrair padrões visuais e de mensagem.",
      },
      null,
      2
    )
  );

  report.fontes = {
    apify: apifyOk,
    ad_library: adOk,
    modo_degradado: degraded,
    ad_library_nota: adLibraryNota,
  };
  report.o_que_concorrentes_fazem_bem = report.o_que_concorrentes_fazem_bem ?? [];
  report.oportunidades_unicas = report.oportunidades_unicas ?? [];
  report.direcao_visual = report.direcao_visual ?? [];

  return { raw: { competitors, ads }, report };
}
