import type { FastifyRequest, FastifyReply } from "fastify";
import { query } from "../db/index.js";
import { brandMismatchReason } from "./brandIdentity.js";
import type { BrandKit } from "./brandFromUrl.js";

export type JwtUser = { sub: number; email: string };

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Não autenticado." });
  }
}

export function getUserId(req: FastifyRequest): number {
  const u = req.user as JwtUser;
  return Number(u.sub);
}

export async function getWorkspaceForUser(userId: number) {
  const r = await query<{
    id: number;
    owner_user_id: number;
    name: string;
    nicho: string;
    produto: string;
    oferta: string;
    cta: string;
    tom_voz: string;
    concorrentes: string[];
    ig_user_id: string;
    ig_username: string;
    ig_access_token: string;
    brand_kit: Record<string, unknown>;
    onboarding_done: boolean;
  }>(
    `SELECT id, owner_user_id, name, nicho, produto, oferta, cta, tom_voz,
            COALESCE(concorrentes, '[]'::jsonb) AS concorrentes,
            COALESCE(ig_user_id, '') AS ig_user_id,
            COALESCE(ig_username, '') AS ig_username,
            COALESCE(ig_access_token, '') AS ig_access_token,
            COALESCE(brand_kit, '{}'::jsonb) AS brand_kit,
            COALESCE(onboarding_done, FALSE) AS onboarding_done
     FROM workspaces WHERE owner_user_id = $1 ORDER BY id ASC LIMIT 1`,
    [userId]
  );
  return r.rows[0] ?? null;
}

export function publicWorkspace(ws: Awaited<ReturnType<typeof getWorkspaceForUser>>) {
  if (!ws) return null;
  const brand = (ws.brand_kit || {}) as BrandKit;
  return {
    id: ws.id,
    name: ws.name,
    nicho: ws.nicho,
    produto: ws.produto,
    oferta: ws.oferta,
    cta: ws.cta,
    tom_voz: ws.tom_voz,
    concorrentes: ws.concorrentes,
    ig_user_id: ws.ig_user_id,
    ig_username: ws.ig_username,
    has_ig_token: Boolean(ws.ig_access_token?.trim()),
    brand_kit: ws.brand_kit,
    brand_warning: brandMismatchReason(brand, {
      nicho: ws.nicho,
      produto: ws.produto,
      oferta: ws.oferta,
      tom_voz: ws.tom_voz,
      cta: ws.cta,
    }),
    onboarding_done: ws.onboarding_done,
  };
}
