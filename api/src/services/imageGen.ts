import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { uploadMedia, isStorageConfigured } from "./storage.js";
import type { BrandKit } from "./brandFromUrl.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/** volume = lote/slides | cover = peça principal | photo = hero LP | draft = teste rápido */
export type ImagePurpose = "volume" | "cover" | "photo" | "draft";

export type ImageGenOpts = {
  mode?: "ad" | "photo";
  overlayLogo?: boolean;
  purpose?: ImagePurpose;
  aspectRatio?: "4:5" | "9:16" | "3:4" | "1:1";
  /** Índice do post/slide — muda ângulo/luz para não repetir a mesma cena */
  diversityIndex?: number;
  /** Cena inspirada na research (texto), se houver */
  researchCue?: string;
};

/**
 * gpt-image gera ~2:3 (1024x1536); feed IG é 4:5 (1080x1350).
 * Cover centrado corta o topo — onde fica o hook — e parece “texto fora da moldura”.
 * position:north preserva o terço superior.
 */
async function toFeedJpeg(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(1080, 1350, { fit: "cover", position: "north" })
    .jpeg({ quality: 88 })
    .toBuffer();
}

/** Sufixos de diversidade (ângulo / luz / locação) — evita lote “tudo igual”. */
const DIVERSITY_SHOTS = [
  "wide establishing shot, morning industrial light",
  "medium shot, eye-level, soft daylight through warehouse windows",
  "close-up on hands and EPI gear, shallow depth of field",
  "slight low angle, dramatic side light, high contrast",
  "documentary candid, over-the-shoulder of supervisor",
  "two-shot conversation on plant floor, natural colors",
  "top-down / high angle on organized EPI shelves",
  "golden hour outdoor yard with workers in PPE",
];

export function diversityShot(index = 0): string {
  return DIVERSITY_SHOTS[Math.abs(index) % DIVERSITY_SHOTS.length];
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

function openRouterModelFor(purpose: ImagePurpose): string {
  const map: Record<ImagePurpose, string> = {
    volume:
      process.env.OR_MODEL_VOLUME?.trim() || "bytedance-seed/seedream-4.5",
    cover:
      process.env.OR_MODEL_COVER?.trim() || "google/gemini-3-pro-image",
    photo:
      process.env.OR_MODEL_PHOTO?.trim() || "black-forest-labs/flux.2-pro",
    draft:
      process.env.OR_MODEL_DRAFT?.trim() || "google/gemini-3.1-flash-image",
  };
  return map[purpose];
}

async function bufferFromOpenRouter(
  prompt: string,
  opts: { model: string; aspectRatio: string; resolution?: string; quality?: string }
): Promise<Buffer> {
  if (!OPENROUTER_API_KEY?.trim()) {
    throw new Error("OPENROUTER_API_KEY não configurada.");
  }
  const body: Record<string, unknown> = {
    model: opts.model,
    prompt,
    n: 1,
    aspect_ratio: opts.aspectRatio,
    output_format: "jpeg",
  };
  if (opts.resolution) body.resolution = opts.resolution;
  if (opts.quality) body.quality = opts.quality;

  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY.trim()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://vende247.app",
      "X-Title": process.env.OPENROUTER_APP_TITLE || "Vende247",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(
      json.error?.message || `OpenRouter images HTTP ${res.status}`
    );
  }
  const item = json.data?.[0];
  if (!item) throw new Error(`OpenRouter (${opts.model}) sem imagem.`);
  if (item.b64_json) {
    const raw = item.b64_json.includes(",")
      ? item.b64_json.split(",").pop()!
      : item.b64_json;
    return Buffer.from(raw, "base64");
  }
  if (item.url) {
    const img = await fetch(item.url);
    if (!img.ok) throw new Error(`Download OpenRouter HTTP ${img.status}`);
    return Buffer.from(await img.arrayBuffer());
  }
  throw new Error(`OpenRouter (${opts.model}) sem b64_json/url.`);
}

async function bufferFromGemini(prompt: string, aspectRatio: string): Promise<Buffer> {
  if (!GEMINI_API_KEY?.trim()) throw new Error("GEMINI_API_KEY não configurada.");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.trim() });
  const model =
    process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image";

  if (model.toLowerCase().startsWith("imagen")) {
    const response = await ai.models.generateImages({
      model,
      prompt,
      config: { numberOfImages: 1, aspectRatio: aspectRatio as "4:5" },
    });
    const generatedImages = (
      response as { generatedImages?: Array<{ image?: { imageBytes?: string } }> }
    ).generatedImages;
    const b64 = generatedImages?.[0]?.image?.imageBytes;
    if (!b64) throw new Error("Imagen não retornou imagem.");
    return Buffer.from(b64, "base64");
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const data = part.inlineData?.data;
    if (data) return Buffer.from(data, "base64");
  }
  throw new Error(`Gemini (${model}) não retornou imagem.`);
}

function buildPrompt(
  prompt: string,
  brand: BrandKit | null | undefined,
  mode: "ad" | "photo",
  extras?: { diversityIndex?: number; researchCue?: string }
): string {
  const shot = diversityShot(extras?.diversityIndex ?? 0);
  const cue = extras?.researchCue?.trim()
    ? `Visual inspiration (mood only, do not copy a brand): ${extras.researchCue.trim().slice(0, 220)}.`
    : "";

  if (mode === "photo") {
    return [
      "Premium photorealistic photograph, full bleed, no letterboxing, no frames,",
      "ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY, NO CAPTIONS, NO LOGOS, NO WATERMARKS, NO UI,",
      "cinematic lighting, editorial quality, clean composition with negative space on the left,",
      `Camera: ${shot}.`,
      "FORBIDDEN: smartphone mockups, fake dashboards, graphic overlays, stickers, banners.",
      brandPromptBits(brand),
      cue,
      prompt.slice(0, 2200),
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    "Instagram ad creative 4:5 portrait FULL BLEED edge-to-edge, no letterboxing, no black bars, no outer frame,",
    "scroll-stopping, vivid colors, emotional impact,",
    "SAFE ZONE: keep ALL text and faces inside a 12% margin from every edge — nothing important near the border,",
    "bold short Portuguese hook (3–6 words) in the UPPER-CENTER, fully readable, large clean sans typography,",
    "photorealistic workplace / industrial safety scene with real people wearing EPI when relevant,",
    `UNIQUE SHOT THIS IMAGE: ${shot} — must look different from other ads in the same campaign.`,
    "FORBIDDEN: smartphone mockups, fake app dashboards, invented UI, dark mats, widescreen bars,",
    "FORBIDDEN: text cut off, text overflowing edges, tiny unreadable type, watermark stamps,",
    "leave small clean space bottom-left for logo overlay only,",
    "no watermarks, no invented brand logos in the scene.",
    brandPromptBits(brand),
    cue,
    prompt.slice(0, 2200),
  ]
    .filter(Boolean)
    .join(" ");
}

export async function gerarImagemViral(
  prompt: string,
  brand?: BrandKit | null,
  opts?: ImageGenOpts
): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error("Storage de mídia não configurado.");
  }
  const mode = opts?.mode ?? (opts?.purpose === "photo" ? "photo" : "ad");
  const purpose: ImagePurpose =
    opts?.purpose ?? (mode === "photo" ? "photo" : "cover");
  const aspectRatio = opts?.aspectRatio ?? "4:5";
  const provider = (process.env.IMAGE_PROVIDER ?? "openai").toLowerCase();
  const enriched = buildPrompt(prompt, brand, mode, {
    diversityIndex: opts?.diversityIndex,
    researchCue: opts?.researchCue,
  });

  let buffer: Buffer;
  const tryOpenRouter = async () => {
    const model = openRouterModelFor(purpose);
    const resolution =
      purpose === "volume" || purpose === "draft"
        ? process.env.OR_RESOLUTION_VOLUME?.trim() || "2K"
        : process.env.OR_RESOLUTION_HQ?.trim() || "2K";
    return bufferFromOpenRouter(enriched.slice(0, 4000), {
      model,
      aspectRatio,
      resolution,
      quality: purpose === "draft" ? "medium" : "high",
    });
  };

  if (provider === "openrouter") {
    try {
      buffer = await tryOpenRouter();
    } catch (err) {
      // fallback OpenAI se configurado
      if (OPENAI_API_KEY?.trim()) {
        console.warn("[imageGen] OpenRouter falhou, fallback OpenAI:", err);
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
      } else {
        throw err;
      }
    }
  } else if (provider === "gemini") {
    buffer = await bufferFromGemini(enriched.slice(0, 4000), aspectRatio);
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
  const doLogo = opts?.overlayLogo ?? mode === "ad";
  const logo = brand?.logo_url || brand?.og_image_url;
  if (doLogo && logo) jpeg = await overlayLogo(jpeg, logo);
  return uploadMedia(jpeg, "image/jpeg", ".jpg");
}
