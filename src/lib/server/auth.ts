import { cache } from 'react';
import { hasMalingstatistikkAccess } from '@/lib/app-access';
import { createClient } from '@/lib/supabase/server';
import { ensureSchema, sql } from './db';

export type UserRole = 'admin' | 'leader';
export type Session = { id: string; role: UserRole; username: string; displayName: string };

const USER_COLUMNS = 'id::text,username,display_name,role,is_active';

/** E-mails that become Admin the first time they open the app (comma-separated), to bootstrap roles. */
function bootstrapAdmins() {
  return (process.env.MALINGSTATISTIKK_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * The portal user behind this request, with the local role. Sign-in, access and the redirect to the portal
 * are handled in src/proxy.ts; this checks the fresh user again and links it to app_users:
 * by supabase_sub, else on first visit by e-mail (the e-mail column or a username equal to it), else a new
 * user with the lowest role.
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
      const role: UserRole = email && bootstrapAdmins().includes(email) ? 'admin' : 'leader';
      // A username taken by an older local user falls back to the unique account id.
      rows = await q.query(`INSERT INTO app_users(username,display_name,role,email,supabase_sub,is_active,last_login_at)
        VALUES(CASE WHEN EXISTS(SELECT 1 FROM app_users WHERE lower(username)=lower($1)) THEN $4 ELSE $1 END,$2,$3,$5,$4,true,now())
        ON CONFLICT(supabase_sub) DO UPDATE SET last_login_at=now()
        RETURNING ${USER_COLUMNS}`, [email || sub, displayName, role, sub, email || null]);
    }
    const row = rows[0] as { id: string; username: string; display_name: string; role: string; is_active: boolean } | undefined;
    if (!row || !row.is_active || (row.role !== 'admin' && row.role !== 'leader')) return null;
    return { id: row.id, role: row.role, username: row.username, displayName: row.display_name };
  } catch { return null; }
});

export async function isAuthenticated() { return Boolean(await getSession()); }
export async function isAdmin() { return (await getSession())?.role === 'admin'; }
