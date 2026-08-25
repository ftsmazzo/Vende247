import { scrapeCompetitors, type CompetitorProfile } from "./apify.js";
import { searchAdsForResearch, type AdSnippet } from "./adLibrary.js";
import { chatJson } from "./llm.js";
import { identityContextForLlm, type IdentityModel } from "./identityContract.js";

export type ResearchReport = {
  resumo: string;
  /** O que os concorrentes fazem de concreto (nao generico) */
  o_que_concorrentes_fazem_bem: string[];
  /** Lacunas / angulos que o produto pode dominar */
  oportunidades_unicas: string[];
  formatos_que_performam: string[];
  hooks_vencedores: string[];
  ctas_comuns: string[];
  pilares_conteudo: string[];
  /** Direcao visual: cenas humanas do nicho — NAO lista de mockups de celular */
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
    /** Como veio a Ad Library (Apify scrape vs Graph limitada) */
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
  type?: string;
  name?: string;
};

export async function runResearchPipeline(
  ctx: WorkspaceContext,
  identityModel?: IdentityModel | null
): Promise<{
  raw: { competitors: CompetitorProfile[]; ads: AdSnippet[] };
  report: ResearchReport;
}> {
  const competitors = await scrapeCompetitors(ctx.concorrentes);

  const adQueries = [
    ctx.nicho,
    ctx.produto.split(/[—\-–|/]/).map((s) => s.trim()).find(Boolean) || "",
    ...ctx.produto
      .split(/[\s,;—\-–|/]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 4)
      .slice(0, 3),
  ].filter((q) => q.length > 3);

  // Preferencia: Apify scrape da Ad Library publica (ads comerciais BR).
  // Graph META_ACCESS_TOKEN fica so como fallback (quase inutil no BR).
  const adBatch = await searchAdsForResearch(adQueries, 20);
  const ads = adBatch.ads;
  const adStatus = adBatch.status;
  const adLibraryNota =
    adBatch.detail ||
    (ads.length
      ? "Ads da Ad Library via Apify."
      : "Sem ads — confira APIFY_TOKEN / APIFY_AD_LIBRARY_ACTOR.");

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
        postUrl: p.url?.slice(0, 120),
      })),
  }));

  const identity = identityContextForLlm(identityModel);

  const report = await chatJson<ResearchReport>(
    `Voce e estrategista de conteudo para Instagram no Brasil.
Skill campaign-design-apply: a identidade visual ATIVA (JSON) manda no mood, paleta e cenas. Nao use paleta de outro produto nem de brand_kit legado.

Sua missao: insights DECISIVOS para vender ESTE produto (${ctx.type || "campanha"}: ${ctx.name || ctx.produto}) — nao platitudes.

PROIBIDO (generico demais):
- "seguranca e compromisso", "videos e imagens", "saiba mais na bio" sem contexto
- listas vagas tipo "formatos: video, carrossel"
- repetir o obvio do nicho sem amarrar ao produto
- assumir software B2B / EPI / SST se o produto nao for isso
- direcao_visual que contradiga recognition_cues, image_treatment ou dont da identidade
- se a identidade for campanha politica (22, retrato, diagonais, azul/amarelo/verde), NAO sugerir planner cristão, serifas piegas, tons bege/terracota

OBRIGATORIO:
- Citar padroes REAIS vistos nas captions/posts dos concorrentes (temas, angulos, provas)
- Separar o que concorrentes fazem bem vs o que o produto pode ganhar (oportunidades_unicas)
- Hooks concretos, no tom do produto E no tom da identidade (landing_page_style_spec.page_personality)
- direcao_visual: 8–12 cenas DIFERENTES que APLICAM a identidade ao produto (pessoa + paleta + composicao do contrato).
  Cada item = 1 frase de cena concreta. PROIBIDO: mockup de celular, dashboard, "foto profissional generica"
- Inferir o que as midias dos top posts sugerem pelo tipo + caption
- Bio e pilares especificos do produto informado

Se dados Apify (perfis) estiverem vazios, diga isso em resumo e ainda proponha angulos com base no produto + identidade (nao invente likes).

Sobre ads / Ad Library (CRITICO):
- Se ads_nicho TIVER itens (fonte Apify scrape ou Graph): use copy, CTA, landing e paginas como evidencia real de trafego pago. Cite padroes em insights_ads.
- Se ads_nicho estiver VAZIO: NAO diga que "o nicho nao tem anuncios pagos". Diga que a coleta nao retornou ads ativos para as queries e baseie insights_ads no organico Apify + produto.
- Nao confunda ausencia de dados com ausencia de mercado.

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
          ad_library_nota: adLibraryNota,
        },
        nota: "Imagens dos concorrentes NAO sao reutilizadas pixel a pixel; use captions+tipo+ads para padroes.",
        identidade_ativa: identity,
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
