import { scrapeCompetitors, type CompetitorProfile } from "./apify.js";
import { searchAdsForResearch, type AdSnippet } from "./adLibrary.js";
import { chatJson } from "./llm.js";
import { TILLI_SKILL_RESEARCH } from "../data/tilliPrompts.js";
import type { CompanyFacts } from "./companyKnowledge.js";

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
  diagnostico?: {
    critico?: string[];
    alto_impacto?: string[];
    otimizacao?: string[];
    ignorar?: string[];
    tres_mudancas_7_dias?: string[];
    maior_impacto?: string;
  };
  posicionamento?: {
    frase?: string;
    promessa?: string;
    bio?: string;
    cta_bio?: string;
    destaques?: string[];
    posts_fixados?: string[];
    mensagens_saturadas?: string[];
  };
  funil?: {
    etapas?: string[];
    ctas_direct?: string[];
    mensagem_inicial?: string;
    perguntas_qualificacao?: string[];
  };
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
  company?: CompanyFacts | null
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

  const report = await chatJson<ResearchReport>(
    `${TILLI_SKILL_RESEARCH}

Você executa essa skill agora, dentro do Vende247, para a campanha ${ctx.name || ctx.produto} (${ctx.type || "produto"}).
A Empresa no JSON é a fonte do produto, do público, das objeções e da prova. A campanha é o recorte comercial. Concorrentes e ads são a evidência.
Não há identidade visual nesta etapa: não fale de paleta, Gotham, numeral 22 nem de outro produto que não esteja na Empresa.

PROIBIDO: platitude, número inventado, assumir EPI/SaaS se a Empresa não for isso, dizer que o mercado não anuncia se ads_nicho veio vazio (diga que a coleta não retornou ads).

JSON obrigatório:
resumo (8–12 frases: o que os perfis fazem e o que esta empresa pode ganhar),
diagnostico { critico[], alto_impacto[], otimizacao[], ignorar[], tres_mudancas_7_dias[], maior_impacto },
posicionamento { frase, promessa, bio, cta_bio, destaques[], posts_fixados[], mensagens_saturadas[] },
funil { etapas[] (uma frase por etapa do caminho), ctas_direct[], mensagem_inicial, perguntas_qualificacao[] },
o_que_concorrentes_fazem_bem[], oportunidades_unicas[], formatos_que_performam[],
hooks_vencedores[] (no tom ${ctx.tom_voz || "da empresa"}), ctas_comuns[], pilares_conteudo[],
direcao_visual[] (8–12 cenas reais: pessoa, objeto, lugar, hora; sem mockup de celular),
padrao_perfil_engajador { bio_sugerida, destaques[], ritmo_posts_semana, mix_formatos {feed,carrossel,reels} },
gaps_do_seu_perfil[], insights_ads[].`,
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
        empresa: company || null,
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
    ),
    7500
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
