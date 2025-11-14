import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isApproved } from '../../lib/mp';

const schema = z.object({
  payment_id: z.string().min(3),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok:false, message:'Method Not Allowed' });
    }

    const parsed = schema.safeParse({ payment_id: req.query.payment_id });
    if (!parsed.success) return res.status(400).json({ ok:false, error: parsed.error.flatten() });

    const { approved, payment } = await isApproved(parsed.data.payment_id);

    // Podés devolver también la xref para atarla a tu reserva
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      approved,
      status: payment?.status,
      xref: payment?.external_reference || null,
      amount: payment?.transaction_amount || null
    });
  } catch (e:any) {
    return res.status(500).json({ ok:false, message: e?.message || 'confirm failed' });
  }
}