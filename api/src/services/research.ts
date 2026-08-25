import { scrapeCompetitors, type CompetitorProfile } from "./apify.js";
import { searchAdsForResearch, type AdSnippet } from "./adLibrary.js";
import { chatJson } from "./llm.js";

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

export async function runResearchPipeline(ctx: WorkspaceContext): Promise<{
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

  const report = await chatJson<ResearchReport>(
    `Você é pesquisador de mercado para Instagram (Brasil). NÃO há identidade visual ainda — NÃO fale de paleta, contrato de marca, conflito de identidade, Gotham, numeral 22, brand_kit.

Missão: o que o MERCADO (concorrentes + ads) faz, e o que ESTE produto pode ganhar. Campanha tipo=${ctx.type || "produto"} nome=${ctx.name || ctx.produto}.

PROIBIDO:
- abrir o resumo com "CONFLITO" / "identidade incompatível" / "skill campaign-design-apply"
- platitudes ("segurança e compromisso", "vídeos e imagens")
- assumir EPI/SaaS se o produto não for isso
- inventar likes, % ou ads que não estão nos dados

OBRIGATÓRIO:
- resumo: 4–8 frases factuais sobre o que viu nos perfis (temas de caption, provas, CTAs)
- o_que_concorrentes_fazem_bem: itens concretos citando @ ou tema de post
- oportunidades_unicas: lacunas vs o produto informado
- hooks_vencedores: frases no tom_voz do briefing (${ctx.tom_voz || "o tom declarado"})
- direcao_visual: 8–12 CENAS do nicho/produto em uso (pessoa, objeto, lugar, hora). Sem mockup de celular. Sem paleta de outra campanha.
- pilares_conteudo específicos deste produto

Ads: se ads_nicho vazio, diga que a coleta não retornou ads — não que o mercado não anuncia.

JSON: resumo, o_que_concorrentes_fazem_bem[], oportunidades_unicas[], formatos_que_performam[],
hooks_vencedores[], ctas_comuns[], pilares_conteudo[], direcao_visual[],
padrao_perfil_engajador { bio_sugerida, destaques[], ritmo_posts_semana, mix_formatos {feed,carrossel,reels} },
gaps_do_seu_perfil[], insights_ads[], fontes { apify, ad_library, modo_degradado }.`,
    JSON.stringify(
      {
        campanha: {
          tipo: ctx.type,
          nome: ctx.name,
          nicho: ctx.nicho,
          produto: ctx.produto,
          oferta: ctx.oferta,
          cta: ctx.cta,
          tom_voz: ctx.tom_voz,
          meu_ig: ctx.ig_username || "(ainda sem perfil)",
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
