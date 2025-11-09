import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getApisFromEnvTokens } from '../lib/google';
import { appendReservaRow } from '../lib/sheets';
import { buildEmailRaw } from '../lib/mailer';

// Esquema de validación del payload
const schema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  telefono: z.string().optional().default(''),
  fecha: z.string(),   // yyyy-mm-dd
  hora: z.string(),    // HH:mm
  personas: z.coerce.number().int().positive(),
  comentario: z.string().optional().default(''),
  sitio: z.string().optional().default(''),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let stage: 'init' | 'env' | 'validate' | 'calendar' | 'gmail' | 'sheets' = 'init';

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    }

    // Seguridad simple (opcional) — si definís RESERVAS_API_KEY se exige el header
    if (process.env.RESERVAS_API_KEY && req.headers['x-api-key'] !== process.env.RESERVAS_API_KEY) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    // NEW: chequeo de envs críticas
    const must = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
      'GOOGLE_REFRESH_TOKEN',
      'ENCARGADO_EMAIL',
      'SHEET_ID',
      'CALENDAR_ID'
    ];
    const missing = must.filter(k => !process.env[k]);
    if (missing.length) {
      return res.status(500).json({ ok: false, stage: 'env', message: 'Faltan variables', missing });
    }

    // NEW: parseo robusto por si Vercel entrega el body como string
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, stage: 'validate', error: parsed.error.flatten() });
    }

    const { nombre, email, telefono, fecha, hora, personas, comentario, sitio } = parsed.data;
    const { calendar, gmail, sheets } = getApisFromEnvTokens();

    const CALENDAR_ID = process.env.CALENDAR_ID!;
    const SHEET_ID = process.env.SHEET_ID!;
    const fromAddr = process.env.ENCARGADO_EMAIL!; // NEW: asegurar que coincide con la cuenta OAuth
    const tz = process.env.TZ || 'America/Argentina/Buenos_Aires';

    // NEW: usar fecha/hora "locales" con timeZone (evitamos .toISOString() con Z)
    const startStr = `${fecha}T${hora}:00`;
    const endStr = `${fecha}T${hora}:00`; // base; sumamos una hora abajo
    const start = new Date(`${fecha}T${hora}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const endStrFixed = `${end.toISOString().slice(0, 19)}`; // yyyy-mm-ddTHH:mm:ss (lo ignorará por el tz)

    // 1) Calendar
    stage = 'calendar';
    const ev = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `Reserva: ${nombre} (${personas})`,
        description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${comentario || '-'}`,
        // En Calendar API, si pasás timeZone, podés usar dateTime sin "Z"
        start: { dateTime: startStr, timeZone: tz },          // NEW
        end:   { dateTime: `${fecha}T${end.toTimeString().slice(0,8)}`, timeZone: tz }, // NEW
      }
    });
    const eventId = ev.data.id || '';

    // 2) Gmail (cliente + encargado) — con from = cuenta autorizada
    stage = 'gmail';
    const subject = `Confirmación de reserva - ${fecha} ${hora}`;
    const htmlCliente = `
      <h2>¡Gracias, ${nombre}!</h2>
      <p>Tu reserva para <strong>${personas}</strong> persona(s) quedó agendada el <strong>${fecha} ${hora}</strong>.</p>
      <p>Sitio: <b>${sitio || '-'}</b></p>
      <p>Si necesitás reprogramar, respondé este correo.</p>
    `;

    const rawCliente   = buildEmailRaw({ from: fromAddr, to: email, subject, html: htmlCliente }); // NEW: fromAddr plano
    const rawEncargado = buildEmailRaw({
      from: fromAddr,
      to: fromAddr,
      subject: `[Nueva reserva] ${nombre} - ${fecha} ${hora}`,
      html: `<p>Reserva nueva:</p><pre>${JSON.stringify(
        { nombre, email, telefono, fecha, hora, personas, sitio, comentario },
        null, 2
      )}</pre>`
    });

    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: rawCliente }});
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: rawEncargado }});

    // 3) Sheets (append)
    stage = 'sheets';
    const now = new Date().toISOString();
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
    const ua = String(req.headers['user-agent'] || '');

    // Nota: si tu pestaña se llama "Hoja 1", seteá en Vercel SHEET_TAB_NAME="Hoja 1"
    // y asegurate que appendReservaRow use ese env (ver helper /lib/sheets.ts).
    await appendReservaRow(sheets, SHEET_ID, [
      now, nombre, email, telefono, fecha, hora, personas, comentario || '', eventId, 'SENT', ip, ua, sitio || ''
    ]);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, eventId });
  } catch (err: any) {
    console.error('RESERVAS_ERROR', { stage, msg: err?.message, raw: err?.response?.data });
    const msg = err?.response?.data?.error?.message || err?.message || 'Error creando la reserva';
    return res.status(500).json({ ok: false, stage, message: msg });
  }
}
