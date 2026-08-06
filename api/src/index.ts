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
import { startCronJob } from "./services/cron.js";
import { getLocalUploadsDir } from "./services/storage.js";

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
  await app.register(researchRoutes, { prefix: "/api/research" });
  await app.register(strategyRoutes, { prefix: "/api/strategy" });
  await app.register(creativesRoutes, { prefix: "/api/creatives" });

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
