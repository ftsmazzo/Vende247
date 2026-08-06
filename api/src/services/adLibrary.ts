export type AdSnippet = {
  pageName?: string;
  body?: string;
  linkTitle?: string;
  cta?: string;
  publisherPlatforms?: string[];
  landingUrl?: string;
  imageUrl?: string;
  source?: "apify" | "meta_api";
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
 * Ads comerciais no BR: a Graph API oficial quase não devolve.
 * Preferimos scrape da Ad Library pública via Apify (mesmo APIFY_TOKEN).
 * Fallback: META_ACCESS_TOKEN (só útil p/ político/social ou UE/UK).
 */
export async function searchAdsForResearch(
  queries: string[],
  limit = 20
): Promise<AdLibraryResult> {
  const cleaned = [...new Set(queries.map((q) => q.trim()).filter((q) => q.length > 2))].slice(
    0,
    6
  );
  if (!cleaned.length) {
    return { ads: [], status: "empty", detail: "Sem queries de busca." };
  }

  const apify = await searchAdLibraryViaApify(cleaned, limit);
  if (apify.status === "ok" && apify.ads.length) return apify;

  const graph = await searchAdLibraryViaGraph(cleaned[0], limit);
  if (graph.status === "ok" && graph.ads.length) return graph;

  // Preferir detalhe do Apify (mais relevante no BR)
  if (apify.status !== "no_token") return apify;
  return graph;
}

async function searchAdLibraryViaApify(
  queries: string[],
  limit: number
): Promise<AdLibraryResult> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    return {
      ads: [],
      status: "no_token",
      detail: "APIFY_TOKEN ausente — scrape da Ad Library não rodou.",
    };
  }

  const actor =
    process.env.APIFY_AD_LIBRARY_ACTOR?.trim() || "viralanalyzer/facebook-ads-library";
  const country = process.env.META_AD_LIBRARY_SEARCH_COUNTRY?.trim() || "BR";
  // Uma run com OR: mais barato que N runs
  const searchQuery = queries.slice(0, 4).join(" OR ");
  const maxAds = Math.min(Math.max(limit, 8), 30);

  try {
    const runUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/runs?token=${encodeURIComponent(token)}&waitForFinish=180`;
    const start = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchQuery,
        country,
        adType: "all",
        activeStatus: "active",
        maxAds,
      }),
    });

    if (!start.ok) {
      const t = await start.text();
      console.warn("[adLibrary/apify]", start.status, t.slice(0, 400));
      return {
        ads: [],
        status: "api_error",
        detail: `Apify Ad Library HTTP ${start.status}: ${t.slice(0, 160)}`,
      };
    }

    const run = (await start.json()) as {
      data?: { defaultDatasetId?: string; status?: string };
    };
    const datasetId = run.data?.defaultDatasetId;
    if (!datasetId) {
      return {
        ads: [],
        status: "api_error",
        detail: "Apify Ad Library sem dataset.",
      };
    }

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&format=json`
    );
    if (!itemsRes.ok) {
      return {
        ads: [],
        status: "api_error",
        detail: `Apify dataset HTTP ${itemsRes.status}`,
      };
    }

    const items = (await itemsRes.json()) as Array<Record<string, unknown>>;
    const ads: AdSnippet[] = items
      .map((item) => {
        const body = String(
          item.adContent ?? item.bodyText ?? item.body ?? item.ad_creative_body ?? ""
        ).slice(0, 800);
        const pageName = String(item.pageName ?? item.page_name ?? item.advertiser ?? "").slice(
          0,
          120
        );
        if (!body && !pageName) return null;
        const platforms = item.platforms ?? item.publisherPlatform ?? item.publisher_platforms;
        return {
          pageName: pageName || undefined,
          body: body || undefined,
          linkTitle: String(item.displayLink ?? item.linkTitle ?? "").slice(0, 160) || undefined,
          cta: String(item.ctaText ?? item.cta ?? "").slice(0, 80) || undefined,
          landingUrl: String(item.landingUrl ?? item.linkUrl ?? "").slice(0, 300) || undefined,
          imageUrl: String(item.imageUrl ?? item.imageUrl1 ?? "").slice(0, 400) || undefined,
          publisherPlatforms: Array.isArray(platforms)
            ? platforms.map(String)
            : typeof platforms === "string"
              ? [platforms]
              : undefined,
          source: "apify" as const,
        };
      })
      .filter((x): x is AdSnippet => Boolean(x))
      .slice(0, maxAds);

    if (!ads.length) {
      return {
        ads: [],
        status: "empty",
        detail: `Apify Ad Library sem ads ativos para "${searchQuery}" em ${country}.`,
      };
    }

    return {
      ads,
      status: "ok",
      detail: `Apify Ad Library: ${ads.length} ads comerciais (país=${country}).`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[adLibrary/apify]", msg);
    return { ads: [], status: "api_error", detail: msg.slice(0, 200) };
  }
}

/** Graph API oficial — limitada fora da UE para ads comerciais. */
async function searchAdLibraryViaGraph(query: string, limit = 20): Promise<AdLibraryResult> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const q = query.trim();
  if (!token) {
    return {
      ads: [],
      status: "no_token",
      detail: "META_ACCESS_TOKEN ausente (fallback Graph não usado).",
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
    console.warn("[adLibrary/graph]", res.status, t.slice(0, 400));
    return {
      ads: [],
      status: "api_error",
      detail: `Graph HTTP ${res.status}: ${t.slice(0, 180)}`,
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
    source: "meta_api" as const,
  }));

  if (!ads.length) {
    return {
      ads: [],
      status: "eu_only_commercial",
      detail: `Graph API vazia em ${country} (esperado para ads comerciais no BR). Use Apify Ad Library.`,
    };
  }

  return { ads, status: "ok", detail: `Graph API: ${ads.length} ads.` };
}

/** @deprecated use searchAdsForResearch */
export async function searchAdLibrary(query: string, limit = 20): Promise<AdLibraryResult> {
  return searchAdsForResearch([query], limit);
}
