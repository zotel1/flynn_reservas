import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthUrl } from '../lib/google';

export const config = { runtime: 'nodejs20' };

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const url = getAuthUrl();
  res.writeHead(302, { Location: url }).end();
}
