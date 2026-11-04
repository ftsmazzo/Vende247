import { chatJson } from "../llm.js";
import {
  agentToken,
  DEFAULT_DIRECT_PROMPT,
  type InstagramAccount,
} from "../instagramAccounts.js";
import { sendIgDm } from "./graphAgent.js";
import { query } from "../../db/index.js";

export async function handleDirectEvent(opts: {
  account: InstagramAccount;
  senderId: string;
  text: string;
}): Promise<{ replied: boolean; reply?: string; error?: string }> {
  if (!opts.account.agent_ativo) return { replied: false, error: "Agente desligado nesta conta." };
  const token = agentToken(opts.account);
  if (!token) return { replied: false, error: "Sem token na conta." };
  if (!opts.account.ig_user_id) return { replied: false, error: "ig_user_id ausente." };

  const system = opts.account.agent_prompt_direct?.trim() || DEFAULT_DIRECT_PROMPT;
  let replyText: string;
  try {
    const out = await chatJson<{ reply: string }>(
      `${system}\nResponda JSON {"reply":"..."} com mensagem curta para Direct.`,
      JSON.stringify({
        mensagem: opts.text,
        conta: opts.account.ig_username || opts.account.label,
      }),
      1024,
      { purpose: "agent" }
    );
    replyText = (out.reply || "").trim();
  } catch (e) {
    return { replied: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!replyText) return { replied: false, error: "LLM não gerou reply." };

  try {
    await sendIgDm({
      igUserId: opts.account.ig_user_id,
      recipientId: opts.senderId,
      text: replyText,
      accessToken: token,
      facebookPageId: opts.account.facebook_page_id || undefined,
    });
    await query(
      `UPDATE instagram_accounts SET last_agent_event_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [opts.account.id]
    );
    return { replied: true, reply: replyText };
  } catch (e) {
    return { replied: false, reply: replyText, error: e instanceof Error ? e.message : String(e) };
  }
}
