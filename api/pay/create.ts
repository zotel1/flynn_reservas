import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createPreference } from '../../lib/mp';

const schema = z.object({
  amount: z.coerce.number().positive().optional(), // si no se envía, toma del env
  email: z.string().email().optional(),            // si querés sugerir payer.email
  xref: z.string().optional()                      // si querés fijar un external_reference
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    }

    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return res.status(400).json({ ok:false, error: parsed.error.flatten() });

    const amount = parsed.data.amount ?? Number(process.env.RESERVA_DEPOSITO_AMOUNT || 10);
    const { init_point, id, xref } = await createPreference({
      amount,
      xref: parsed.data.xref,
      payerEmail: parsed.data.email
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, init_point, preference_id: id, xref, amount });
  } catch (e: any) {
    return res.status(500).json({ ok:false, message: e?.message || 'create failed' });
  }
}