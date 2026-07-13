import { NextResponse } from 'next/server';
import { createSession, setSessionCookie } from '@/lib/server/auth';
export async function POST(req: Request) {
  const { username, password } = await req.json();
  const expectedUser = process.env.ADMIN_USERNAME || 'Admin';
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedPass) return NextResponse.json({ error: 'ADMIN_PASSWORD mangler i Vercel.' }, { status: 500 });
  if (username !== expectedUser || password !== expectedPass) return NextResponse.json({ error: 'Feil brukernavn eller passord.' }, { status: 401 });
  await setSessionCookie(await createSession());
  return NextResponse.json({ ok: true });
}
