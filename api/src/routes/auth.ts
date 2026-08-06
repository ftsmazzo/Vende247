import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { getPool, query } from "../db/index.js";
import { getWorkspaceForUser, publicWorkspace, requireAuth, getUserId } from "../services/authHelpers.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => {
    if (!getPool()) return { db: false, canRegister: false };
    const count = await query<{ n: string }>("SELECT COUNT(*)::text AS n FROM users");
    const n = Number(count.rows[0]?.n ?? 0);
    const open = process.env.ALLOW_OPEN_REGISTER === "true" || n === 0;
    return { db: true, canRegister: open, users: n };
  });

  app.post<{ Body: { email?: string; password?: string; name?: string } }>(
    "/register",
    async (req, reply) => {
      if (!getPool()) return reply.status(503).send({ error: "DATABASE_URL necessária." });
      const email = req.body?.email?.trim().toLowerCase();
      const password = req.body?.password ?? "";
      const name = req.body?.name?.trim() || null;
      if (!email || password.length < 6) {
        return reply.status(400).send({ error: "Email e senha (mín. 6) obrigatórios." });
      }

      const count = await query<{ n: string }>("SELECT COUNT(*)::text AS n FROM users");
      const n = Number(count.rows[0]?.n ?? 0);
      if (n > 0 && process.env.ALLOW_OPEN_REGISTER !== "true") {
        return reply.status(403).send({ error: "Cadastro fechado. Peça ao admin." });
      }

      const hash = await bcrypt.hash(password, 10);
      try {
        const u = await query<{ id: number; email: string }>(
          `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
           RETURNING id, email`,
          [email, hash, name]
        );
        const user = u.rows[0];
        await query(
          `INSERT INTO workspaces (owner_user_id, name) VALUES ($1, $2)`,
          [user.id, "Meu Estúdio"]
        );
        const token = await reply.jwtSign({ sub: user.id, email: user.email });
        return { token, user: { id: user.id, email: user.email, name } };
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "23505") return reply.status(409).send({ error: "Email já cadastrado." });
        throw err;
      }
    }
  );

  app.post<{ Body: { email?: string; password?: string } }>("/login", async (req, reply) => {
    if (!getPool()) return reply.status(503).send({ error: "DATABASE_URL necessária." });
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password ?? "";
    if (!email || !password) return reply.status(400).send({ error: "Email e senha obrigatórios." });

    const r = await query<{ id: number; email: string; password_hash: string; name: string | null }>(
      `SELECT id, email, password_hash, name FROM users WHERE email = $1`,
      [email]
    );
    const user = r.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.status(401).send({ error: "Credenciais inválidas." });
    }
    const token = await reply.jwtSign({ sub: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  });

  app.get("/me", { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    const u = await query<{ id: number; email: string; name: string | null }>(
      `SELECT id, email, name FROM users WHERE id = $1`,
      [userId]
    );
    const ws = await getWorkspaceForUser(userId);
    return { user: u.rows[0] ?? null, workspace: publicWorkspace(ws) };
  });
};
