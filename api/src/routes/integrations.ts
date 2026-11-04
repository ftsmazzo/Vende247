import type { FastifyPluginAsync } from "fastify";
import { getUserId, getWorkspaceForUser, requireAuth } from "../services/authHelpers.js";
import { listIgAccounts, publicIgAccount } from "../services/instagramAccounts.js";

function masked(v: string | undefined): { configured: boolean; hint: string | null } {
  const t = (v || "").trim();
  if (!t) return { configured: false, hint: null };
  if (t.length <= 8) return { configured: true, hint: "••••" };
  return { configured: true, hint: `${t.slice(0, 4)}…${t.slice(-4)}` };
}

export const integrationsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/status", async (req) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    const accounts = await listIgAccounts(getUserId(req));
    const imageProvider = (process.env.IMAGE_PROVIDER || "openrouter").toLowerCase();
    const publicApi =
      (process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || "").replace(/\/$/, "") ||
      "https://vendas247-api.kxryyk.easypanel.host";

    return {
      workspace_id: ws?.id ?? null,
      active_instagram_account_id: ws?.instagram_account_id ?? null,
      instagram_accounts: accounts.map(publicIgAccount),
      webhook: {
        url: `${publicApi}/api/webhooks/instagram`,
        // Sempre há um token efetivo (env ou default vende247-verify).
        verify_token_configured: true,
        verify_token_from_env: Boolean(
          process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ||
            process.env.IG_WEBHOOK_VERIFY_TOKEN?.trim()
        ),
        verify_token_hint: "vende247-verify (default se a env não existir)",
        note:
          "Callback = esta URL. Verify token na Meta = META_WEBHOOK_VERIFY_TOKEN no EasyPanel, ou o default vende247-verify. Depois inscreva comments + messages no tópico Instagram.",
      },
      mcp: {
        url: `${publicApi}/mcp`,
        note: "Gere a chave em Conta → Contas Instagram → Conectar Claude.",
      },
      providers: {
        openrouter: masked(process.env.OPENROUTER_API_KEY),
        apify: masked(process.env.APIFY_TOKEN),
        kairogen: masked(process.env.KAIROGEN_ACCESS_TOKEN),
        llm_provider: "openrouter",
        llm_model: process.env.LLM_MODEL?.trim() || "openai/gpt-4o-mini",
        llm_model_agent:
          process.env.LLM_MODEL_AGENT?.trim() ||
          process.env.LLM_MODEL?.trim() ||
          "openai/gpt-4o-mini",
        image_provider: imageProvider,
        video_provider: process.env.VIDEO_PROVIDER || null,
      },
    };
  });
};
