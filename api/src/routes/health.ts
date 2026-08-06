import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    ok: true,
    product: "Vende247",
    version: "brand-v2",
    ts: new Date().toISOString(),
  }));
};
