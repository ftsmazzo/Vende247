export type AdSnippet = {
  pageName?: string;
  body?: string;
  linkTitle?: string;
  cta?: string;
  publisherPlatforms?: string[];
};

export type AdLibraryStatus =
  | "ok"
  | "no_token"
  | "api_error"
  | "empty"
  | "eu_only_commercial";

export type AdLibraryResult = {
  ads: AdSnippet[];
  status: AdLibraryStatus;
  detail?: string;
};

/**
 * Meta Ad Library (Graph ads_archive).
 *
 * Limitação oficial importante (BR / LATAM / US):
 * a API NÃO devolve anúncios comerciais genéricos nesses países —
 * só ads políticos / de interesse social (e, em geral, comerciais só se
 * atingiram UE/UK). Por isso "Ad Library vazia" no research BR NÃO prova
 * que o nicho não tem tráfego pago no Instagram/Facebook.
 *
 * Sem META_ACCESS_TOKEN → status no_token.
 */
export async function searchAdLibrary(query: string, limit = 20): Promise<AdLibraryResult> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const q = query.trim();
  if (!token) {
    return {
      ads: [],
      status: "no_token",
      detail: "META_ACCESS_TOKEN ausente — Ad Library API não consultada.",
    };
  }
  if (!q) {
    return { ads: [], status: "empty", detail: "Query vazia." };
  }

  const country = process.env.META_AD_LIBRARY_SEARCH_COUNTRY?.trim() || "BR";
  const params = new URLSearchParams({
    search_terms: q.slice(0, 100),
    ad_reached_countries: JSON.stringify([country]),
    ad_type: "ALL",
    ad_active_status: "ALL",
    fields:
      "page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,publisher_platforms",
    limit: String(Math.min(limit, 25)),
    access_token: token,
  });

  const url = `https://graph.facebook.com/v21.0/ads_archive?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text();
    console.warn("[adLibrary]", res.status, t.slice(0, 400));
    return {
      ads: [],
      status: "api_error",
      detail: `HTTP ${res.status}: ${t.slice(0, 180)}`,
    };
  }

  const data = (await res.json()) as {
    data?: Array<{
      page_name?: string;
      ad_creative_bodies?: string[];
      ad_creative_link_titles?: string[];
      ad_creative_link_captions?: string[];
      publisher_platforms?: string[];
    }>;
  };

  const ads = (data.data ?? []).map((ad) => ({
    pageName: ad.page_name,
    body: ad.ad_creative_bodies?.[0],
    linkTitle: ad.ad_creative_link_titles?.[0] ?? ad.ad_creative_link_captions?.[0],
    publisherPlatforms: ad.publisher_platforms,
  }));

  if (!ads.length) {
    const euCommercial =
      !["GB", "UK", "IE", "DE", "FR", "ES", "IT", "NL", "BE", "PT", "AT", "SE", "DK", "FI", "PL"].includes(
        country.toUpperCase()
      );
    return {
      ads: [],
      status: euCommercial ? "eu_only_commercial" : "empty",
      detail: euCommercial
        ? `API sem anúncios comerciais para país=${country}. No Brasil a Ad Library API não lista ads pagos comuns de SST/EPI — só políticos/sociais (ou comerciais que atingiram UE/UK). Use a UI facebook.com/ads/library para ver ads comerciais.`
        : `Nenhum anúncio encontrado para "${q}" em ${country}.`,
    };
  }

  return { ads, status: "ok" };
}

/** Compat: só a lista (research agrega status à parte). */
export async function searchAdLibraryAds(query: string, limit = 20): Promise<AdSnippet[]> {
  const r = await searchAdLibrary(query, limit);
  return r.ads;
}
