import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fs from "node:fs";
import path from "node:path";
import { ensureTables, getPool } from "./db/index.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { workspaceRoutes } from "./routes/workspace.js";
import { researchRoutes } from "./routes/research.js";
import { strategyRoutes } from "./routes/strategy.js";
import { creativesRoutes } from "./routes/creatives.js";
import { landingRoutes } from "./routes/landing.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { startCronJob } from "./services/cron.js";
import { getLocalUploadsDir } from "./services/storage.js";

import { extractBrandFromUrl } from "./services/brandFromUrl.js";
import { captureDesignSystem } from "./services/siteCapture.js";
import { getUserId, getWorkspaceForUser, publicWorkspace } from "./services/authHelpers.js";
import { query } from "./db/index.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET?.trim() || "dev-mudar-JWT_SECRET-em-producao";

async function build() {
  const app = Fastify({ logger: true, bodyLimit: 5 * 1024 * 1024 });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: JWT_SECRET, sign: { expiresIn: "14d" } });

  await app.register(healthRoutes, { prefix: "/" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(workspaceRoutes, { prefix: "/api/workspace" });
  await app.register(campaignRoutes, { prefix: "/api/campaigns" });
  await app.register(researchRoutes, { prefix: "/api/research" });
  await app.register(strategyRoutes, { prefix: "/api/strategy" });
  await app.register(creativesRoutes, { prefix: "/api/creatives" });
  await app.register(landingRoutes, { prefix: "/api/landing" });

  // Rota também no root (garantia — alguns deploys não pegavam a do plugin)
  app.post<{ Body: { url?: string; logo_url?: string } }>(
    "/api/workspace/brand-from-url",
    { preHandler: async (req, reply) => {
      try { await req.jwtVerify(); } catch { return reply.status(401).send({ error: "Não autenticado." }); }
    }},
    async (req, reply) => {
      const ws = await getWorkspaceForUser(getUserId(req));
      if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
      const url = req.body?.url?.trim();
      if (!url) return reply.status(400).send({ error: "Informe a URL da landing (pública)." });
      try {
        const kit = await extractBrandFromUrl(url);
        if (req.body?.logo_url?.trim()) kit.logo_url = req.body.logo_url.trim();
        // Caminho com referência: substitui identidade (não mescla ProntEPI residual)
        const merged: Record<string, unknown> = {
          ...kit,
          source: "url",
          logo_url: kit.logo_url || req.body?.logo_url?.trim() || undefined,
        };
        await query(`UPDATE workspaces SET brand_kit = $2::jsonb, updated_at = NOW() WHERE id = $1`, [
          ws.id,
          JSON.stringify(merged),
        ]);
        const fresh = await getWorkspaceForUser(getUserId(req));
        return { workspace: publicWorkspace(fresh), brand_kit: merged };
      } catch (err) {
        return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    }
  );

  app.post<{ Body: { url?: string } }>(
    "/api/tools/capture-site",
    {
      preHandler: async (req, reply) => {
        try {
          await req.jwtVerify();
        } catch {
          return reply.status(401).send({ error: "Não autenticado." });
        }
      },
    },
    async (req, reply) => {
      const ws = await getWorkspaceForUser(getUserId(req));
      if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
      const url = req.body?.url?.trim();
      if (!url) return reply.status(400).send({ error: "Informe a URL pública." });
      try {
        const capture = await captureDesignSystem(url);
        return { capture };
      } catch (err) {
        return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    }
  );

  app.get<{ Params: { file: string } }>("/media/:file", async (req, reply) => {
    const file = path.basename(req.params.file);
    const full = path.join(getLocalUploadsDir(), file);
    if (!fs.existsSync(full)) return reply.status(404).send({ error: "Arquivo não encontrado." });
    return reply.type("image/jpeg").send(fs.createReadStream(full));
  });

  startCronJob(app);
  return app;
}

build()
  .then(async (app) => {
    try {
      await ensureTables();
      if (getPool()) app.log.info("Tabelas Vende247 prontas.");
      else app.log.warn("DATABASE_URL ausente — auth/workspace exigem Postgres.");
    } catch (err) {
      app.log.warn({ err }, "Falha ao criar tabelas; API sobe mesmo assim.");
    }
    return app.listen({ port: PORT, host: HOST });
  })
  .then((address) => {
    console.log(`API Vende247 em ${address}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
