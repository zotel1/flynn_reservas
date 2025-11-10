// api/auth/admin/logout.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSessionCookie } from '../../../lib/auth';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Aceptamos POST; si querés permitir GET para pruebas, podés quitar esta línea
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  // Borra la cookie HttpOnly del admin
  clearSessionCookie(res);

  // Opcional: anti-cache
  res.setHeader('Cache-Control', 'no-store');

  return res.status(200).json({ ok: true, message: 'Sesión cerrada' });
}
