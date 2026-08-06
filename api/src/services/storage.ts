import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DIR = path.resolve(__dirname, "../../data/uploads");

export function isStorageConfigured(): boolean {
  const mode = (process.env.STORAGE ?? "local").toLowerCase();
  if (mode === "cloudinary") {
    return Boolean(process.env.CLOUDINARY_CLOUD_NAME?.trim() && process.env.CLOUDINARY_UPLOAD_PRESET?.trim());
  }
  return true;
}

export async function uploadMedia(buffer: Buffer, contentType: string, ext: string): Promise<string> {
  const mode = (process.env.STORAGE ?? "local").toLowerCase();
  if (mode === "cloudinary") {
    return uploadCloudinary(buffer, contentType);
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(LOCAL_DIR, name);
  await fs.writeFile(filePath, buffer);
  const base = (process.env.MEDIA_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/media/${name}`;
}

async function uploadCloudinary(buffer: Buffer, contentType: string): Promise<string> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME!.trim();
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET!.trim();
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: contentType }), "image.jpg");
  form.append("upload_preset", preset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Cloudinary HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error("Cloudinary sem secure_url.");
  return data.secure_url;
}

export function getLocalUploadsDir() {
  return LOCAL_DIR;
}
