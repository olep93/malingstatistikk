import { NextResponse } from 'next/server';
import { createSession, ensureDefaultUsers, hashPassword, setSessionCookie, verifyPassword, UserRole } from '@/lib/server/auth';
import { sql } from '@/lib/server/db';

export async function POST(req: Request) {
  const { username, password } = await req.json();
  const cleanUsername=String(username||'').trim();
  const cleanPassword=String(password||'');
  if(!cleanUsername||!cleanPassword)return NextResponse.json({error:'Brukernavn og passord må fylles ut.'},{status:400});
  await ensureDefaultUsers();
  const q=sql();
  let rows=await q`SELECT id,username,display_name,role,password_hash,password_salt,is_active FROM app_users WHERE lower(username)=lower(${cleanUsername}) LIMIT 1`;

  // Første innlogging etter oppgradering migrerer eksisterende miljøbasert Admin-bruker til databasen.
  if(!rows.length && cleanUsername.toLowerCase()===(process.env.ADMIN_USERNAME||'Admin').toLowerCase() && process.env.ADMIN_PASSWORD===cleanPassword){
    const p=hashPassword(cleanPassword);
    rows=await q`INSERT INTO app_users(username,display_name,role,password_hash,password_salt,is_active)
      VALUES(${process.env.ADMIN_USERNAME||'Admin'},'Admin','admin',${p.hash},${p.salt},true)
      RETURNING id,username,display_name,role,password_hash,password_salt,is_active`;
  }
  const user=rows[0] as any;
  if(!user||!user.is_active||!verifyPassword(cleanPassword,user.password_hash,user.password_salt))return NextResponse.json({error:'Feil brukernavn eller passord.'},{status:401});
  const role=user.role as UserRole;
  await q`UPDATE app_users SET last_login_at=now() WHERE id=${user.id}`;
  await setSessionCookie(await createSession(user.username,role));
  return NextResponse.json({ok:true,username:user.username,displayName:user.display_name,role});
}
