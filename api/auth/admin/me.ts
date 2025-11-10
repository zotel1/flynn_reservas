import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionFromReq, verifySession } from '../../../lib/auth';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const token = getSessionFromReq(req);
  const sess = verifySession(token);

  if (!sess) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(401).json({ ok: false });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, email: sess.email });
}
