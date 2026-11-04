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
