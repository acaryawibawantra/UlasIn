import { NextRequest } from "next/server";
import { getR2Object, isR2Configured } from "@/lib/r2Storage";

/* Route penyaji gambar R2 lewat domain aplikasi sendiri.
   Dipakai kalau NEXT_PUBLIC_R2_PUBLIC_URL masih *.r2.dev (diblokir ISP).
   Membaca object langsung via S3 API — tidak butuh DNS publik R2. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Nama file di R2 unik & immutable → aman di-cache lama. */
const CACHE_CONTROL = "public, max-age=31536000, s-maxage=31536000, immutable";

const notFound = () => new Response("Not found", { status: 404 });

async function loadObject(keyParam?: string[]) {
  if (!isR2Configured()) return null;
  const key = (keyParam || []).join("/").trim();
  if (!key || key.includes("..")) return null;

  try {
    const obj = await getR2Object(key);
    if (!obj.Body) return null;
    return obj;
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode;
    if (status === 404 || err?.name === "NoSuchKey" || err?.name === "NotFound") return null;
    console.error("[media] error:", err);
    throw err;
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: { key?: string[] } }
) {
  try {
    const obj = await loadObject(ctx.params?.key);
    if (!obj || !obj.Body) return notFound();

    const headers = new Headers();
    headers.set("Content-Type", obj.ContentType || "application/octet-stream");
    headers.set("Cache-Control", CACHE_CONTROL);
    if (obj.ContentLength) headers.set("Content-Length", String(obj.ContentLength));
    if (obj.ETag) headers.set("ETag", obj.ETag);

    const body = (obj.Body as any).transformToWebStream() as ReadableStream;
    return new Response(body, { status: 200, headers });
  } catch {
    return new Response("Gagal memuat gambar.", { status: 500 });
  }
}

export async function HEAD(
  _req: NextRequest,
  ctx: { params: { key?: string[] } }
) {
  try {
    const obj = await loadObject(ctx.params?.key);
    if (!obj) return notFound();

    const headers = new Headers();
    headers.set("Content-Type", obj.ContentType || "application/octet-stream");
    headers.set("Cache-Control", CACHE_CONTROL);
    if (obj.ContentLength) headers.set("Content-Length", String(obj.ContentLength));
    if (obj.ETag) headers.set("ETag", obj.ETag);
    return new Response(null, { status: 200, headers });
  } catch {
    return new Response(null, { status: 500 });
  }
}
