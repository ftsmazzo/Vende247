import OpenAI from "openai";

/**
 * Texto/JSON do Vende247 passa só pelo OpenRouter.
 * Troque o modelo via LLM_MODEL (slug OpenRouter), ex.:
 *   openai/gpt-4o-mini
 *   anthropic/claude-sonnet-4
 *   google/gemini-2.5-flash
 * Opcional: LLM_MODEL_AGENT para comentário/DM (senão usa LLM_MODEL).
 */

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

function openRouterKey(): string {
  const k = process.env.OPENROUTER_API_KEY?.trim();
  if (!k) throw new Error("OPENROUTER_API_KEY não configurada (LLM só via OpenRouter).");
  return k;
}

export function llmModel(purpose: "default" | "agent" = "default"): string {
  if (purpose === "agent") {
    const agent = process.env.LLM_MODEL_AGENT?.trim();
    if (agent) return agent;
  }
  return process.env.LLM_MODEL?.trim() || "openai/gpt-4o-mini";
}

function client(): OpenAI {
  return new OpenAI({
    apiKey: openRouterKey(),
    baseURL: OPENROUTER_BASE,
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://vende247.app",
      "X-Title": process.env.OPENROUTER_APP_TITLE || "Vende247",
    },
  });
}

export async function chatJson<T>(
  system: string,
  user: string,
  maxTokens = 4096,
  opts?: { purpose?: "default" | "agent" }
): Promise<T> {
  const model = llmModel(opts?.purpose ?? "default");
  const openai = client();
  const res = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    messages: [
      {
        role: "system",
        content: `${system}\n\nResponda APENAS com JSON compacto e válido. Sem markdown.`,
      },
      { role: "user", content: user },
    ],
    temperature: 0.7,
  });
  const text = res.choices[0]?.message?.content ?? "{}";
  return parseLlmJson<T>(text);
}

export function parseLlmJson<T>(text: string): T {
  const raw = extractJson(text || "{}");
  try {
    return JSON.parse(raw) as T;
  } catch {
    /* continue */
  }
  try {
    return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1")) as T;
  } catch {
    /* continue */
  }
  try {
    return JSON.parse(salvageTruncatedJson(raw)) as T;
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err);
    throw new Error(`O modelo devolveu JSON inválido (${hint}). Rode de novo.`);
  }
}

function salvageTruncatedJson(input: string): string {
  let s = input.replace(/,\s*([}\]])/g, "$1");
  s = s.replace(/,\s*"[^"\\]*$/s, "");
  s = s.replace(/:\s*"[^"]*$/s, ': ""');
  s = s.replace(/:\s*-?\d+\.?$/s, ": 0");
  s = s.replace(/:\s*(true|false|null)?$/s, ": null");

  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inStr) s += '"';
  s = s.replace(/,\s*$/, "");
  while (stack.length) s += stack.pop();
  return s.replace(/,\s*([}\]])/g, "$1");
}

function extractJson(text: string): string {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) return t;
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    if (inner.startsWith("{") || inner.startsWith("[")) return inner;
  }
  const m = t.match(/\{[\s\S]*\}/);
  return m ? m[0] : "{}";
}
