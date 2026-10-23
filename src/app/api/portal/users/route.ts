import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/server/db';
import { readSignedPortalBody } from '@/lib/server/portal-signature';

/**
 * Portalen (jobbverktoy.no) styrer rollen: uploader (se og laste opp dagsrapport) eller viewer (bare se).
 * Admin settes aldri herfra; en bruker som er Admin (MALINGSTATISTIKK_ADMIN_EMAILS) forblir Admin.
 * Brukeren kobles på supabase_sub, eller på e-post for en eksisterende bruker som ikke er koblet ennå.
 */
const USER = 'role,store_sap_numbers,is_active';
const result = (row: Record<string, unknown>) => ({ role: row.role, storeSapNumbers: row.store_sap_numbers || [], active: Boolean(row.is_active) });

export async function POST(request: Request) {
  const signed = await readSignedPortalBody(request);
  if (!signed.ok) return NextResponse.json({ error: signed.error }, { status: signed.status });
  const body = signed.body;
  const action = String(body.action || '');
  const sub = String(body.sub || '').trim();
  if (!sub) return NextResponse.json({ error: 'Mangler sub.' }, { status: 400 });
  try {
    await ensureSchema();
    const q = sql();
    if (action === 'get') {
      const rows = await q.query(`SELECT ${USER} FROM app_users WHERE supabase_sub=$1`, [sub]);
      return rows.length ? NextResponse.json(result(rows[0])) : NextResponse.json({ error: 'Ukjent bruker.' }, { status: 404 });
    }
    if (action === 'deactivate') {
      const rows = await q.query(`UPDATE app_users SET is_active=false,updated_at=now() WHERE supabase_sub=$1 RETURNING ${USER}`, [sub]);
      return rows.length ? NextResponse.json(result(rows[0])) : NextResponse.json({ error: 'Ukjent bruker.' }, { status: 404 });
    }
    if (action !== 'upsert') return NextResponse.json({ error: 'Ukjent handling.' }, { status: 400 });
    if (body.role !== 'uploader' && body.role !== 'viewer') return NextResponse.json({ error: 'Rollen må være uploader eller viewer.' }, { status: 400 });
    const role = body.role;
    const email = String(body.email || '').trim().toLowerCase() || null;
    const name = String(body.name || '').trim() || email || 'Bruker';
    const stores = Array.isArray(body.storeSapNumbers) ? [...new Set(body.storeSapNumbers.map(v => String(v).trim()).filter(v => /^\d{1,10}$/.test(v)))] : [];
    // Koblet bruker, ellers en eksisterende ukoblet bruker med samme e-post, ellers ny.
    let rows = await q.query(`SELECT id FROM app_users WHERE supabase_sub=$1`, [sub]);
    if (!rows.length && email) rows = await q.query(`SELECT id FROM app_users WHERE supabase_sub IS NULL AND (lower(email)=$1 OR lower(username)=$1) ORDER BY id LIMIT 1`, [email]);
    if (rows.length) {
      rows = await q.query(`UPDATE app_users SET supabase_sub=$2,email=COALESCE($3,email),display_name=$4,
          role=CASE WHEN role='admin' THEN role ELSE $5 END,store_sap_numbers=$6::jsonb,is_active=true,updated_at=now()
        WHERE id=$1 RETURNING ${USER}`, [rows[0].id, sub, email, name, role, JSON.stringify(stores)]);
    } else {
      rows = await q.query(`INSERT INTO app_users(username,display_name,role,email,supabase_sub,store_sap_numbers,is_active)
        VALUES(CASE WHEN $1::text IS NULL OR EXISTS(SELECT 1 FROM app_users WHERE lower(username)=lower($1)) THEN $4 ELSE $1 END,$2,$3,$1,$4,$5::jsonb,true)
        RETURNING ${USER}`, [email, name, role, sub, JSON.stringify(stores)]);
    }
    return NextResponse.json(result(rows[0]));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Kunne ikke lagre brukeren.' }, { status: 500 });
  }
}
