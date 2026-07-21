import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE = 'maling_admin_session';
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 24) throw new Error('SESSION_SECRET mangler eller er for kort.');
  return new TextEncoder().encode(value);
}
export async function createSession(username: string) {
  return new SignJWT({ role: 'admin', username }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(secret());
}
export async function getSession() {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return null;
    const verified = await jwtVerify(token, secret());
    return { role: String(verified.payload.role || ''), username: String(verified.payload.username || 'Admin') };
  } catch { return null; }
}
export async function isAdmin() { return Boolean(await getSession()); }

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
}
export async function clearSessionCookie() { (await cookies()).delete(COOKIE); }
