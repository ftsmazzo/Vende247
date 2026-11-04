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
    const imageProvider = (process.env.IMAGE_PROVIDER || "openai").toLowerCase();
    const publicApi =
      (process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || "").replace(/\/$/, "") ||
      "https://vendas247-api.kxryyk.easypanel.host";

    return {
      workspace_id: ws?.id ?? null,
      active_instagram_account_id: ws?.instagram_account_id ?? null,
      instagram_accounts: accounts.map(publicIgAccount),
      webhook: {
        url: `${publicApi}/api/webhooks/instagram`,
        verify_token_configured: Boolean(
          process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ||
            process.env.IG_WEBHOOK_VERIFY_TOKEN?.trim()
        ),
        note: "No App Meta, callback = esta URL; verify token = META_WEBHOOK_VERIFY_TOKEN no EasyPanel.",
      },
      mcp: {
        url: `${publicApi}/mcp`,
        note: "Gere a chave em Conta → Contas Instagram → Conectar Claude.",
      },
      providers: {
        apify: masked(process.env.APIFY_TOKEN),
        openai: masked(process.env.OPENAI_API_KEY),
        gemini: masked(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY),
        anthropic: masked(process.env.ANTHROPIC_API_KEY),
        kairogen: masked(process.env.KAIROGEN_ACCESS_TOKEN),
        llm_provider: process.env.LLM_PROVIDER || "openai",
        image_provider: imageProvider,
        video_provider: process.env.VIDEO_PROVIDER || null,
      },
    };
  });
};
