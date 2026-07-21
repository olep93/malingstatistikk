import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { ensureSchema, sql } from './db';

const COOKIE = 'maling_admin_session';
export type UserRole = 'admin' | 'leader';

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 24) throw new Error('SESSION_SECRET mangler eller er for kort.');
  return new TextEncoder().encode(value);
}

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, storedHash: string, salt: string) {
  const candidate = pbkdf2Sync(password, salt, 120000, 32, 'sha256');
  const stored = Buffer.from(storedHash, 'hex');
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

export async function ensureDefaultUsers() {
  await ensureSchema();
  const q = sql();
  const linn = await q`SELECT id FROM app_users WHERE lower(username)=lower('Linn') LIMIT 1`;
  if (!linn.length) {
    const p = hashPassword(process.env.LINN_PASSWORD || '40857084');
    await q`INSERT INTO app_users(username,display_name,role,password_hash,password_salt,is_active)
      VALUES('Linn','Linn','leader',${p.hash},${p.salt},true)`;
  } else {
    await q`UPDATE app_users SET role='leader' WHERE lower(username)=lower('Linn')`;
  }
}

export async function createSession(username: string, role: UserRole) {
  return new SignJWT({ role, username }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(secret());
}

export async function getSession() {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return null;
    const verified = await jwtVerify(token, secret());
    const role = String(verified.payload.role || '') as UserRole;
    if (role !== 'admin' && role !== 'leader') return null;
    return { role, username: String(verified.payload.username || 'Admin') };
  } catch { return null; }
}

export async function isAuthenticated() { return Boolean(await getSession()); }
export async function isAdmin() { return (await getSession())?.role === 'admin'; }

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
}
export async function clearSessionCookie() { (await cookies()).delete(COOKIE); }
