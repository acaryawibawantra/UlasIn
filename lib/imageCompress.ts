/* Kompres & resize gambar di browser sebelum upload.
   Tujuan: menekan egress Supabase Storage (foto besar = cached egress besar).
   - GIF dilewatkan apa adanya (agar animasi tidak hilang).
   - Output WebP (mendukung transparansi, ukuran jauh lebih kecil dari JPG/PNG).
   - Ukuran maksimum dimensi ditentukan pemanggil (thumbnail vs cover). */

export type CompressOptions = {
  maxDim: number;
  quality?: number;
  minSize?: number;
};

export async function compressImageFile(file: File, maxDimOrOptions: number | CompressOptions): Promise<File> {
  const opts: CompressOptions =
    typeof maxDimOrOptions === "number" ? { maxDim: maxDimOrOptions } : maxDimOrOptions;
  const maxDim = opts.maxDim;
  const quality = opts.quality ?? 0.8;
  const minSize = opts.minSize ?? 120 * 1024;

  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;
  if (file.size < minSize) return file;

  try {
    const img = document.createElement("img");
    const objUrl = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode"));
      img.src = objUrl;
    });
    URL.revokeObjectURL(objUrl);

    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );
    if (!blob) return file;

    /* Jangan sampai hasil kompresi lebih besar dari aslinya. */
    if (blob.size >= file.size && scale >= 1) return file;

    const type = blob.type || "image/webp";
    const ext = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
    const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "image";
    return new File([blob], `${baseName}.${ext}`, { type });
  } catch {
    return file;
  }
}
