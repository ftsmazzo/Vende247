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
