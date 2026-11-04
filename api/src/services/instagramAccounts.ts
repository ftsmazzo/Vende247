import { randomBytes } from "node:crypto";
import { query } from "../db/index.js";

export type InstagramAccount = {
  id: number;
  owner_user_id: number;
  label: string;
  ig_user_id: string;
  ig_username: string;
  ig_access_token: string;
  facebook_page_id: string;
  agent_ativo: boolean;
  agent_nome: string;
  agent_prompt_comentarios: string;
  agent_prompt_direct: string;
  agent_access_token: string;
  mcp_api_key: string | null;
  last_agent_event_at: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_COLS = `
  id, owner_user_id, label, ig_user_id, ig_username, ig_access_token, facebook_page_id,
  agent_ativo, agent_nome, agent_prompt_comentarios, agent_prompt_direct, agent_access_token,
  mcp_api_key, last_agent_event_at, created_at, updated_at
`;

export function publicIgAccount(a: InstagramAccount) {
  return {
    id: a.id,
    label: a.label,
    ig_user_id: a.ig_user_id,
    ig_username: a.ig_username,
    facebook_page_id: a.facebook_page_id,
    has_ig_token: Boolean(a.ig_access_token?.trim()),
    has_agent_token: Boolean(a.agent_access_token?.trim()),
    agent_ativo: a.agent_ativo,
    agent_nome: a.agent_nome,
    agent_prompt_comentarios: a.agent_prompt_comentarios,
    agent_prompt_direct: a.agent_prompt_direct,
    has_mcp_key: Boolean(a.mcp_api_key?.trim()),
    mcp_api_key: a.mcp_api_key,
    last_agent_event_at: a.last_agent_event_at,
    created_at: a.created_at,
    updated_at: a.updated_at,
  };
}

export async function listIgAccounts(userId: number): Promise<InstagramAccount[]> {
  const r = await query<InstagramAccount>(
    `SELECT ${SELECT_COLS} FROM instagram_accounts WHERE owner_user_id = $1 ORDER BY id ASC`,
    [userId]
  );
  return r.rows;
}

export async function getIgAccountForUser(userId: number, id: number): Promise<InstagramAccount | null> {
  const r = await query<InstagramAccount>(
    `SELECT ${SELECT_COLS} FROM instagram_accounts WHERE id = $1 AND owner_user_id = $2`,
    [id, userId]
  );
  return r.rows[0] ?? null;
}

export async function getIgAccountById(id: number): Promise<InstagramAccount | null> {
  const r = await query<InstagramAccount>(
    `SELECT ${SELECT_COLS} FROM instagram_accounts WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function getIgAccountByMcpKey(key: string): Promise<InstagramAccount | null> {
  const r = await query<InstagramAccount>(
    `SELECT ${SELECT_COLS} FROM instagram_accounts WHERE mcp_api_key = $1`,
    [key]
  );
  return r.rows[0] ?? null;
}

export async function getIgAccountByIgUserId(igUserId: string): Promise<InstagramAccount | null> {
  const r = await query<InstagramAccount>(
    `SELECT ${SELECT_COLS} FROM instagram_accounts WHERE ig_user_id = $1 ORDER BY id ASC LIMIT 1`,
    [igUserId]
  );
  return r.rows[0] ?? null;
}

export function newMcpKey(): string {
  return `v247_${randomBytes(24).toString("hex")}`;
}

export async function createIgAccount(
  userId: number,
  input: {
    label?: string;
    ig_user_id: string;
    ig_username?: string;
    ig_access_token?: string;
    facebook_page_id?: string;
  }
): Promise<InstagramAccount> {
  const label =
    input.label?.trim() ||
    input.ig_username?.replace(/^@/, "").trim() ||
    input.ig_user_id.trim() ||
    "Conta Instagram";
  const r = await query<InstagramAccount>(
    `INSERT INTO instagram_accounts (
       owner_user_id, label, ig_user_id, ig_username, ig_access_token, facebook_page_id, mcp_api_key
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING ${SELECT_COLS}`,
    [
      userId,
      label,
      input.ig_user_id.trim(),
      (input.ig_username ?? "").replace(/^@/, "").trim(),
      (input.ig_access_token ?? "").trim(),
      (input.facebook_page_id ?? "").trim(),
      newMcpKey(),
    ]
  );
  return r.rows[0];
}

export async function updateIgAccount(
  userId: number,
  id: number,
  patch: Partial<{
    label: string;
    ig_user_id: string;
    ig_username: string;
    ig_access_token: string;
    facebook_page_id: string;
    agent_ativo: boolean;
    agent_nome: string;
    agent_prompt_comentarios: string;
    agent_prompt_direct: string;
    agent_access_token: string;
  }>
): Promise<InstagramAccount | null> {
  const cur = await getIgAccountForUser(userId, id);
  if (!cur) return null;

  const next = {
    label: patch.label !== undefined ? patch.label.trim() : cur.label,
    ig_user_id: patch.ig_user_id !== undefined ? patch.ig_user_id.trim() : cur.ig_user_id,
    ig_username:
      patch.ig_username !== undefined
        ? patch.ig_username.replace(/^@/, "").trim()
        : cur.ig_username,
    ig_access_token:
      patch.ig_access_token !== undefined && patch.ig_access_token.trim()
        ? patch.ig_access_token.trim()
        : cur.ig_access_token,
    facebook_page_id:
      patch.facebook_page_id !== undefined ? patch.facebook_page_id.trim() : cur.facebook_page_id,
    agent_ativo: patch.agent_ativo !== undefined ? patch.agent_ativo : cur.agent_ativo,
    agent_nome: patch.agent_nome !== undefined ? patch.agent_nome.trim() : cur.agent_nome,
    agent_prompt_comentarios:
      patch.agent_prompt_comentarios !== undefined
        ? patch.agent_prompt_comentarios
        : cur.agent_prompt_comentarios,
    agent_prompt_direct:
      patch.agent_prompt_direct !== undefined ? patch.agent_prompt_direct : cur.agent_prompt_direct,
    agent_access_token:
      patch.agent_access_token !== undefined && patch.agent_access_token.trim()
        ? patch.agent_access_token.trim()
        : cur.agent_access_token,
  };

  const r = await query<InstagramAccount>(
    `UPDATE instagram_accounts SET
       label=$2, ig_user_id=$3, ig_username=$4, ig_access_token=$5, facebook_page_id=$6,
       agent_ativo=$7, agent_nome=$8, agent_prompt_comentarios=$9, agent_prompt_direct=$10,
       agent_access_token=$11, updated_at=NOW()
     WHERE id=$1 AND owner_user_id=$12
     RETURNING ${SELECT_COLS}`,
    [
      id,
      next.label,
      next.ig_user_id,
      next.ig_username,
      next.ig_access_token,
      next.facebook_page_id,
      next.agent_ativo,
      next.agent_nome,
      next.agent_prompt_comentarios,
      next.agent_prompt_direct,
      next.agent_access_token,
      userId,
    ]
  );

  // Espelha no workspace ativo se for a conta ligada
  await query(
    `UPDATE workspaces SET
       ig_user_id = $2, ig_username = $3, ig_access_token = $4, updated_at = NOW()
     WHERE owner_user_id = $1 AND instagram_account_id = $5`,
    [userId, next.ig_user_id, next.ig_username, next.ig_access_token, id]
  );

  return r.rows[0] ?? null;
}

export async function deleteIgAccount(userId: number, id: number): Promise<boolean> {
  const r = await query(`DELETE FROM instagram_accounts WHERE id = $1 AND owner_user_id = $2`, [
    id,
    userId,
  ]);
  return (r.rowCount ?? 0) > 0;
}

export async function rotateMcpKey(userId: number, id: number): Promise<InstagramAccount | null> {
  const key = newMcpKey();
  const r = await query<InstagramAccount>(
    `UPDATE instagram_accounts SET mcp_api_key = $3, updated_at = NOW()
     WHERE id = $1 AND owner_user_id = $2
     RETURNING ${SELECT_COLS}`,
    [id, userId, key]
  );
  return r.rows[0] ?? null;
}

export async function setActiveIgAccount(userId: number, workspaceId: number, accountId: number) {
  const acc = await getIgAccountForUser(userId, accountId);
  if (!acc) throw new Error("Conta Instagram não encontrada.");
  await query(
    `UPDATE workspaces SET
       instagram_account_id = $2,
       ig_user_id = $3,
       ig_username = $4,
       ig_access_token = $5,
       updated_at = NOW()
     WHERE id = $1 AND owner_user_id = $6`,
    [workspaceId, accountId, acc.ig_user_id, acc.ig_username, acc.ig_access_token, userId]
  );
  return acc;
}

export async function resolvePublishCredentials(workspaceId: number): Promise<{
  igUserId: string;
  accessToken: string;
  accountId: number | null;
} | null> {
  const r = await query<{
    ig_user_id: string;
    ig_access_token: string;
    instagram_account_id: number | null;
    acc_ig_user_id: string | null;
    acc_token: string | null;
  }>(
    `SELECT w.ig_user_id, w.ig_access_token, w.instagram_account_id,
            a.ig_user_id AS acc_ig_user_id, a.ig_access_token AS acc_token
     FROM workspaces w
     LEFT JOIN instagram_accounts a ON a.id = w.instagram_account_id
     WHERE w.id = $1`,
    [workspaceId]
  );
  const row = r.rows[0];
  if (!row) return null;
  const igUserId = (row.acc_ig_user_id || row.ig_user_id || "").trim();
  const accessToken = (row.acc_token || row.ig_access_token || "").trim();
  if (!igUserId || !accessToken) return null;
  return { igUserId, accessToken, accountId: row.instagram_account_id };
}

export function agentToken(acc: InstagramAccount): string {
  return (acc.agent_access_token || acc.ig_access_token || "").trim();
}

/** Refinamentos opcionais — o prompt-base SDR vive em agent/agentPrompts.ts */
export const DEFAULT_COMMENT_PROMPT = "";

export const DEFAULT_DIRECT_PROMPT = "";
