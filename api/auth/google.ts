import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthUrl } from '../../lib/google';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const url = getAuthUrl();
    res.writeHead(302, { Location: url }).end();
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message || 'Error generando auth URL' });
  }
}
