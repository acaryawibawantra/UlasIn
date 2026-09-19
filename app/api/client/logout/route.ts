import { NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE } from "@/lib/client-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CLIENT_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
