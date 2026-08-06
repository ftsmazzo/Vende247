export type CompetitorPost = {
  username: string;
  caption: string;
  likes: number;
  comments: number;
  type: string;
  url?: string;
  timestamp?: string;
};

export type CompetitorProfile = {
  username: string;
  fullName?: string;
  biography?: string;
  followers?: number;
  posts: CompetitorPost[];
  source: "apify" | "fallback";
};

function normalizeHandle(h: string): string {
  return h.replace(/^@/, "").trim().toLowerCase();
}

/**
 * Coleta posts públicos via Apify Instagram Profile Scraper.
 * Sem APIFY_TOKEN, retorna perfil stub para a IA ainda gerar research (modo degradado).
 */
export async function scrapeCompetitors(handles: string[]): Promise<CompetitorProfile[]> {
  const list = handles.map(normalizeHandle).filter(Boolean).slice(0, 5);
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token || list.length === 0) {
    return list.map((username) => ({
      username,
      biography: "",
      followers: 0,
      posts: [],
      source: "fallback" as const,
    }));
  }

  const actor = process.env.APIFY_IG_ACTOR?.trim() || "apify/instagram-profile-scraper";
  const runUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/runs?token=${encodeURIComponent(token)}&waitForFinish=120`;

  const start = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usernames: list,
      resultsLimit: 12,
    }),
  });

  if (!start.ok) {
    const errText = await start.text();
    throw new Error(`Apify falhou (${start.status}): ${errText.slice(0, 300)}`);
  }

  const run = (await start.json()) as {
    data?: { defaultDatasetId?: string; status?: string };
  };
  const datasetId = run.data?.defaultDatasetId;
  if (!datasetId) {
    throw new Error("Apify não retornou dataset.");
  }

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&format=json`
  );
  if (!itemsRes.ok) {
    throw new Error(`Apify dataset HTTP ${itemsRes.status}`);
  }

  const items = (await itemsRes.json()) as Array<Record<string, unknown>>;
  const byUser = new Map<string, CompetitorProfile>();

  for (const username of list) {
    byUser.set(username, { username, posts: [], source: "apify" });
  }

  for (const item of items) {
    const username = normalizeHandle(
      String(item.username ?? item.ownerUsername ?? item.userName ?? "")
    );
    if (!username) continue;
    let profile = byUser.get(username);
    if (!profile) {
      profile = { username, posts: [], source: "apify" };
      byUser.set(username, profile);
    }
    if (item.biography || item.bio) {
      profile.biography = String(item.biography ?? item.bio ?? "");
    }
    if (item.followersCount != null) profile.followers = Number(item.followersCount);
    if (item.fullName) profile.fullName = String(item.fullName);

    const latest = (item.latestPosts ?? item.posts ?? item.latestIgtvVideos) as
      | Array<Record<string, unknown>>
      | undefined;
    if (Array.isArray(latest)) {
      for (const p of latest.slice(0, 12)) {
        profile.posts.push({
          username,
          caption: String(p.caption ?? p.text ?? "").slice(0, 1500),
          likes: Number(p.likesCount ?? p.likes ?? 0),
          comments: Number(p.commentsCount ?? p.comments ?? 0),
          type: String(p.type ?? p.productType ?? "GraphImage"),
          url: p.url ? String(p.url) : undefined,
          timestamp: p.timestamp ? String(p.timestamp) : undefined,
        });
      }
    } else if (item.caption != null) {
      profile.posts.push({
        username,
        caption: String(item.caption).slice(0, 1500),
        likes: Number(item.likesCount ?? 0),
        comments: Number(item.commentsCount ?? 0),
        type: String(item.type ?? "GraphImage"),
        url: item.url ? String(item.url) : undefined,
      });
    }
  }

  return [...byUser.values()];
}
