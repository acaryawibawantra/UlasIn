import { NextResponse } from "next/server";
import { COMPANY_SESSION_COOKIE } from "@/lib/company-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COMPANY_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
