import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { uploadMedia, isStorageConfigured } from "./storage.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;

async function toFeedJpeg(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(1080, 1350, { fit: "cover" })
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function bufferFromOpenAI(
  item: { b64_json?: string | null; url?: string | null } | undefined
): Promise<Buffer> {
  if (!item) throw new Error("OpenAI não retornou imagem.");
  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`Download imagem OpenAI HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("OpenAI sem b64_json nem url.");
}

export async function gerarImagemViral(prompt: string): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error("Storage de mídia não configurado.");
  }
  const provider = (process.env.IMAGE_PROVIDER ?? "openai").toLowerCase();
  const enriched = [
    "Instagram feed creative 4:5 vertical, scroll-stopping, high contrast,",
    "bold short hook text space in upper third, modern commercial photography,",
    "no watermarks, no logos unless asked, viral social ad style 2026.",
    prompt.slice(0, 2800),
  ].join(" ");

  let buffer: Buffer;
  if (provider === "gemini") {
    if (!GEMINI_API_KEY?.trim()) throw new Error("GEMINI_API_KEY não configurada.");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.trim() });
    const response = await ai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt: enriched.slice(0, 4000),
      config: { numberOfImages: 1, aspectRatio: "3:4" },
    });
    const generatedImages = (
      response as { generatedImages?: Array<{ image?: { imageBytes?: string } }> }
    ).generatedImages;
    const b64 = generatedImages?.[0]?.image?.imageBytes;
    if (!b64) throw new Error("Imagen não retornou imagem.");
    buffer = Buffer.from(b64, "base64");
  } else {
    if (!OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY não configurada.");
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY.trim() });
    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "dall-e-3";
    const gptImage = model.toLowerCase().includes("gpt-image");
    const res = await openai.images.generate({
      model,
      prompt: enriched.slice(0, 4000),
      n: 1,
      size: gptImage ? "1024x1536" : "1024x1792",
      ...(gptImage ? { quality: "high" as const } : { quality: "standard" as const }),
    });
    buffer = await bufferFromOpenAI(res.data?.[0]);
  }

  const jpeg = await toFeedJpeg(buffer);
  return uploadMedia(jpeg, "image/jpeg", ".jpg");
}
