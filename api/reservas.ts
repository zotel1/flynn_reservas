import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getApisFromEnvTokens } from '../lib/google';
import { appendReservaRow } from '../lib/sheets';
import { buildEmailRaw } from '../lib/mailer';

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
  try {
    if (req.method !== 'POST') return res.status(405).end();
    // Seguridad simple (opcional)
    if (process.env.RESERVAS_API_KEY && req.headers['x-api-key'] !== process.env.RESERVAS_API_KEY) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

    const { nombre, email, telefono, fecha, hora, personas, comentario, sitio } = parsed.data;
    const { calendar, gmail, sheets } = getApisFromEnvTokens();
    const CALENDAR_ID = process.env.CALENDAR_ID!;
    const SHEET_ID = process.env.SHEET_ID!;
    const encargado = process.env.ENCARGADO_EMAIL!;
    const tz = process.env.TZ || 'America/Argentina/Buenos_Aires';

    // Construir inicio/fin (bloque 1h)
    const start = new Date(`${fecha}T${hora}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    // 1) Calendar
    const ev = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `Reserva: ${nombre} (${personas})`,
        description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${comentario || '-'}`,
        start: { dateTime: start.toISOString(), timeZone: tz },
        end:   { dateTime: end.toISOString(),   timeZone: tz },
      }
    });
    const eventId = ev.data.id;

    // 2) Gmail (cliente + encargado)
    const from = `Flynn Irish Pub <${encargado}>`;
    const subject = `Confirmación de reserva - ${fecha} ${hora}`;
    const htmlCliente = `
      <h2>¡Gracias, ${nombre}!</h2>
      <p>Tu reserva para <strong>${personas}</strong> persona(s) quedó agendada el <strong>${fecha} ${hora}</strong>.</p>
      <p>Sitio: <b>${sitio || '-'}</b></p>
      <p>Si necesitás reprogramar, respondé este correo.</p>
    `;
    const rawCliente   = buildEmailRaw({ from, to: email, subject, html: htmlCliente });
    const rawEncargado = buildEmailRaw({
      from, to: encargado,
      subject: `[Nueva reserva] ${nombre} - ${fecha} ${hora}`,
      html: `<p>Reserva nueva:</p><pre>${JSON.stringify(
        { nombre, email, telefono, fecha, hora, personas, sitio, comentario },
        null, 2
      )}</pre>`
    });

    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: rawCliente }});
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: rawEncargado }});

    // 3) Sheets (append)
    const now = new Date().toISOString();
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
    const ua = String(req.headers['user-agent'] || '');
    await appendReservaRow(sheets, SHEET_ID, [
      now, nombre, email, telefono, fecha, hora, personas, comentario || '', eventId, 'SENT', ip, ua, sitio || ''
    ]);

    // Cache corto para evitar duplicados por doble-submit
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, eventId });
  } catch (err: any) {
    const msg = err?.message || 'Error creando la reserva';
    return res.status(500).json({ ok: false, message: msg });
  }
}
