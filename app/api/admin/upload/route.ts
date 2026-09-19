import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const BUCKET_ID = "menu-assets";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const adminSecret = process.env.ADMIN_SECRET_KEY || "ratey-admin-secret-2026";

    // Parse FormData SEKALI di awal — secretKey dikirim via form field
    // (dashboard upload multipart, bukan JSON body seperti route action)
    const formData = await req.formData();
    const providedKey = authHeader
      ? authHeader.replace("Bearer ", "")
      : ((formData.get("secretKey") as string | null) || null);

    if (!providedKey || providedKey !== adminSecret) {
      return NextResponse.json({ error: "Akses ditolak. Secret key salah." }, { status: 401 });
    }

    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string | null) || "menu";
    const scope = (formData.get("scope") as string | null) || "menu_item";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Format tidak didukung (${file.type}). Gunakan JPG, PNG, WEBP, atau GIF.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Ukuran file ${(file.size / 1024 / 1024).toFixed(1)}MB melebihi batas 5MB.` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Pastikan bucket public ada (idempotent — service role bypass RLS)
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.id === BUCKET_ID)) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET_ID, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
      });
      if (createErr) {
        return NextResponse.json(
          { error: `Gagal membuat bucket storage: ${createErr.message}` },
          { status: 500 }
        );
      }
    }

    // Nama file unik: {folder}/{scope}-{timestamp}-{random}.ext
    const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "menu";
    const safeScope = scope.replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "menu_item";
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const fileName = `${safeFolder}/${safeScope}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_ID)
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: `Upload gagal: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET_ID).getPublicUrl(fileName);

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      path: fileName,
      size: file.size,
      type: file.type,
    });
  } catch (err) {
    console.error("[upload] error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server saat upload." }, { status: 500 });
  }
}
