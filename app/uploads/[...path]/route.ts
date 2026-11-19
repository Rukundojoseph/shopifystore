import { readFile } from "node:fs/promises";
import path from "node:path";
import { LOCAL_ROOT } from "@/lib/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

// Serves locally stored uploads (dev / single-server deployments).
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.length !== 2 || !/^[0-9a-f-]{36}$/.test(parts[0]) || !/^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(parts[1])) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const buf = await readFile(path.join(LOCAL_ROOT, parts[0], parts[1]));
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": TYPES[parts[1].split(".").pop()!], "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
