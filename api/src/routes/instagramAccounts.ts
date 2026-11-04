import type { FastifyPluginAsync } from "fastify";
import { getUserId, getWorkspaceForUser, requireAuth } from "../services/authHelpers.js";
import {
  createIgAccount,
  DEFAULT_COMMENT_PROMPT,
  DEFAULT_DIRECT_PROMPT,
  deleteIgAccount,
  listIgAccounts,
  publicIgAccount,
  rotateMcpKey,
  setActiveIgAccount,
  updateIgAccount,
} from "../services/instagramAccounts.js";

function mcpPublicUrl(): string {
  const base = (process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || "").replace(/\/$/, "");
  if (base) return `${base}/mcp`;
  return "https://vendas247-api.kxryyk.easypanel.host/mcp";
}

export const instagramAccountsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (req) => {
    const rows = await listIgAccounts(getUserId(req));
    const ws = await getWorkspaceForUser(getUserId(req));
    return {
      accounts: rows.map(publicIgAccount),
      active_instagram_account_id: ws?.instagram_account_id ?? null,
      defaults: {
        agent_prompt_comentarios: DEFAULT_COMMENT_PROMPT,
        agent_prompt_direct: DEFAULT_DIRECT_PROMPT,
      },
    };
  });

  app.post<{
    Body: {
      label?: string;
      ig_user_id?: string;
      ig_username?: string;
      ig_access_token?: string;
      facebook_page_id?: string;
    };
  }>("/", async (req, reply) => {
    const igUserId = (req.body?.ig_user_id || "").trim();
    if (!igUserId) return reply.status(400).send({ error: "ig_user_id obrigatório." });
    const acc = await createIgAccount(getUserId(req), {
      label: req.body?.label,
      ig_user_id: igUserId,
      ig_username: req.body?.ig_username,
      ig_access_token: req.body?.ig_access_token,
      facebook_page_id: req.body?.facebook_page_id,
    });
    const ws = await getWorkspaceForUser(getUserId(req));
    if (ws && !ws.instagram_account_id) {
      await setActiveIgAccount(getUserId(req), ws.id, acc.id);
    }
    return { account: publicIgAccount(acc) };
  });

  app.patch<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>("/:id", async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.status(400).send({ error: "id inválido." });
    const b = req.body ?? {};
    const acc = await updateIgAccount(getUserId(req), id, {
      label: typeof b.label === "string" ? b.label : undefined,
      ig_user_id: typeof b.ig_user_id === "string" ? b.ig_user_id : undefined,
      ig_username: typeof b.ig_username === "string" ? b.ig_username : undefined,
      ig_access_token: typeof b.ig_access_token === "string" ? b.ig_access_token : undefined,
      facebook_page_id: typeof b.facebook_page_id === "string" ? b.facebook_page_id : undefined,
      agent_ativo: typeof b.agent_ativo === "boolean" ? b.agent_ativo : undefined,
      agent_nome: typeof b.agent_nome === "string" ? b.agent_nome : undefined,
      agent_prompt_comentarios:
        typeof b.agent_prompt_comentarios === "string" ? b.agent_prompt_comentarios : undefined,
      agent_prompt_direct:
        typeof b.agent_prompt_direct === "string" ? b.agent_prompt_direct : undefined,
      agent_access_token:
        typeof b.agent_access_token === "string" ? b.agent_access_token : undefined,
    });
    if (!acc) return reply.status(404).send({ error: "Conta não encontrada." });
    return { account: publicIgAccount(acc) };
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const id = Number(req.params.id);
    const ok = await deleteIgAccount(getUserId(req), id);
    if (!ok) return reply.status(404).send({ error: "Conta não encontrada." });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/:id/activate", async (req, reply) => {
    const id = Number(req.params.id);
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    try {
      const acc = await setActiveIgAccount(getUserId(req), ws.id, id);
      return { account: publicIgAccount(acc), active_instagram_account_id: acc.id };
    } catch (e) {
      return reply.status(404).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post<{ Params: { id: string } }>("/:id/mcp-key", async (req, reply) => {
    const id = Number(req.params.id);
    const acc = await rotateMcpKey(getUserId(req), id);
    if (!acc) return reply.status(404).send({ error: "Conta não encontrada." });
    const url = mcpPublicUrl();
    const key = acc.mcp_api_key || "";
    const label = (acc.ig_username || acc.label || `ig-${acc.id}`).replace(/[^a-zA-Z0-9_-]/g, "-");
    return {
      account: publicIgAccount(acc),
      mcp: {
        url,
        token: key,
        claude_desktop: {
          mcpServers: {
            [`vende247-${label}`]: {
              command: "npx",
              args: [
                "-y",
                "mcp-remote@latest",
                url,
                "--transport",
                "http-only",
                "--header",
                "Authorization:${AUTH_HEADER}",
              ],
              env: { AUTH_HEADER: `Bearer ${key}` },
            },
          },
        },
        cursor: {
          mcpServers: {
            [`vende247-${label}`]: {
              type: "http",
              url,
              headers: { Authorization: `Bearer ${key}` },
            },
          },
        },
      },
    };
  });
};
