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

async function chatJsonAnthropic<T>(system: string, user: string): Promise<T> {
  if (!ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }
  const model = anthropicModel();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY.trim(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.7,
      system: `${system}\n\nResponda APENAS com JSON válido (objeto), sem markdown e sem texto fora do JSON.`,
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
  return JSON.parse(extractJson(text || "{}")) as T;
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
    return JSON.parse(extractJson(text)) as T;
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
  return JSON.parse(extractJson(text)) as T;
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
