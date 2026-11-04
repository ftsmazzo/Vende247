/**
 * MCP JSON-RPC mínimo (tools + prompts) autenticado por mcp_api_key da conta IG.
 * Compatível com mcp-remote / bridge stdio.
 */
import { query } from "../db/index.js";
import { TILLI_PROMPTS } from "../data/tilliPrompts.js";
import {
  agentToken,
  getIgAccountByMcpKey,
  type InstagramAccount,
} from "../services/instagramAccounts.js";
import { publishCarousel, publishImage } from "../services/instagram.js";

type JsonRpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function ok(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function err(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

const TOOLS = [
  {
    name: "v247_get_account",
    description: "Perfil da conta Instagram autenticada neste MCP + flags do agente.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "v247_list_campaigns",
    description: "Lista campanhas do workspace do dono desta conta IG.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "v247_get_strategy",
    description: "Última estratégia gerada (opcional campaign_id).",
    inputSchema: {
      type: "object",
      properties: { campaign_id: { type: "number" } },
    },
  },
  {
    name: "v247_list_creatives",
    description: "Lista criativos recentes.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "number" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "v247_publish_creative",
    description: "Publica um criativo ready/draft com mídia no Instagram da conta.",
    inputSchema: {
      type: "object",
      properties: { creative_id: { type: "number" } },
      required: ["creative_id"],
    },
  },
  {
    name: "ig_get_profile",
    description: "Perfil Graph da conta (username, bio, seguidores).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ig_list_media",
    description: "Posts recentes da conta.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
  },
] as const;

function graphBase(token: string) {
  const ver = (process.env.META_GRAPH_VERSION || "v25.0").replace(/^v?/, "v");
  return /^(IGAA|IGQV)/i.test(token)
    ? `https://graph.instagram.com/${ver}`
    : `https://graph.facebook.com/${ver}`;
}

async function graphGet(token: string, path: string, params: Record<string, string> = {}) {
  const u = new URL(`${graphBase(token)}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("access_token", token);
  const res = await fetch(u);
  const json = (await res.json()) as Record<string, unknown>;
  if (json.error) {
    throw new Error((json.error as { message?: string }).message || "Graph error");
  }
  return json;
}

async function workspaceIdsForAccount(acc: InstagramAccount): Promise<number[]> {
  const r = await query<{ id: number }>(
    `SELECT id FROM workspaces WHERE owner_user_id = $1 ORDER BY id ASC`,
    [acc.owner_user_id]
  );
  return r.rows.map((x) => x.id);
}

async function callTool(acc: InstagramAccount, name: string, args: Record<string, unknown>) {
  const token = agentToken(acc) || acc.ig_access_token;
  const wsIds = await workspaceIdsForAccount(acc);

  if (name === "v247_get_account") {
    return {
      id: acc.id,
      label: acc.label,
      ig_user_id: acc.ig_user_id,
      ig_username: acc.ig_username,
      agent_ativo: acc.agent_ativo,
      agent_nome: acc.agent_nome,
      has_token: Boolean(token),
    };
  }

  if (name === "v247_list_campaigns") {
    if (!wsIds.length) return { campaigns: [] };
    const r = await query(
      `SELECT id, name, type, status, nicho, produto, ig_username, created_at
       FROM campaigns WHERE workspace_id = ANY($1::int[]) ORDER BY id DESC LIMIT 50`,
      [wsIds]
    );
    return { campaigns: r.rows };
  }

  if (name === "v247_get_strategy") {
    const campaignId = Number(args.campaign_id || 0);
    const r = campaignId
      ? await query(
          `SELECT id, campaign_id, days, plan, created_at FROM strategies
           WHERE campaign_id = $1 ORDER BY id DESC LIMIT 1`,
          [campaignId]
        )
      : await query(
          `SELECT id, campaign_id, days, plan, created_at FROM strategies
           WHERE workspace_id = ANY($1::int[]) ORDER BY id DESC LIMIT 1`,
          [wsIds]
        );
    return { strategy: r.rows[0] ?? null };
  }

  if (name === "v247_list_creatives") {
    const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
    const campaignId = Number(args.campaign_id || 0);
    const r = campaignId
      ? await query(
          `SELECT id, campaign_id, day_index, format, hook, status, media_url, published_at
           FROM creatives WHERE campaign_id = $1 ORDER BY id DESC LIMIT $2`,
          [campaignId, limit]
        )
      : await query(
          `SELECT id, campaign_id, day_index, format, hook, status, media_url, published_at
           FROM creatives WHERE workspace_id = ANY($1::int[]) ORDER BY id DESC LIMIT $2`,
          [wsIds, limit]
        );
    return { creatives: r.rows };
  }

  if (name === "v247_publish_creative") {
    const creativeId = Number(args.creative_id);
    if (!creativeId) throw new Error("creative_id obrigatório");
    if (!acc.ig_user_id || !token) throw new Error("Conta sem ig_user_id/token");
    const cur = await query<{
      id: number;
      media_url: string;
      media_urls: unknown;
      caption: string;
      format: string;
      workspace_id: number;
    }>(
      `SELECT id, media_url, caption, format, workspace_id, COALESCE(media_urls,'[]'::jsonb) AS media_urls
       FROM creatives WHERE id = $1 AND workspace_id = ANY($2::int[])`,
      [creativeId, wsIds]
    );
    const row = cur.rows[0];
    if (!row?.media_url) throw new Error("Criativo sem mídia ou fora do escopo");
    const urls = Array.isArray(row.media_urls) ? (row.media_urls as string[]).filter(Boolean) : [];
    const mediaId =
      row.format === "carrossel" && urls.length > 1
        ? await publishCarousel({
            igUserId: acc.ig_user_id,
            accessToken: token,
            imageUrls: urls,
            caption: row.caption,
          })
        : await publishImage({
            igUserId: acc.ig_user_id,
            accessToken: token,
            imageUrl: row.media_url,
            caption: row.caption,
          });
    await query(
      `UPDATE creatives SET status='published', published_at=NOW(), ig_media_id=$2, updated_at=NOW() WHERE id=$1`,
      [creativeId, mediaId]
    );
    return { ok: true, ig_media_id: mediaId };
  }

  if (name === "ig_get_profile") {
    if (!acc.ig_user_id || !token) throw new Error("Conta sem credenciais");
    return graphGet(token, `/${acc.ig_user_id}`, {
      fields: "id,username,name,biography,followers_count,media_count,website",
    });
  }

  if (name === "ig_list_media") {
    if (!acc.ig_user_id || !token) throw new Error("Conta sem credenciais");
    const limit = String(Math.min(Math.max(Number(args.limit) || 12, 1), 50));
    return graphGet(token, `/${acc.ig_user_id}/media`, {
      fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count",
      limit,
    });
  }

  throw new Error(`Tool desconhecida: ${name}`);
}

export async function handleMcpRpc(
  authHeader: string | undefined,
  body: JsonRpc
): Promise<Record<string, unknown>> {
  const raw = (authHeader || "").trim();
  const key = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw;
  if (!key) return err(body.id, -32001, "Unauthorized");

  const acc = await getIgAccountByMcpKey(key);
  if (!acc) return err(body.id, -32001, "Unauthorized");

  const method = body.method || "";
  const id = body.id;

  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {}, prompts: {} },
      serverInfo: { name: "vende247-instagram", version: "1.0.0" },
    });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return ok(id, {});
  }
  if (method === "ping") return ok(id, {});
  if (method === "tools/list") return ok(id, { tools: TOOLS });
  if (method === "prompts/list") {
    return ok(id, {
      prompts: TILLI_PROMPTS.map((p) => ({
        name: p.name,
        title: p.title,
        description: p.description,
      })),
    });
  }
  if (method === "prompts/get") {
    const name = String((body.params as { name?: string })?.name || "");
    const p = TILLI_PROMPTS.find((x) => x.name === name);
    if (!p) return err(id, -32602, "Prompt não encontrado");
    return ok(id, {
      description: p.description,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `# ${p.title}\n${p.description}\nUse tools v247_* / ig_* desta conta (@${acc.ig_username || acc.id}).`,
          },
        },
      ],
    });
  }
  if (method === "tools/call") {
    const params = body.params || {};
    const name = String(params.name || "");
    const args = (params.arguments || {}) as Record<string, unknown>;
    try {
      const result = await callTool(acc, name, args);
      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      });
    } catch (e) {
      return ok(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
          },
        ],
        isError: true,
      });
    }
  }

  return err(id, -32601, `Method not found: ${method}`);
}
