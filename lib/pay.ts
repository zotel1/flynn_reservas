// lib/pay.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createPreference, getPayment, isApproved } from './mp';

//
// === /api/pay/confirm =====================================
//

const confirmSchema = z.object({
  payment_id: z.string().min(3),
});

export async function handlePayConfirm(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, message: 'Method Not Allowed esto es del metodo handlePayConfirm del get' });
    }

    const parsed = confirmSchema.safeParse({ payment_id: req.query.payment_id });
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }

    const { approved, payment } = await isApproved(parsed.data.payment_id);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      approved,
      status: payment?.status,
      xref: payment?.external_reference || null,
      amount: payment?.transaction_amount || null,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, message: e?.message || 'confirm failed' });
  }
}

//
// === /api/pay/create ======================================
//

const createSchema = z.object({
  amount: z.coerce.number().positive().optional(), // si no se envía, toma del env
  email: z.string().email().optional(),            // sugiere payer.email
  xref: z.string().optional(),                     // external_reference opcional
});

export async function handlePayCreate(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res
        .status(405)
        .json({ ok: false, message: 'Method Not Allowed (create debe ser POST)' });
    }

    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }

    const amount =
      parsed.data.amount ?? Number(process.env.RESERVA_DEPOSITO_AMOUNT || 10);

    const { init_point, id, xref } = await createPreference({
      amount,
      xref: parsed.data.xref,
      payerEmail: parsed.data.email,
    });

    res.setHeader('Cache-Control', 'no-store');
    return res
      .status(200)
      .json({ ok: true, init_point, preference_id: id, xref, amount });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, message: e?.message || 'create failed' });
  }
}


//
// === /api/pay/webhook =====================================
//

function extractPaymentId(req: VercelRequest): string | null {
  const q = req.query || {};
  const idQ = String(q.id || '');
  const type = String(q.type || (q as any).topic || '');

  if (
    (type === 'payment' ||
      type === 'payment.created' ||
      type === 'payment.updated') &&
    idQ
  ) {
    return idQ;
  }

  try {
    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const idB = raw?.data?.id || raw?.resource?.id || raw?.id;
    if (idB) return String(idB);
  } catch {}

  return null;
}

export async function handlePayWebhook(req: VercelRequest, res: VercelResponse) {
  try {
    const paymentId = extractPaymentId(req);
    if (!paymentId) {
      console.log('MP Webhook sin paymentId', { query: req.query, body: req.body });
      return res.status(200).json({ ok: true });
    }

    const p = await getPayment(paymentId);
    console.log('MP Webhook payment', {
      id: paymentId,
      status: p?.status,
      xref: p?.external_reference,
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('MP Webhook error', e?.message);
    return res.status(200).json({ ok: true });
  }
}
