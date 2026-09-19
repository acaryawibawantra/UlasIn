// Auth untuk PORTAL CLIENT (/kelola) — server only.
// - Password: bcryptjs (sama seperti PIN kartu NFC)
// - Session: token HMAC-signed disimpan di httpOnly cookie (tanpa dependency JWT)
// PENTING: file ini hanya boleh diimport dari Server Component / API Route.
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export const CLIENT_SESSION_COOKIE = "ratey_client_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

function getSessionSecret(): string {
  return (
    process.env.CLIENT_SESSION_SECRET ||
    process.env.ADMIN_SECRET_KEY ||
    "ratey-client-session-secret-2026"
  );
}

export type ClientSessionPayload = {
  userId: number;
  clientSlug: string;
  email: string;
  exp: number; // epoch ms
};

/* ── Password ── */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/* ── Session token (HMAC-signed, base64url payload.signature) ── */
export function createClientSessionToken(
  userId: number,
  clientSlug: string,
  email: string
): string {
  const payload: ClientSessionPayload = {
    userId,
    clientSlug,
    email,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyClientSessionToken(token: string | undefined | null): ClientSessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  // Constant-time compare untuk cegah timing attack
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ClientSessionPayload;
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ── Cookie helpers (untuk API Route handler / Server Component) ── */
export async function getClientSession(): Promise<ClientSessionPayload | null> {
  const store = await cookies();
  return verifyClientSessionToken(store.get(CLIENT_SESSION_COOKIE)?.value);
}

export const CLIENT_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};
