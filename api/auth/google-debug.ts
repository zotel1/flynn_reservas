import type { VercelRequest, VercelResponse } from '@vercel/node';
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const env = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID?.slice(0,10) + '…',
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    NODE_ENV: process.env.NODE_ENV,
  };
  return res.status(200).json({ ok: true, env });
}
