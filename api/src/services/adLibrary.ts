export type AdSnippet = {
  pageName?: string;
  body?: string;
  linkTitle?: string;
  cta?: string;
  publisherPlatforms?: string[];
};

/**
 * Busca anúncios na Meta Ad Library (Graph API).
 * Requer META_ACCESS_TOKEN. Sem token, retorna lista vazia.
 */
export async function searchAdLibrary(query: string, limit = 20): Promise<AdSnippet[]> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const q = query.trim();
  if (!token || !q) return [];

  const country = process.env.META_AD_LIBRARY_SEARCH_COUNTRY?.trim() || "BR";
  const params = new URLSearchParams({
    search_terms: q.slice(0, 100),
    ad_reached_countries: JSON.stringify([country]),
    ad_type: "ALL",
    ad_active_status: "ACTIVE",
    fields: "page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,publisher_platforms",
    limit: String(Math.min(limit, 25)),
    access_token: token,
  });

  const url = `https://graph.facebook.com/v21.0/ads_archive?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text();
    console.warn("[adLibrary]", res.status, t.slice(0, 400));
    return [];
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

  return (data.data ?? []).map((ad) => ({
    pageName: ad.page_name,
    body: ad.ad_creative_bodies?.[0],
    linkTitle: ad.ad_creative_link_titles?.[0] ?? ad.ad_creative_link_captions?.[0],
    publisherPlatforms: ad.publisher_platforms,
  }));
}
