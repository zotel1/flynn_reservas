import { randomUUID } from 'crypto';

const MP_API = 'https://api.mercadopago.com';

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta env ${name}`);
  return v;
}

export type CreatePreferenceInput = {
  amount: number;
  xref?: string;            // external_reference opcional (si no, generamos)
  title?: string;           // título del ítem
  payerEmail?: string;      // opcional (si lo tenés en el front)
};

export async function mpFetch<T>(
  path: string,
  init: RequestInit = {},
  idemKey?: string
): Promise<T> {
  const token = assertEnv('MP_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(init.headers as Record<string, string> || {})
  };
  if (idemKey) headers['X-Idempotency-Key'] = idemKey;

  const res = await fetch(`${MP_API}${path}`, { ...init, headers });
  const text = await res.text();
  let json: any = undefined;
  try { json = text ? JSON.parse(text) : undefined; } catch {}
  if (!res.ok) {
    const msg = json?.message || json?.error || res.statusText;
    throw new Error(`MP ${path} ${res.status} - ${msg}`);
  }
  return json as T;
}

export async function createPreference(input: CreatePreferenceInput) {
  const base = assertEnv('BASE_URL');
  const successPath = process.env.RESERVA_SUCCESS_PATH || '/reservas?paid=1';
  const failurePath = process.env.RESERVA_FAILURE_PATH || '/reservas?paid=0';
  const pendingPath = process.env.RESERVA_PENDING_PATH || '/reservas?paid=pending';

  const xref = input.xref || `resv_${randomUUID()}`;
  const body = {
    items: [
      {
        title: input.title || (process.env.RESERVA_DESC || 'Seña de reserva Flynn'),
        quantity: 1,
        currency_id: 'ARS',
        unit_price: input.amount
      }
    ],
    payer: input.payerEmail ? { email: input.payerEmail } : undefined,
    external_reference: xref,
    back_urls: {
      success: `${base}${successPath}&xref=${encodeURIComponent(xref)}`,
      failure: `${base}${failurePath}&xref=${encodeURIComponent(xref)}`,
      pending: `${base}${pendingPath}&xref=${encodeURIComponent(xref)}`
    },
    auto_return: 'approved',
    notification_url: `${base}/api/pay/webhook`,
    binary_mode: true,                 // sólo 'approved' o 'rejected' (evita 'pending' en muchos medios)
    statement_descriptor: 'FLYNN BAR'  // cómo se ve en el resumen
  };

  const pref = await mpFetch<any>('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify(body)
  }, `pref_${xref}`);

  return { init_point: pref.init_point as string, id: pref.id as string, xref };
}

export async function getPayment(paymentId: string) {
  return mpFetch<any>(`/v1/payments/${paymentId}`);
}

export async function isApproved(paymentId: string) {
  const p = await getPayment(paymentId);
  return { approved: p?.status === 'approved', payment: p };
}