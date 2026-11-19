import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Storage abstraction. Uses Supabase Storage when SUPABASE_URL and the service
// role key are configured; otherwise writes to ./storage/uploads (dev).

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const LOCAL_ROOT = path.join(process.cwd(), "storage", "uploads");
const BUCKET = "media";

/** Detects the real file type from magic bytes — the browser-supplied type is not trusted. */
export function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a") return { mime: "image/gif", ext: "gif" };
  return null;
}

export async function storeImage(storeId: string, buf: Buffer): Promise<{ url: string; mime: string }> {
  const kind = sniffImage(buf);
  if (!kind) throw new Error("Only JPG, PNG, WebP or GIF images are allowed");
  if (buf.length > MAX_UPLOAD_BYTES) throw new Error("Images must be 5 MB or smaller");
  const key = `${storeId}/${randomUUID()}.${kind.ext}`;

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supaUrl && supaKey) {
    const res = await fetch(`${supaUrl}/storage/v1/object/${BUCKET}/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supaKey}`, "Content-Type": kind.mime, "x-upsert": "false" },
      body: new Uint8Array(buf),
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return { url: `${supaUrl}/storage/v1/object/public/${BUCKET}/${key}`, mime: kind.mime };
  }

  const dest = path.join(LOCAL_ROOT, key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return { url: `/uploads/${key}`, mime: kind.mime };
}
