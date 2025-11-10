// api/lib/auth.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const COOKIE_NAME = 'flynn_admin';           // nombre de la cookie
const MAX_AGE_SEC = 60 * 60 * 24 * 7;        // 7 días

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64urlJSON(obj: any) { return b64url(JSON.stringify(obj)); }

function sign(data: string, secret: string) {
  return b64url(crypto.createHmac('sha256', secret).update(data).digest());
}

export function createSession(email: string) {
  const now = Math.floor(Date.now()/1000);
  const payload = { email, iat: now, exp: now + MAX_AGE_SEC };
  const body = b64urlJSON(payload);
  const sig = sign(body, process.env.SESSION_SECRET!);
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined) {
  if (!token || !process.env.SESSION_SECRET) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body, process.env.SESSION_SECRET);
  // timing-safe compare
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const json = Buffer.from(body.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
  const payload = JSON.parse(json);
  if (!payload?.exp || payload.exp < Math.floor(Date.now()/1000)) return null;
  return payload as { email: string; iat: number; exp: number };
}

export function setSessionCookie(res: VercelResponse, token: string) {
  const maxAge = MAX_AGE_SEC;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
}

export function clearSessionCookie(res: VercelResponse) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

export function getSessionFromReq(req: VercelRequest) {
  const raw = String(req.headers.cookie || '');
  const m = raw.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return m ? m[1] : undefined;
}

export function requireAdmin(req: VercelRequest, res: VercelResponse) {
  const token = getSessionFromReq(req);
  const sess = verifySession(token);
  const allowed = (process.env.ENCARGADO_EMAIL || '').toLowerCase().trim();
  if (!sess || (sess.email||'').toLowerCase().trim() !== allowed) {
    res.status(401).json({ ok:false, message:'Unauthorized' });
    return null;
  }
  return sess; // { email, iat, exp }
}
