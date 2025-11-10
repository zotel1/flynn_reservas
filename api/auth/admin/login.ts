import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OAuth2Client } from 'google-auth-library';
import { createSession, setSessionCookie } from '../../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    }

    const { id_token } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!id_token) return res.status(400).json({ ok: false, message: 'Falta id_token' });

    // Verificamos el ID token usando el mismo CLIENT_ID que configuraste en Google Cloud
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const email = (payload?.email || '').toLowerCase().trim();
    const allowed = (process.env.ENCARGADO_EMAIL || '').toLowerCase().trim();

    if (!payload?.email_verified || email !== allowed) {
      return res.status(401).json({ ok: false, message: 'Email no autorizado' });
    }

    const token = createSession(email);
    setSessionCookie(res, token);

    // Evitamos cachear respuestas de auth
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, email });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || 'login failed' });
  }
}
