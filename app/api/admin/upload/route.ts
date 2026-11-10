import { NextRequest, NextResponse } from "next/server";
import { uploadImageToR2, isR2Configured } from "@/lib/r2Storage";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "Storage R2 belum dikonfigurasi. Isi env R2_* dan NEXT_PUBLIC_R2_PUBLIC_URL." },
        { status: 503 }
      );
    }
    const authHeader = req.headers.get("authorization");
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (!adminSecret) {
      return NextResponse.json({ error: "Akses admin belum dikonfigurasi." }, { status: 503 });
    }

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

    // Nama file unik: {folder}/{scope}-{timestamp}-{random}.ext
    const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "menu";
    const safeScope = scope.replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "menu_item";
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const fileName = `${safeFolder}/${safeScope}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const publicUrl = await uploadImageToR2(fileName, arrayBuffer, file.type);

    return NextResponse.json({
      url: publicUrl,
      path: fileName,
      size: file.size,
      type: file.type,
    });
  } catch (err) {
    console.error("[upload] error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server saat upload." }, { status: 500 });
  }
}
