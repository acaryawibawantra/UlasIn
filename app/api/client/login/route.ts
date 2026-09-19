import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  verifyPassword,
  createClientSessionToken,
  CLIENT_SESSION_COOKIE,
  CLIENT_SESSION_COOKIE_OPTIONS,
} from "@/lib/client-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: user, error } = await supabase
      .from("client_users")
      .select("id, client_slug, email, password_hash, is_active")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      console.error("client login fetch err:", error.message);
      return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
    }

    if (!user || !user.is_active) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    // Update last_login_at (non-blocking failure OK)
    await supabase.from("client_users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);

    // Pastikan client masih ada & aktif
    const { data: client } = await supabase
      .from("clients")
      .select("slug, business_name, status")
      .eq("slug", user.client_slug)
      .maybeSingle();
    if (!client || client.status !== "active") {
      return NextResponse.json({ error: "Akun bisnis Anda tidak aktif. Hubungi admin." }, { status: 403 });
    }

    const token = createClientSessionToken(user.id, user.client_slug, user.email);
    const res = NextResponse.json({
      ok: true,
      clientSlug: client.slug,
      businessName: client.business_name,
    });
    res.cookies.set(CLIENT_SESSION_COOKIE, token, CLIENT_SESSION_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("client login err:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
