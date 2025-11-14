import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPayment } from '../../lib/mp';

function extractPaymentId(req: VercelRequest): string | null {
  // Casos comunes:
  // ?type=payment&id=123...   o   ?topic=payment&id=123...
  const q = req.query || {};
  const idQ = String(q.id || '');
  const type = String(q.type || q.topic || '');
  if ((type === 'payment' || type === 'payment.created' || type === 'payment.updated') && idQ) return idQ;

  // body { data: { id: '...' }, type: 'payment' }
  try {
    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const idB = raw?.data?.id || raw?.resource?.id || raw?.id;
    if (idB) return String(idB);
  } catch {}
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const paymentId = extractPaymentId(req);
    if (!paymentId) {
      // Siempre devolver 200 para que MP no reintente infinito,
      // pero logueamos para diagnóstico.
      console.log('MP Webhook sin paymentId', { query: req.query, body: req.body });
      return res.status(200).json({ ok:true });
    }

    // Consultamos el pago (source of truth)
    const p = await getPayment(paymentId);
    console.log('MP Webhook payment', { id: paymentId, status: p?.status, xref: p?.external_reference });

    // TIP: si tuvieras DB, acá marcarías el pago como "approved".
    // En nuestro flujo, confirmamos de nuevo antes de crear la reserva.

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    // Igual devolvemos 200 para no generar tormenta de reintentos
    console.error('MP Webhook error', e?.message);
    return res.status(200).json({ ok: true });
  }
}