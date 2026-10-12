// Auth untuk PORTAL PERUSAHAAN (/perusahaan) — server only.
// Pola sama dengan client-auth.ts tapi cookie & secret terpisah agar session
// perusahaan tidak bentrok dengan session client portal (/kelola).
// - Password: bcryptjs
// - Session: token HMAC-signed disimpan di httpOnly cookie
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export const COMPANY_SESSION_COOKIE = "ratey_company_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

function getSessionSecret(): string {
  return (
    process.env.COMPANY_SESSION_SECRET ||
    process.env.CLIENT_SESSION_SECRET ||
    process.env.ADMIN_SECRET_KEY ||
    "ratey-company-session-secret-2026"
  );
}

export type CompanySessionPayload = {
  userId: number;
  companyName: string;
  email: string;
  exp: number;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function createCompanySessionToken(
  userId: number,
  companyName: string,
  email: string
): string {
  const payload: CompanySessionPayload = {
    userId,
    companyName,
    email,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyCompanySessionToken(
  token: string | undefined | null
): CompanySessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as CompanySessionPayload;
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getCompanySession(): Promise<CompanySessionPayload | null> {
  const store = await cookies();
  return verifyCompanySessionToken(store.get(COMPANY_SESSION_COOKIE)?.value);
}

export const COMPANY_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};
