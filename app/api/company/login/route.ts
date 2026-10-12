import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  verifyPassword,
  createCompanySessionToken,
  COMPANY_SESSION_COOKIE,
  COMPANY_SESSION_COOKIE_OPTIONS,
} from "@/lib/company-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();
    const companyName = (body?.companyName || "").toString().trim();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
    }
    if (!companyName) {
      return NextResponse.json({ error: "Perusahaan tidak valid." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: user, error } = await supabase
      .from("company_users")
      .select("id, company_name, email, password_hash, is_active")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      console.error("company login fetch err:", error.message);
      return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
    }

    if (!user || !user.is_active) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    // Pastikan akun ini memang milik perusahaan yang URL-nya diakses.
    if (user.company_name !== companyName) {
      return NextResponse.json(
        { error: "Akun ini tidak terdaftar untuk perusahaan ini." },
        { status: 403 }
      );
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    await supabase
      .from("company_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);

    const token = createCompanySessionToken(user.id, user.company_name, user.email);
    const res = NextResponse.json({
      ok: true,
      companyName: user.company_name,
    });
    res.cookies.set(COMPANY_SESSION_COOKIE, token, COMPANY_SESSION_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("company login err:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
