import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;

export type LlmProvider = "openai" | "gemini";

function provider(): LlmProvider {
  const p = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
  return p === "gemini" ? "gemini" : "openai";
}

function openaiModel() {
  return process.env.LLM_MODEL?.trim() || "gpt-4o-mini";
}

export async function chatJson<T>(system: string, user: string): Promise<T> {
  const prov = provider();
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
  const m = t.match(/\{[\s\S]*\}/);
  return m ? m[0] : "{}";
}
