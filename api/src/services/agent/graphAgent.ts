/** Graph helpers do agente (comentário / DM) — Instagram Login ou Page token. */

function graphBase(token: string): string {
  const ver = (process.env.META_GRAPH_VERSION || "v25.0").replace(/^v?/, "v");
  if (/^(IGAA|IGQV)/i.test(token)) return `https://graph.instagram.com/${ver}`;
  return `https://graph.facebook.com/${ver}`;
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Graph não-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function fetchMediaContext(opts: {
  mediaId: string;
  accessToken: string;
}): Promise<{ caption: string; mediaType: string }> {
  if (!opts.mediaId) return { caption: "", mediaType: "" };
  const url = `${graphBase(opts.accessToken)}/${opts.mediaId}?fields=caption,media_type,media_product_type&access_token=${encodeURIComponent(opts.accessToken)}`;
  try {
    const res = await fetch(url);
    const json = await parseJson(res);
    if (json.error) return { caption: "", mediaType: "" };
    return {
      caption: String(json.caption || "").trim(),
      mediaType: String(json.media_product_type || json.media_type || "").trim(),
    };
  } catch {
    return { caption: "", mediaType: "" };
  }
}

export async function fetchLeadProfile(opts: {
  igScopedUserId: string;
  accessToken: string;
}): Promise<{ username: string; name: string }> {
  if (!opts.igScopedUserId) return { username: "", name: "" };
  const url = `${graphBase(opts.accessToken)}/${opts.igScopedUserId}?fields=username,name&access_token=${encodeURIComponent(opts.accessToken)}`;
  try {
    const res = await fetch(url);
    const json = await parseJson(res);
    if (json.error) return { username: "", name: "" };
    return {
      username: String(json.username || "").trim(),
      name: String(json.name || "").trim(),
    };
  } catch {
    return { username: "", name: "" };
  }
}

/** Private reply a partir do comentário — dispara push/notificação no Instagram. */
export async function sendPrivateReplyFromComment(opts: {
  igUserId: string;
  commentId: string;
  text: string;
  accessToken: string;
  facebookPageId?: string;
}): Promise<Record<string, unknown>> {
  const path =
    opts.facebookPageId && !/^(IGAA|IGQV)/i.test(opts.accessToken)
      ? `/${opts.facebookPageId}/messages`
      : `/${opts.igUserId}/messages`;
  const res = await fetch(`${graphBase(opts.accessToken)}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify({
      recipient: { comment_id: opts.commentId },
      message: { text: opts.text },
    }),
  });
  const json = await parseJson(res);
  if (json.error) {
    const err = json.error as { message?: string };
    throw new Error(err.message || "Falha no Direct privado (push)");
  }
  return json;
}

export async function replyToComment(opts: {
  commentId: string;
  message: string;
  accessToken: string;
}): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    message: opts.message,
    access_token: opts.accessToken,
  });
  const res = await fetch(`${graphBase(opts.accessToken)}/${opts.commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await parseJson(res);
  if (json.error) {
    const err = json.error as { message?: string };
    throw new Error(err.message || "Falha ao responder comentário");
  }
  return json;
}

export async function sendIgDm(opts: {
  igUserId: string;
  recipientId: string;
  text: string;
  accessToken: string;
  facebookPageId?: string;
}): Promise<Record<string, unknown>> {
  const path =
    opts.facebookPageId && !/^(IGAA|IGQV)/i.test(opts.accessToken)
      ? `/${opts.facebookPageId}/messages`
      : `/${opts.igUserId}/messages`;
  const res = await fetch(`${graphBase(opts.accessToken)}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: opts.recipientId },
      message: { text: opts.text },
    }),
  });
  const json = await parseJson(res);
  if (json.error) {
    const err = json.error as { message?: string };
    throw new Error(err.message || "Falha ao enviar DM");
  }
  return json;
}
