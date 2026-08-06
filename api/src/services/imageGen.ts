import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { uploadMedia, isStorageConfigured } from "./storage.js";
import type { BrandKit } from "./brandFromUrl.js";

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

async function overlayLogo(baseJpeg: Buffer, logoUrl: string): Promise<Buffer> {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return baseJpeg;
    const logoBuf = Buffer.from(await res.arrayBuffer());
    const logo = await sharp(logoBuf)
      .resize({ width: 200, height: 200, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const meta = await sharp(logo).metadata();
    const lh = meta.height ?? 80;
    const pad = 36;
    return sharp(baseJpeg)
      .composite([{ input: logo, left: pad, top: 1350 - lh - pad }])
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    return baseJpeg;
  }
}

function brandPromptBits(brand?: BrandKit | null): string {
  if (!brand) return "";
  const parts: string[] = [];
  if (brand.visual_summary) parts.push(`Brand mood/colors: ${brand.visual_summary}`);
  if (brand.colors?.length) parts.push(`Accent colors: ${brand.colors.join(", ")}`);
  return parts.join(". ");
}

export async function gerarImagemViral(
  prompt: string,
  brand?: BrandKit | null
): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error("Storage de mídia não configurado.");
  }
  const provider = (process.env.IMAGE_PROVIDER ?? "openai").toLowerCase();
  const enriched = [
    "Instagram ad creative 4:5 FULL BLEED edge-to-edge, no letterboxing, no black bars, no outer frame, no fake polaroid border,",
    "scroll-stopping, vivid colors, emotional impact,",
    "bold short Portuguese hook text in upper third, clean typography,",
    "photorealistic workplace / industrial safety scene with real people wearing EPI",
    "(hard hat, gloves, goggles) when relevant,",
    "FORBIDDEN: smartphone mockups, 3D phone clusters, fake generic app dashboards, invented UI screens,",
    "FORBIDDEN: upside-down phones, plastic stock marketing of floating devices,",
    "FORBIDDEN: dark mats, cinematic widescreen bars, picture-in-picture frames inside the image,",
    "leave small clean space bottom-left for logo overlay only,",
    "no watermarks, no invented brand logos in the scene.",
    brandPromptBits(brand),
    prompt.slice(0, 2300),
  ]
    .filter(Boolean)
    .join(" ");

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
    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5";
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

  let jpeg = await toFeedJpeg(buffer);
  const logo = brand?.logo_url || brand?.og_image_url;
  if (logo) jpeg = await overlayLogo(jpeg, logo);
  return uploadMedia(jpeg, "image/jpeg", ".jpg");
}
