import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getApisFromEnvTokens } from '../lib/google';
import { appendReservaRow } from '../lib/sheets';
import { buildEmailRaw } from '../lib/mailer';

// -------- Helpers de fecha (evitamos toISOString con "Z") --------
// NEW: pad a 2 dígitos
const pad = (n: number) => String(n).padStart(2, '0');

// NEW: suma horas sobre fecha/hora "naive" y devuelve { fecha, horaSS }
function addHours(fecha: string, horaHHmm: string, deltaH: number) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [H, M] = horaHHmm.split(':').map(Number);
  // Usamos UTC como base para no involucrar timezone del runtime
  const base = new Date(Date.UTC(y, m - 1, d, H, M, 0));
  base.setUTCHours(base.getUTCHours() + deltaH);
  const yy = base.getUTCFullYear();
  const mm = pad(base.getUTCMonth() + 1);
  const dd = pad(base.getUTCDate());
  const HH = pad(base.getUTCHours());
  const MM = pad(base.getUTCMinutes());
  return { fecha: `${yy}-${mm}-${dd}`, horaSS: `${HH}:${MM}:00` };
}

// -------- Validación payload --------
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

    // Seguridad simple (opcional)
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

    // NEW: parse robusto del body
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, stage: 'validate', error: parsed.error.flatten() });
    }

    const { nombre, email, telefono, fecha, hora, personas, comentario, sitio } = parsed.data;
    const { calendar, gmail, sheets } = getApisFromEnvTokens();

    const CALENDAR_ID = process.env.CALENDAR_ID!;
    const SHEET_ID = process.env.SHEET_ID!;
    const fromAddr = process.env.ENCARGADO_EMAIL!;
    // FIX: sanitizamos TZ y default válido IANA
    const tz = (process.env.TZ || 'America/Argentina/Buenos_Aires').trim();

    // --- Construcción de horarios ---
    // Enviamos "dateTime" sin Z + "timeZone" IANA (forma recomendada por Calendar)
    const startLocal = `${fecha}T${hora}:00`;
    const end = addHours(fecha, hora, 1);
    const endLocal = `${end.fecha}T${end.horaSS}`;

    // 1) Calendar
    stage = 'calendar';
    let eventId = '';
    try {
      const ev = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: {
          summary: `Reserva: ${nombre} (${personas})`,
          description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${comentario || '-'}`,
          // FIX: usamos timeZone IANA + dateTime local (sin "Z")
          start: { dateTime: startLocal, timeZone: tz },
          end:   { dateTime: endLocal,   timeZone: tz },
        }
      });
      eventId = ev.data.id || '';
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '';
      // NEW: Fallback si Google rechaza la TZ: usamos offset fijo de ART (-03:00) sin timeZone
      if (/Invalid time zone/i.test(msg)) {
        const offset = process.env.FORCE_TZ_OFFSET || '-03:00'; // Argentina
        const ev2 = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: {
            summary: `Reserva: ${nombre} (${personas})`,
            description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${comentario || '-'}`,
            start: { dateTime: `${startLocal}${offset}` }, // sin timeZone
            end:   { dateTime: `${endLocal}${offset}` },   // sin timeZone
          }
        });
        eventId = ev2.data.id || '';
      } else {
        throw e;
      }
    }

    // 2) Gmail (cliente + encargado)
    stage = 'gmail';
    const subject = `Confirmación de reserva - ${fecha} ${hora}`;
    const htmlCliente = `
      <h2>¡Gracias, ${nombre}!</h2>
      <p>Tu reserva para <strong>${personas}</strong> persona(s) quedó agendada el <strong>${fecha} ${hora}</strong>.</p>
      <p>Sitio: <b>${sitio || '-'}</b></p>
      <p>Si necesitás reprogramar, respondé este correo.</p>
    `;
    const rawCliente   = buildEmailRaw({ from: fromAddr, to: email,   subject, html: htmlCliente });
    const rawEncargado = buildEmailRaw({
      from: fromAddr, to: fromAddr,
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
