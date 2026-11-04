import type { FastifyPluginAsync } from "fastify";
import { getUserId, getWorkspaceForUser, requireAuth } from "../services/authHelpers.js";
import {
  deleteKnowledge,
  deleteProduct,
  getCompanyProfile,
  listKnowledge,
  listProducts,
  loadCompanyBriefing,
  updateCompanyProfile,
  upsertKnowledge,
  upsertProduct,
} from "../services/companyKnowledge.js";

export const knowledgeRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const [profile, products, knowledge, briefing] = await Promise.all([
      getCompanyProfile(ws.id),
      listProducts(ws.id, false),
      listKnowledge(ws.id, false),
      loadCompanyBriefing(ws.id),
    ]);
    return {
      profile,
      products,
      knowledge,
      agent_brief_preview: briefing?.agent_brief || "",
      tip: "Sem posts no Instagram o agente usa esta base. Preencha missão + carta de produtos.",
    };
  });

  app.put<{
    Body: Record<string, string | undefined>;
  }>("/profile", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const b = req.body || {};
    const profile = await updateCompanyProfile(ws.id, {
      name: typeof b.name === "string" ? b.name : undefined,
      nicho: typeof b.nicho === "string" ? b.nicho : undefined,
      produto: typeof b.produto === "string" ? b.produto : undefined,
      oferta: typeof b.oferta === "string" ? b.oferta : undefined,
      cta: typeof b.cta === "string" ? b.cta : undefined,
      tom_voz: typeof b.tom_voz === "string" ? b.tom_voz : undefined,
      missao: typeof b.missao === "string" ? b.missao : undefined,
      publico_alvo: typeof b.publico_alvo === "string" ? b.publico_alvo : undefined,
      diferenciais: typeof b.diferenciais === "string" ? b.diferenciais : undefined,
      objecoes: typeof b.objecoes === "string" ? b.objecoes : undefined,
      prova_social: typeof b.prova_social === "string" ? b.prova_social : undefined,
      politicas: typeof b.politicas === "string" ? b.politicas : undefined,
    });
    return { profile };
  });

  app.post<{ Body: Record<string, unknown> }>("/products", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    try {
      const product = await upsertProduct(ws.id, req.body || {});
      return { product };
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/products/:id",
    async (req, reply) => {
      const ws = await getWorkspaceForUser(getUserId(req));
      if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
      try {
        const product = await upsertProduct(ws.id, {
          ...(req.body || {}),
          id: Number(req.params.id),
        });
        return { product };
      } catch (e) {
        return reply.status(400).send({ error: e instanceof Error ? e.message : String(e) });
      }
    }
  );

  app.delete<{ Params: { id: string } }>("/products/:id", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const ok = await deleteProduct(ws.id, Number(req.params.id));
    if (!ok) return reply.status(404).send({ error: "Produto não encontrado." });
    return { ok: true };
  });

  app.post<{ Body: Record<string, unknown> }>("/items", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    try {
      const item = await upsertKnowledge(ws.id, req.body || {});
      return { item };
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/items/:id",
    async (req, reply) => {
      const ws = await getWorkspaceForUser(getUserId(req));
      if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
      try {
        const item = await upsertKnowledge(ws.id, {
          ...(req.body || {}),
          id: Number(req.params.id),
        });
        return { item };
      } catch (e) {
        return reply.status(400).send({ error: e instanceof Error ? e.message : String(e) });
      }
    }
  );

  app.delete<{ Params: { id: string } }>("/items/:id", async (req, reply) => {
    const ws = await getWorkspaceForUser(getUserId(req));
    if (!ws) return reply.status(404).send({ error: "Workspace não encontrado." });
    const ok = await deleteKnowledge(ws.id, Number(req.params.id));
    if (!ok) return reply.status(404).send({ error: "Item não encontrado." });
    return { ok: true };
  });
};
