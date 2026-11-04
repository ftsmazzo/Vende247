import { query } from "../../db/index.js";
import type { BrandCtx } from "./agentPrompts.js";

export async function loadBrandForOwner(ownerUserId: number): Promise<BrandCtx> {
  const r = await query<{
    name: string;
    produto: string | null;
    nicho: string | null;
    oferta: string | null;
    tom_voz: string | null;
  }>(
    `SELECT name, produto, nicho, oferta, tom_voz
     FROM workspaces WHERE owner_user_id = $1 ORDER BY id ASC LIMIT 1`,
    [ownerUserId]
  );
  const w = r.rows[0];
  return {
    marca: (w?.name || "").trim() || "nossa empresa",
    produto: (w?.produto || "").trim(),
    nicho: (w?.nicho || "").trim(),
    oferta: (w?.oferta || "").trim(),
    tom_voz: (w?.tom_voz || "").trim(),
  };
}

export type StoredCommentCtx = {
  comment_id: string;
  media_id: string;
  comment_text: string;
  username_lead: string;
  caption_post: string;
  media_type: string;
};

export async function saveCommentInteraction(opts: {
  accountId: number;
  igLeadId: string;
  usernameLead?: string;
  commentId: string;
  mediaId?: string;
  commentText: string;
  captionPost?: string;
  mediaType?: string;
}): Promise<void> {
  await query(
    `INSERT INTO agent_interactions (
       instagram_account_id, ig_lead_id, username_lead, comment_id, media_id,
       comment_text, caption_post, media_type, channel
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'comment')`,
    [
      opts.accountId,
      opts.igLeadId || "",
      opts.usernameLead || "",
      opts.commentId,
      opts.mediaId || "",
      opts.commentText,
      opts.captionPost || "",
      opts.mediaType || "",
    ]
  );
}

export async function latestCommentCtxForLead(
  accountId: number,
  igLeadId: string
): Promise<StoredCommentCtx | null> {
  if (!igLeadId) return null;
  const r = await query<StoredCommentCtx>(
    `SELECT comment_id, media_id, comment_text, username_lead, caption_post, media_type
     FROM agent_interactions
     WHERE instagram_account_id = $1 AND ig_lead_id = $2 AND channel = 'comment'
     ORDER BY created_at DESC
     LIMIT 1`,
    [accountId, igLeadId]
  );
  return r.rows[0] ?? null;
}

export type DmTurn = { role: "user" | "assistant"; content: string };

export async function saveDmTurn(opts: {
  accountId: number;
  igLeadId: string;
  usernameLead?: string;
  text: string;
  direction: "in" | "out";
}): Promise<void> {
  await query(
    `INSERT INTO agent_interactions (
       instagram_account_id, ig_lead_id, username_lead, comment_text, channel
     ) VALUES ($1,$2,$3,$4,$5)`,
    [
      opts.accountId,
      opts.igLeadId,
      opts.usernameLead || "",
      opts.text,
      opts.direction === "in" ? "dm_in" : "dm_out",
    ]
  );
}

/** Últimos turnos de Direct (ordem cronológica). */
export async function loadDmHistory(
  accountId: number,
  igLeadId: string,
  limit = 10
): Promise<DmTurn[]> {
  if (!igLeadId) return [];
  const r = await query<{ channel: string; comment_text: string }>(
    `SELECT channel, comment_text FROM agent_interactions
     WHERE instagram_account_id = $1 AND ig_lead_id = $2
       AND channel IN ('dm_in','dm_out')
     ORDER BY created_at DESC
     LIMIT $3`,
    [accountId, igLeadId, limit]
  );
  return r.rows
    .reverse()
    .map((row) => ({
      role: (row.channel === "dm_out" ? "assistant" : "user") as "user" | "assistant",
      content: (row.comment_text || "").trim(),
    }))
    .filter((t) => t.content.length > 0);
}

/** Remove cumprimento repetido no começo se já houve conversa. */
export function scrubRepeatedGreeting(reply: string, historyLen: number, firstName?: string): string {
  let t = reply.trim();
  if (historyLen <= 0) return t.slice(0, 220);
  const name = (firstName || "").trim();
  const patterns = [
    /^(oi|olá|ola|hey|eaí|eai|bom dia|boa tarde|boa noite)[,!.\s]+/i,
    name ? new RegExp(`^(oi|olá|ola)\\s+${escapeRe(name)}[,!.\\s]+`, "i") : null,
    name ? new RegExp(`^${escapeRe(name)}[,!.\\s]+`, "i") : null,
  ].filter(Boolean) as RegExp[];
  for (const re of patterns) {
    t = t.replace(re, "");
  }
  t = t.replace(/^[—–-]\s*/, "").trim();
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.slice(0, 220);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function firstNameFrom(name: string, username: string): string {
  const n = (name || "").trim().split(/\s+/)[0] || "";
  if (n && n.length >= 2 && !/^desconhec/i.test(n)) return n;
  return "";
}
