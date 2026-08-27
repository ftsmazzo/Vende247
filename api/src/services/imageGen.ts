import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { uploadMedia, isStorageConfigured } from "./storage.js";
import type { BrandKit } from "./brandFromUrl.js";
import { lockVisualToNiche, type NicheCtx } from "./nicheVisual.js";
import { bufferFromKairogen } from "./kairogen.js";

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
  /** Contexto do workspace — trava nicho e bloqueia EPI residual */
  niche?: NicheCtx;
  hook?: string;
  identityPositive?: string;
  identityNegative?: string;
  /**
   * URLs públicas de banco/referência.
   * No provider kairogen ativa modo Editar (img2img) em vez de criar do zero.
   */
  referenceImageUrls?: string[];
};

/**
 * Normaliza para feed IG 4:5 (1080×1350).
 * Se a origem já é ~4:5 (gpt-image-2 nativo), só redimensiona sem crop.
 * Se veio 2:3 (gpt-image-1.x), crop pelo topo para não cortar o hook.
 */
async function toFeedJpeg(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width || 1024;
  const h = meta.height || 1280;
  const ratio = w / h;
  const target = 1080 / 1350; // 0.8
  const near45 = Math.abs(ratio - target) < 0.04;

  return sharp(buffer)
    .rotate()
    .resize(
      1080,
      1350,
      near45
        ? { fit: "fill" }
        : { fit: "cover", position: "north" }
    )
    .jpeg({ quality: 88 })
    .toBuffer();
}

/** gpt-image-2: qualquer size com arestas múltiplas de 16. Usamos 4:5 / 9:16 exatos. */
function openaiImageSize(model: string, aspect: ImageGenOpts["aspectRatio"]): string {
  const m = model.toLowerCase();
  const isV2 = m.includes("gpt-image-2");
  if (isV2) {
    if (aspect === "9:16") return "1152x2048";
    if (aspect === "1:1") return "1024x1024";
    if (aspect === "3:4") return "1152x1536";
    return "1024x1280"; // 4:5 exato — sem letterbox/crop do hook
  }
  // gpt-image-1 / 1.5: tamanhos fixos da API
  if (aspect === "1:1") return "1024x1024";
  return "1024x1536";
}

function openaiImageQuality(
  model: string,
  purpose: ImagePurpose
): "low" | "medium" | "high" | "auto" {
  const m = model.toLowerCase();
  if (!m.includes("gpt-image")) return "high";
  if (purpose === "draft") return "low";
  if (purpose === "volume") return "medium";
  return "high";
}

async function bufferFromOpenAIGenerate(
  prompt: string,
  opts: { model: string; aspectRatio: ImageGenOpts["aspectRatio"]; purpose: ImagePurpose }
): Promise<Buffer> {
  if (!OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY não configurada.");
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY.trim() });
  const model = opts.model;
  const gptImage = model.toLowerCase().includes("gpt-image");
  const size = openaiImageSize(model, opts.aspectRatio ?? "4:5");
  const res = await openai.images.generate({
    model,
    prompt: prompt.slice(0, 4000),
    n: 1,
    // gpt-image-2 aceita sizes custom (múltiplos de 16); SDK tipa só os clássicos
    size: size as "1024x1024" | "1024x1536" | "1536x1024",
    ...(gptImage
      ? { quality: openaiImageQuality(model, opts.purpose) }
      : { quality: "standard" as const }),
  } as Parameters<typeof openai.images.generate>[0]);
  return bufferFromOpenAI(res.data?.[0]);
}

/** Sufixos de diversidade (ângulo / luz / locação) — evita lote “tudo igual”. */
const DIVERSITY_SHOTS = [
  "tight medium portrait, shallow depth, rim light from warehouse LED",
  "over-the-shoulder looking at tablet, face half-lit, documentary grit",
  "low angle hero of worker mid-action, dramatic industrial contrast",
  "close-up gloved hands + device screen glow, bokeh factory background",
  "two-shot conversation on shop floor, natural hard-hat authenticity",
  "wide aisle establishing shot, subject walking with purpose, cool teal grade",
  "eye-level candid pause, soft side light, real PPE textures sharp",
  "slight dutch energy, motion blur background, subject locked sharp",
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
  // Defaults otimizados custo×texto PT (criativos IG) — ago/2026
  const map: Record<ImagePurpose, string> = {
    volume: process.env.OR_MODEL_VOLUME?.trim() || "qwen/qwen-image-3",
    cover: process.env.OR_MODEL_COVER?.trim() || "qwen/qwen-image-3-pro",
    photo: process.env.OR_MODEL_PHOTO?.trim() || "krea/krea-2-large",
    draft: process.env.OR_MODEL_DRAFT?.trim() || "krea/krea-2-medium-turbo",
  };
  return map[purpose];
}

/** Modelos candidatos para A/B (override via OR_COMPARE_MODELS=id1,id2). */
export function openRouterCompareModels(): string[] {
  const raw = process.env.OR_COMPARE_MODELS?.trim();
  if (raw) {
    return raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
  }
  return [
    "krea/krea-2-medium-turbo", // ~$0.015 — rascunho rápido
    "qwen/qwen-image-3", // ~$0.03 — texto fino
    "qwen/qwen-image-3-pro", // ~$0.04 — capa com hook
    "krea/krea-2-large", // ~$0.06 — foto lifestyle
  ];
}

export async function gerarImagemComModelo(
  prompt: string,
  model: string,
  brand?: BrandKit | null,
  opts?: ImageGenOpts
): Promise<{ url: string; model: string }> {
  if (!isStorageConfigured()) {
    throw new Error("Storage de mídia não configurado.");
  }
  if (!OPENROUTER_API_KEY?.trim()) {
    throw new Error("OPENROUTER_API_KEY não configurada.");
  }
  const mode = opts?.mode ?? "ad";
  const aspectRatio = opts?.aspectRatio ?? "4:5";
  const enriched = buildPrompt(prompt, brand, mode, {
    diversityIndex: opts?.diversityIndex,
    researchCue: opts?.researchCue,
    niche: opts?.niche,
    hook: opts?.hook,
    identityPositive: opts?.identityPositive,
    identityNegative: opts?.identityNegative,
  });
  const resolution =
    opts?.purpose === "draft"
      ? process.env.OR_RESOLUTION_VOLUME?.trim() || "1K"
      : process.env.OR_RESOLUTION_HQ?.trim() || "2K";
  // Krea Turbo só 1K
  const res =
    model.includes("turbo") || model.includes("krea-2-medium-turbo")
      ? "1K"
      : resolution;
  const buffer = await bufferFromOpenRouter(enriched.slice(0, 4000), {
    model,
    aspectRatio,
    resolution: res,
  });
  let jpeg = await toFeedJpeg(buffer);
  const doLogo = opts?.overlayLogo ?? mode === "ad";
  const logo = brand?.logo_url || brand?.og_image_url;
  if (doLogo && logo) jpeg = await overlayLogo(jpeg, logo);
  const url = await uploadMedia(jpeg, "image/jpeg", ".jpg");
  return { url, model };
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
  extras?: {
    diversityIndex?: number;
    researchCue?: string;
    niche?: NicheCtx;
    hook?: string;
    identityPositive?: string;
    identityNegative?: string;
    hasReferenceImages?: boolean;
  }
): string {
  const shot = diversityShot(extras?.diversityIndex ?? 0);
  const locked = extras?.niche
    ? lockVisualToNiche(prompt, extras.niche, brand, extras.hook)
    : prompt;
  const cue = extras?.researchCue?.trim()
    ? `Visual inspiration (mood only, do not copy a brand): ${extras.researchCue.trim().slice(0, 180)}.`
    : "";
  const pos = extras?.identityPositive?.trim()
    ? `IDENTITY LOCK (must follow): ${extras.identityPositive.trim().slice(0, 900)}.`
    : "";
  const neg = extras?.identityNegative?.trim()
    ? `NEGATIVE / DO NOT: ${extras.identityNegative.trim().slice(0, 700)}.`
    : "";

  const industrial = extras?.niche
    ? /\b(epi|sst|prontepi|seguran|industrial|f[aá]brica)\b/i.test(
        `${extras.niche.nicho} ${extras.niche.produto}`
      )
    : false;

  if (mode === "photo") {
    return [
      "Premium photorealistic photograph, full bleed, no letterboxing, no frames,",
      "ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY, NO CAPTIONS, NO LOGOS, NO WATERMARKS, NO UI overlays as graphic stickers,",
      "cinematic lighting, editorial quality, clean composition with negative space on the left,",
      `Camera: ${shot}.`,
      "FORBIDDEN: smartphone mockups as empty frames, graphic stickers, banners, watermarks.",
      industrial
        ? "REQUIRED mood: industrial SST/EPI workplace. FORBIDDEN: Bible, planner journal, faith quiet-time, beige terracotta cozy morning."
        : "FORBIDDEN unless niche is industrial safety: hard hats, EPI/PPE factories as default filler. FORBIDDEN: Bible/faith props unless niche is faith.",
      brandPromptBits(brand),
      pos,
      neg,
      cue,
      locked.slice(0, 1800),
    ]
      .filter(Boolean)
      .join(" ");
  }

  const hookLine = (extras?.hook || "").trim().slice(0, 72);
  const hasRefs = Boolean(extras?.hasReferenceImages);

  // Criativo IG: texto NA imagem (padrão feed), mas layout limpo — sem “Canva inventado”.
  return [
    hasRefs
      ? "EDIT the reference photo(s) into a premium Instagram feed ad creative 4:5."
      : "Create a premium Instagram feed ad creative 4:5 portrait, FULL BLEED edge-to-edge.",
    "This is a finished social ad people post AS-IS — hook text MUST be painted into the image (not a raw photo).",
    "LAYOUT RULES (strict):",
    "- ONE short Portuguese hook only (3–7 words), huge bold sans, high contrast, upper third.",
    hookLine ? `- Exact hook text to render: \"${hookLine}\"` : "- Use the Portuguese hook implied by the brief.",
    "- Optional one tiny subline under the hook (max 8 words) OR none — never paragraphs.",
    "- Photoreal cinematic scene is 70% of the frame; typography is 30% graphic design, not a document.",
    "- Dark navy / deep teal industrial grade when SST/EPI; crisp edges, magazine ad finish.",
    `Camera / mood: ${shot}.`,
    "FORBIDDEN (causes cheap AI ads):",
    "- multi-card grids, numbered feature boxes (01/02/03), list layouts, FAQ blocks,",
    "- fake mobile UI chrome, invented dashboards as stickers, big CTA banners with arrows,",
    "- watermark stamps, logo walls, barcode, QR, collages of 3+ panels,",
    "- tiny unreadable text, text cut at edges, comic speech bubbles.",
    "ALLOWED on device screens: a subtle real product UI glow — never a full fake app redesign filling the frame.",
    "Leave a clean corner bottom-left for a small logo overlay later.",
    industrial
      ? "REQUIRED authenticity: real SST/EPI workplace people + gear. FORBIDDEN: Bible, planner, faith lifestyle, beige cozy."
      : "Match the product niche; do not default to hard hats unless niche is industrial safety.",
    brandPromptBits(brand),
    pos,
    neg,
    cue,
    locked.slice(0, 1600),
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
    niche: opts?.niche,
    hook: opts?.hook,
    identityPositive: opts?.identityPositive,
    identityNegative: opts?.identityNegative,
    hasReferenceImages: Boolean(opts?.referenceImageUrls?.length),
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

  if (provider === "kairogen") {
    buffer = await bufferFromKairogen(enriched.slice(0, 4000), {
      purpose,
      aspectRatio,
      referenceImageUrls: opts?.referenceImageUrls,
    });
  } else if (provider === "openrouter") {
    try {
      buffer = await tryOpenRouter();
    } catch (err) {
      if (OPENAI_API_KEY?.trim()) {
        console.warn("[imageGen] OpenRouter falhou, fallback OpenAI:", err);
        const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
        buffer = await bufferFromOpenAIGenerate(enriched, {
          model,
          aspectRatio,
          purpose,
        });
      } else {
        throw err;
      }
    }
  } else if (provider === "gemini") {
    buffer = await bufferFromGemini(enriched.slice(0, 4000), aspectRatio);
  } else {
    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
    buffer = await bufferFromOpenAIGenerate(enriched, {
      model,
      aspectRatio,
      purpose,
    });
  }

  let jpeg = await toFeedJpeg(buffer);
  const doLogo = opts?.overlayLogo ?? mode === "ad";
  const logo = brand?.logo_url || brand?.og_image_url;
  if (doLogo && logo) jpeg = await overlayLogo(jpeg, logo);
  return uploadMedia(jpeg, "image/jpeg", ".jpg");
}
