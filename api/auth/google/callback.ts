import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOAuthClient } from '../../lib/google';

//export const config = { runtime: 'nodejs20' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = String(req.query.code || '');
  if (!code) return res.status(400).send('Falta code');
  const oauth2 = getOAuthClient();
  const { tokens } = await oauth2.getToken(code);

  // Copiá el refresh_token y pegalo en Vercel (GOOGLE_REFRESH_TOKEN)
  res.status(200).json({
    ok: true,
    message: 'Copiá GOOGLE_REFRESH_TOKEN desde aquí y guardalo como env var en Vercel.',
    tokens
  });
}
