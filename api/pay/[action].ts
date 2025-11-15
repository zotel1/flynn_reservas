// api/pay/[action].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handlePayConfirm,
  handlePayCreate,
  handlePayWebhook,
} from '../../lib/pay';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const actionParam = Array.isArray(req.query.action)
    ? req.query.action[0]
    : req.query.action;

  const action = (actionParam || '').toString();

  switch (action) {
    case 'confirm':
      return handlePayConfirm(req, res);

    case 'create':
      return handlePayCreate(req, res);

    case 'webhook':
      return handlePayWebhook(req, res);

    default:
      return res.status(404).json({ ok: false, message: 'Not found' });
  }
}
