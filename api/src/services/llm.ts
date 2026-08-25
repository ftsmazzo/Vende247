import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export type LlmProvider = "openai" | "gemini" | "anthropic";

function provider(): LlmProvider {
  const p = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
  if (p === "gemini") return "gemini";
  if (p === "anthropic" || p === "claude") return "anthropic";
  return "openai";
}

function openaiModel() {
  return process.env.LLM_MODEL?.trim() || "gpt-4o-mini";
}

function anthropicModel() {
  return process.env.LLM_MODEL?.trim() || "claude-sonnet-4-6";
}

async function chatJsonAnthropic<T>(system: string, user: string, maxTokens: number): Promise<T> {
  if (!ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY.trim(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: anthropicModel(),
      max_tokens: maxTokens,
      temperature: 0.4,
      system: `${system}\n\nResponda APENAS com JSON compacto e válido. Sem markdown. Sintetize.`,
      messages: [{ role: "user", content: user }],
    }),
  });
  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message || `Anthropic HTTP ${res.status}`);
  }
  const text = (json.content || [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
  return parseLlmJson<T>(text || "{}");
}

export async function chatJson<T>(system: string, user: string, maxTokens = 4096): Promise<T> {
  const prov = provider();
  if (prov === "anthropic") {
    return chatJsonAnthropic<T>(system, user, maxTokens);
  }
  if (prov === "gemini") {
    if (!GEMINI_API_KEY?.trim()) throw new Error("GEMINI_API_KEY não configurada.");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.trim() });
    const model = process.env.LLM_MODEL?.trim() || "gemini-2.0-flash";
    const res = await ai.models.generateContent({
      model,
      contents: `${system}\n\n---\n\n${user}\n\nResponda APENAS com JSON válido.`,
      config: { responseMimeType: "application/json" },
    });
    const text = (res as { text?: string }).text ?? "";
    return parseLlmJson<T>(text);
  }

  if (!OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY não configurada.");
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY.trim() });
  const res = await openai.chat.completions.create({
    model: openaiModel(),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
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
