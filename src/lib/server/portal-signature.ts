import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Portalens server-til-server-kall er signert som i Fakturakontroll:
 * X-Portal-Signature = base64url(HMAC-SHA256(PORTAL_HANDOFF_SECRET, "portal-users.v1." + timestamp + "." + rå body)),
 * X-Portal-Timestamp i unix-sekunder innen ±5 min.
 */
export function validPortalSignature(secret: string, timestamp: string, body: string, signature: string) {
  const ts = Number(timestamp);
  if (!timestamp || !Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = createHmac('sha256', secret).update(`portal-users.v1.${timestamp}.${body}`).digest();
  let given: Buffer;
  try { given = Buffer.from(signature, 'base64url'); } catch { return false; }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Leser og verifiserer et signert portalkall. Uten hemmelighet finnes ikke endepunktet (404). */
export async function readSignedPortalBody(request: Request): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const secret = process.env.PORTAL_HANDOFF_SECRET;
  if (!secret) return { ok: false, status: 404, error: 'Not found' };
  const raw = await request.text();
  if (!validPortalSignature(secret, request.headers.get('x-portal-timestamp') || '', raw, request.headers.get('x-portal-signature') || ''))
    return { ok: false, status: 401, error: 'Ugyldig eller utløpt signatur fra portalen.' };
  try {
    const body = JSON.parse(raw);
    return body && typeof body === 'object' ? { ok: true, body } : { ok: false, status: 400, error: 'Ugyldig forespørsel.' };
  } catch { return { ok: false, status: 400, error: 'Ugyldig forespørsel.' }; }
}
