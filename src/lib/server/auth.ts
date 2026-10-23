import { cache } from 'react';
import { hasMalingstatistikkAccess } from '@/lib/app-access';
import { createClient } from '@/lib/supabase/server';
import { ensureSchema, sql } from './db';

/**
 * admin: bare e-postene i MALINGSTATISTIKK_ADMIN_EMAILS (alt, også periodeimport og brukere).
 * uploader: se og laste opp dagsrapport. viewer: bare se.
 * Portalen setter uploader/viewer via /api/portal/users og sender aldri admin.
 */
export type UserRole = 'admin' | 'uploader' | 'viewer';
export type Session = { id: string; role: UserRole; username: string; displayName: string; storeSapNumbers: string[] };

const USER_COLUMNS = 'id::text,username,display_name,role,is_active,store_sap_numbers';

/** E-mails that are always Admin (comma-separated). Nobody else can be Admin. */
export function adminEmails() {
  return (process.env.MALINGSTATISTIKK_ADMIN_EMAILS || 'olep93@gmail.com').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * The portal user behind this request, with the local role. Sign-in, access and the redirect to the portal
 * are handled in src/proxy.ts; this checks the fresh user again and links it to app_users:
 * by supabase_sub, else on first visit by e-mail (the e-mail column or a username equal to it), else a new
 * user with the lowest role until the portal sets one.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  try {
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (!user || !hasMalingstatistikkAccess(user)) return null;
    await ensureSchema();
    const q = sql();
    const sub = user.id;
    const email = (user.email || '').trim().toLowerCase();
    let rows = await q.query(`UPDATE app_users SET last_login_at=now() WHERE supabase_sub=$1 RETURNING ${USER_COLUMNS}`, [sub]);
    if (!rows.length && email) {
      rows = await q.query(`UPDATE app_users SET supabase_sub=$1,email=$2,last_login_at=now(),updated_at=now()
        WHERE id=(SELECT id FROM app_users WHERE supabase_sub IS NULL AND (lower(email)=$2 OR lower(username)=$2) ORDER BY id LIMIT 1)
        RETURNING ${USER_COLUMNS}`, [sub, email]);
    }
    if (!rows.length) {
      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      const displayName = String(meta.full_name || meta.name || email || 'Bruker');
      // A username taken by an older local user falls back to the unique account id.
      rows = await q.query(`INSERT INTO app_users(username,display_name,role,email,supabase_sub,is_active,last_login_at)
        VALUES(CASE WHEN EXISTS(SELECT 1 FROM app_users WHERE lower(username)=lower($1)) THEN $4 ELSE $1 END,$2,'viewer',$3,$4,true,now())
        ON CONFLICT(supabase_sub) DO UPDATE SET last_login_at=now()
        RETURNING ${USER_COLUMNS}`, [email || sub, displayName, email || null, sub]);
    }
    // Admin follows the list only: listed e-mails become Admin, and an Admin who is not listed becomes uploader.
    const listed = Boolean(email) && adminEmails().includes(email);
    if (rows.length && listed !== (rows[0].role === 'admin'))
      rows = await q.query(`UPDATE app_users SET role=$2,updated_at=now() WHERE id=$1 RETURNING ${USER_COLUMNS}`, [rows[0].id, listed ? 'admin' : 'uploader']);
    const row = rows[0] as { id: string; username: string; display_name: string; role: string; is_active: boolean; store_sap_numbers?: unknown } | undefined;
    if (!row || !row.is_active || !['admin', 'uploader', 'viewer'].includes(row.role)) return null;
    const stores = Array.isArray(row.store_sap_numbers) ? row.store_sap_numbers.map(String) : [];
    return { id: row.id, role: row.role as UserRole, username: row.username, displayName: row.display_name, storeSapNumbers: stores };
  } catch { return null; }
});

export async function isAuthenticated() { return Boolean(await getSession()); }
export async function isAdmin() { return (await getSession())?.role === 'admin'; }
/** See and upload the daily report: uploader and admin. */
export async function canUpload() { const role = (await getSession())?.role; return role === 'admin' || role === 'uploader'; }
