// api/admin/[action].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleAdminDiag,
  handleAdminReservas,
  handleWeeklySummary,
  handleAdminCheckin
} from '../../lib/admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const actionParam = Array.isArray(req.query.action)
    ? req.query.action[0]
    : req.query.action;

  const action = (actionParam || '').toString();

  switch (action) {
    case 'diag':
      return handleAdminDiag(req, res);

    case 'reservas':
      return handleAdminReservas(req, res);

    case 'weekly-summary':
      return handleWeeklySummary(req, res);
    
    case 'checkin':
      return handleAdminCheckin(req, res);

    default:
      return res.status(404).json({ ok: false, message: 'Not found' });
  }
}
