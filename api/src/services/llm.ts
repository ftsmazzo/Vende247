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

type AnthropicMessage = { role: "user" | "assistant"; content: string };

async function anthropicOnce(model: string, system: string, messages: AnthropicMessage[], maxTokens: number) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!.trim(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.7,
      system,
      messages,
    }),
  });
  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
    stop_reason?: string;
  };
  if (!res.ok) {
    throw new Error(json.error?.message || `Anthropic HTTP ${res.status}`);
  }
  const text = (json.content || [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
  return { text, stop_reason: json.stop_reason || "" };
}

async function chatJsonAnthropic<T>(system: string, user: string): Promise<T> {
  if (!ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }
  const model = anthropicModel();
  const sys = `${system}\n\nResponda APENAS com um objeto JSON válido, compacto, sem markdown e sem texto fora do JSON. Sem vírgula pendurada.`;
  const maxTokens = Number(process.env.LLM_MAX_TOKENS || 16384);
  let { text, stop_reason } = await anthropicOnce(model, sys, [{ role: "user", content: user }], maxTokens);

  if (stop_reason === "max_tokens" && text.trim()) {
    const cont = await anthropicOnce(
      model,
      sys,
      [
        { role: "user", content: user },
        { role: "assistant", content: text },
        { role: "user", content: "Continue EXATAMENTE de onde parou. Só o restante do JSON, sem repetir o começo." },
      ],
      maxTokens
    );
    text += cont.text;
  }

  return parseLlmJson<T>(text || "{}");
}

export async function chatJson<T>(system: string, user: string): Promise<T> {
  const prov = provider();
  if (prov === "anthropic") {
    return chatJsonAnthropic<T>(system, user);
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
