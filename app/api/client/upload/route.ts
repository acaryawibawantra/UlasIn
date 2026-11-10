import { NextRequest, NextResponse } from "next/server";
import { uploadImageToR2, isR2Configured } from "@/lib/r2Storage";
import { getClientSession } from "@/lib/client-auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/* Upload image PORTAL CLIENT — auth via session cookie (bukan admin secret).
   Folder otomatis = slug client dari session. */
export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Sesi berakhir. Silakan login ulang." }, { status: 401 });
  }

  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "Storage R2 belum dikonfigurasi. Hubungi admin." },
        { status: 503 }
      );
    }
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
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

    const safeScope = scope.replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "menu_item";
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const fileName = `${session.clientSlug}/${safeScope}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const publicUrl = await uploadImageToR2(fileName, arrayBuffer, file.type);

    return NextResponse.json({ url: publicUrl, path: fileName, size: file.size, type: file.type });
  } catch (err) {
    console.error("client upload err:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server saat upload." }, { status: 500 });
  }
}
