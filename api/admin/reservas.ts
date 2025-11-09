import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getApisFromEnvTokens } from '../../lib/google';
import { appendReservaRow } from '../../lib/sheets';
import { buildEmailRaw } from '../../lib/mailer';

const schema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  telefono: z.string().optional().default(''),
  fecha: z.string(),
  hora: z.string(),
  personas: z.coerce.number().int().positive(),
  comentario: z.string().optional().default(''),
  sitio: z.string().optional().default(''),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let stage:'env'|'validate'|'calendar'|'gmail'|'sheets'|'init' = 'init';
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok:false, message:'Method Not Allowed' });

    const must = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','GOOGLE_REFRESH_TOKEN','ENCARGADO_EMAIL','SHEET_ID','CALENDAR_ID'];
    const missing = must.filter(k => !process.env[k]);
    if (missing.length) return res.status(500).json({ ok:false, stage:'env', missing });

    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return res.status(400).json({ ok:false, stage:'validate', error: parsed.error.flatten() });

    const { nombre, email, telefono, fecha, hora, personas, comentario, sitio } = parsed.data;
    const { calendar, gmail, sheets } = getApisFromEnvTokens();
    const CALENDAR_ID = process.env.CALENDAR_ID!;
    const SHEET_ID = process.env.SHEET_ID!;
    const fromAddr = process.env.ENCARGADO_EMAIL!;
    const tz = process.env.TZ || 'America/Argentina/Buenos_Aires';

    const start = new Date(`${fecha}T${hora}:00`);
    const end = new Date(start.getTime() + 60*60*1000);

    stage = 'calendar';
    const ev = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `Reserva: ${nombre} (${personas})`,
        description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${comentario || '-'}`,
        start: { dateTime: start.toISOString(), timeZone: tz },
        end:   { dateTime: end.toISOString(),   timeZone: tz },
      }
    });
    const eventId = ev.data.id || '';

    stage = 'gmail';
    const subject = `Confirmación de reserva - ${fecha} ${hora}`;
    const htmlCliente = `<h2>¡Gracias, ${nombre}!</h2><p>Tu reserva para <b>${personas}</b> persona(s) quedó agendada el <b>${fecha} ${hora}</b>.</p><p>Sitio: <b>${sitio || '-'}</b></p>`;
    await gmail.users.messages.send({ userId:'me', requestBody:{ raw: buildEmailRaw({ from: fromAddr, to: email, subject, html: htmlCliente }) } });
    await gmail.users.messages.send({ userId:'me', requestBody:{ raw: buildEmailRaw({
      from: fromAddr, to: fromAddr, subject: `[Nueva reserva] ${nombre} - ${fecha} ${hora}`,
      html: `<pre>${JSON.stringify({ nombre, email, telefono, fecha, hora, personas, sitio, comentario }, null, 2)}</pre>`
    }) } });

    stage = 'sheets';
    const now = new Date().toISOString();
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
    const ua = String(req.headers['user-agent'] || '');
    await appendReservaRow(sheets, SHEET_ID, [ now, nombre, email, telefono, fecha, hora, personas, comentario || '', eventId, 'SENT', ip, ua, sitio || '' ]);

    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ ok:true, eventId });
  } catch (err:any) {
    console.error('RESERVAS_ERROR', { stage, msg: err?.message, raw: err?.response?.data });
    return res.status(500).json({ ok:false, stage, message: err?.response?.data?.error?.message || err?.message || 'Error' });
  }
}
