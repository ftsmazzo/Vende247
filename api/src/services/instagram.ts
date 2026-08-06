const GRAPH = "https://graph.facebook.com/v21.0";

export async function publishImage(opts: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<string> {
  const { igUserId, accessToken, imageUrl, caption } = opts;
  const create = await fetch(
    `${GRAPH}/${igUserId}/media?` +
      new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    { method: "POST" }
  );
  const createJson = (await create.json()) as { id?: string; error?: { message?: string } };
  if (!create.ok || !createJson.id) {
    throw new Error(createJson.error?.message || `Criar container IG falhou HTTP ${create.status}`);
  }

  const publish = await fetch(
    `${GRAPH}/${igUserId}/media_publish?` +
      new URLSearchParams({
        creation_id: createJson.id,
        access_token: accessToken,
      }),
    { method: "POST" }
  );
  const pubJson = (await publish.json()) as { id?: string; error?: { message?: string } };
  if (!publish.ok || !pubJson.id) {
    throw new Error(pubJson.error?.message || `Publicar IG falhou HTTP ${publish.status}`);
  }
  return pubJson.id;
}

/** Carrossel IG: N itens → container CAROUSEL → publish */
export async function publishCarousel(opts: {
  igUserId: string;
  accessToken: string;
  imageUrls: string[];
  caption: string;
}): Promise<string> {
  const { igUserId, accessToken, caption } = opts;
  const urls = opts.imageUrls.filter(Boolean).slice(0, 10);
  if (urls.length < 2) {
    return publishImage({
      igUserId,
      accessToken,
      imageUrl: urls[0] || "",
      caption,
    });
  }

  const childIds: string[] = [];
  for (const imageUrl of urls) {
    const create = await fetch(
      `${GRAPH}/${igUserId}/media?` +
        new URLSearchParams({
          image_url: imageUrl,
          is_carousel_item: "true",
          access_token: accessToken,
        }),
      { method: "POST" }
    );
    const createJson = (await create.json()) as { id?: string; error?: { message?: string } };
    if (!create.ok || !createJson.id) {
      throw new Error(
        createJson.error?.message || `Item carrossel falhou HTTP ${create.status}`
      );
    }
    childIds.push(createJson.id);
  }

  const parent = await fetch(
    `${GRAPH}/${igUserId}/media?` +
      new URLSearchParams({
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption,
        access_token: accessToken,
      }),
    { method: "POST" }
  );
  const parentJson = (await parent.json()) as { id?: string; error?: { message?: string } };
  if (!parent.ok || !parentJson.id) {
    throw new Error(
      parentJson.error?.message || `Container carrossel falhou HTTP ${parent.status}`
    );
  }

  const publish = await fetch(
    `${GRAPH}/${igUserId}/media_publish?` +
      new URLSearchParams({
        creation_id: parentJson.id,
        access_token: accessToken,
      }),
    { method: "POST" }
  );
  const pubJson = (await publish.json()) as { id?: string; error?: { message?: string } };
  if (!publish.ok || !pubJson.id) {
    throw new Error(pubJson.error?.message || `Publicar carrossel falhou HTTP ${publish.status}`);
  }
  return pubJson.id;
}
