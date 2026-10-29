import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secretKey } = body || {};
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (!adminSecret) {
      return NextResponse.json({ error: "Akses admin belum dikonfigurasi." }, { status: 503 });
    }

    if (!secretKey || secretKey !== adminSecret) {
      return NextResponse.json(
        { error: "Password Master Admin salah." },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
