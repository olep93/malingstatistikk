import { NextResponse } from 'next/server';
import { createSession, setSessionCookie } from '@/lib/server/auth';
export async function POST(req: Request) {
  const { username, password } = await req.json();
  const users = [
    { username: process.env.ADMIN_USERNAME || 'Admin', password: process.env.ADMIN_PASSWORD },
    { username: 'Linn', password: process.env.LINN_PASSWORD || '40857084' }
  ];
  const matched = users.find(user => user.username.toLowerCase() === String(username || '').trim().toLowerCase() && user.password === password);
  if (!matched) return NextResponse.json({ error: 'Feil brukernavn eller passord.' }, { status: 401 });
  await setSessionCookie(await createSession(matched.username));
  return NextResponse.json({ ok: true, username: matched.username });
}
