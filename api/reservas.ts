/*import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getApisFromEnvTokens } from '../lib/google';
import { appendReservaRow } from '../lib/sheets';
import { buildEmailRaw } from '../lib/mailer';

// Helpers de fecha
const pad = (n: number) => String(n).padStart(2, '0');
function addHours(fecha: string, horaHHmm: string, deltaH: number) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [H, M] = horaHHmm.split(':').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, H, M, 0));
  base.setUTCHours(base.getUTCHours() + deltaH);
  const yy = base.getUTCFullYear();
  const mm = pad(base.getUTCMonth() + 1);
  const dd = pad(base.getUTCDate());
  const HH = pad(base.getUTCHours());
  const MM = pad(base.getUTCMinutes());
  return { fecha: `${yy}-${mm}-${dd}`, horaSS: `${HH}:${MM}:00` };
}

// Validación payload
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

    // Seguridad opcional
    if (process.env.RESERVAS_API_KEY && req.headers['x-api-key'] !== process.env.RESERVAS_API_KEY) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    // Envs críticas
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

    // Body
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

    // ✅ NUEVO: variables de zona horaria sin usar "TZ" (reservada)
    // RESERVAS_TZ (opcional): ej. "America/Argentina/Buenos_Aires"
    // FORCE_TZ_OFFSET (opcional): ej. "-03:00" (Argentina, sin DST)
    const tz = (process.env.RESERVAS_TZ || '').trim();         // si viene vacío, usamos offset
    const offset = (process.env.FORCE_TZ_OFFSET || '-03:00').trim();
    const useOffset = tz.length === 0;

    // Construcción de horarios locales
    const startLocal = `${fecha}T${hora}:00`;
    const end = addHours(fecha, hora, 1);
    const endLocal = `${end.fecha}T${end.horaSS}`;

    // 1) Calendar
    stage = 'calendar';
    let eventId = '';
    try {
      if (!useOffset) {
        // Intento 1: usar IANA timeZone si definiste RESERVAS_TZ
        const ev = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: {
            summary: `Reserva: ${nombre} (${personas})`,
            description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${comentario || '-'}`,
            start: { dateTime: startLocal, timeZone: tz },     // ← usa IANA
            end:   { dateTime: endLocal,   timeZone: tz },
          }
        });
        eventId = ev.data.id || '';
      } else {
        // Intento directo con offset si no hay RESERVAS_TZ
        const ev = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: {
            summary: `Reserva: ${nombre} (${personas})`,
            description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${comentario || '-'}`,
            start: { dateTime: `${startLocal}${offset}` },     // ← RFC3339 con offset
            end:   { dateTime: `${endLocal}${offset}` },
          }
        });
        eventId = ev.data.id || '';
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '';
      // Fallback: si falla por TZ inválida, reintenta con offset
      if (/Invalid time zone/i.test(msg)) {
        const ev2 = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: {
            summary: `Reserva: ${nombre} (${personas})`,
            description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${comentario || '-'}`,
            start: { dateTime: `${startLocal}${offset}` },   // sin timeZone
            end:   { dateTime: `${endLocal}${offset}` },
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


// api/reservas.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getApisFromEnvTokens } from '../lib/google';
import { appendReservaRow } from '../lib/sheets';
import { buildEmailRaw } from '../lib/mailer';

// Helpers de fecha
const pad = (n: number) => String(n).padStart(2, '0');
function addHours(fecha: string, horaHHmm: string, deltaH: number) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [H, M] = horaHHmm.split(':').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, H, M, 0));
  base.setUTCHours(base.getUTCHours() + deltaH);
  const yy = base.getUTCFullYear();
  const mm = pad(base.getUTCMonth() + 1);
  const dd = pad(base.getUTCDate());
  const HH = pad(base.getUTCHours());
  const MM = pad(base.getUTCMinutes());
  return { fecha: `${yy}-${mm}-${dd}`, horaSS: `${HH}:${MM}:00` };
}

// Validación payload
const schema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  telefono: z.string().optional().default(''),
  fecha: z.string(),   // yyyy-mm-dd
  hora: z.string(),    // HH:mm
  personas: z.coerce.number().int().positive(),
  comentario: z.string().optional().default(''),
  sitio: z.string().optional().default(''),
  // viene del front para vincular seña ↔ reserva
  pay_ref: z.string().optional().default(''),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let stage: 'init' | 'env' | 'validate' | 'calendar' | 'gmail' | 'sheets' = 'init';

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    }

    // Seguridad opcional
    if (process.env.RESERVAS_API_KEY && req.headers['x-api-key'] !== process.env.RESERVAS_API_KEY) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    // Envs críticas
    const must = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
      'GOOGLE_REFRESH_TOKEN',
      'ENCARGADO_EMAIL',
      'SHEET_ID',
      'CALENDAR_ID',
    ];
    const missing = must.filter((k) => !process.env[k]);
    if (missing.length) {
      return res
        .status(500)
        .json({ ok: false, stage: 'env', message: 'Faltan variables', missing });
    }

    // Body
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ ok: false, stage: 'validate', error: parsed.error.flatten() });
    }

    const { nombre, email, telefono, fecha, hora, personas, comentario, sitio, pay_ref } =
      parsed.data;

    const { calendar, gmail, sheets } = getApisFromEnvTokens();

    const CALENDAR_ID = process.env.CALENDAR_ID!;
    const SHEET_ID = process.env.SHEET_ID!;
    const fromAddr = process.env.ENCARGADO_EMAIL!;

    // ✅ Config de horario
    const tz = (process.env.RESERVAS_TZ || '').trim(); // ej. "America/Argentina/Buenos_Aires"
    const offset = (process.env.FORCE_TZ_OFFSET || '-03:00').trim();
    const useOffset = tz.length === 0;

    // Horarios locales
    const startLocal = `${fecha}T${hora}:00`;
    const end = addHours(fecha, hora, 1);
    const endLocal = `${end.fecha}T${end.horaSS}`;

    // ✅ Construir payload de QR (mismo para mail y Google Sheets)
    const qrPayload = [
      'Reserva Flynn Irish Pub',
      `Nombre: ${nombre}`,
      `Email: ${email}`,
      `Fecha: ${fecha}`,
      `Hora: ${hora}`,
      `Personas: ${personas}`,
      sitio ? `Sitio: ${sitio}` : '',
      telefono ? `Teléfono: ${telefono}` : '',
      pay_ref ? `Ref: ${pay_ref}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const qrBase = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=';
    const qrUrl = `${qrBase}${encodeURIComponent(qrPayload)}`;

    // 1) Calendar
    stage = 'calendar';
    let eventId = '';
    try {
      if (!useOffset) {
        // Con IANA timeZone si definiste RESERVAS_TZ
        const ev = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: {
            summary: `Reserva: ${nombre} (${personas})`,
            description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${
              comentario || '-'
            }`,
            start: { dateTime: startLocal, timeZone: tz },
            end: { dateTime: endLocal, timeZone: tz },
          },
        });
        eventId = ev.data.id || '';
      } else {
        // Con offset directo
        const ev = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: {
            summary: `Reserva: ${nombre} (${personas})`,
            description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${
              comentario || '-'
            }`,
            start: { dateTime: `${startLocal}${offset}` },
            end: { dateTime: `${endLocal}${offset}` },
          },
        });
        eventId = ev.data.id || '';
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '';
      if (/Invalid time zone/i.test(msg)) {
        const ev2 = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: {
            summary: `Reserva: ${nombre} (${personas})`,
            description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${
              comentario || '-'
            }`,
            start: { dateTime: `${startLocal}${offset}` },
            end: { dateTime: `${endLocal}${offset}` },
          },
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
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background:#030806; color:#f8f5e9;">
        <h1 style="margin:0 0 8px;font-size:24px;color:#f7b55a;">Flynn Irish Pub 🍀</h1>
        <p style="margin:0 0 24px;color:#d0c7b5;font-size:14px;">Confirmación de reserva</p>

        <h2 style="margin:0 0 12px;font-size:20px;">¡Gracias, ${nombre}!</h2>
        <p style="margin:0 0 8px;">Tu reserva quedó confirmada.</p>

        <div style="margin:16px 0 20px;padding:12px 16px;border-radius:8px;background:#111a14;border:1px solid #26412b;">
          <p style="margin:0 0 4px;"><b>Fecha:</b> ${fecha}</p>
          <p style="margin:0 0 4px;"><b>Hora:</b> ${hora}</p>
          <p style="margin:0 0 4px;"><b>Personas:</b> ${personas}</p>
          <p style="margin:0 0 4px;"><b>Sitio:</b> ${sitio || '-'}</p>
          ${
            comentario
              ? `<p style="margin:0 0 4px;"><b>Notas:</b> ${comentario}</p>`
              : ''
          }
        </div>

        <div style="text-align:center;margin:24px 0;">
          <p style="margin:0 0 8px;">Mostrá este código QR al llegar al bar:</p>
          <img src="${qrUrl}" alt="QR de tu reserva" style="max-width:220px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.45);" />
        </div>

        <p style="margin:0 0 8px;font-size:13px;color:#d0c7b5;">
          Si necesitás reprogramar o cancelar, respondé este correo y el equipo de Flynn te va a ayudar.
        </p>

        <p style="margin:16px 0 0;font-size:12px;color:#8d8677;">
          Flynn Irish Pub · Esta reserva es válida sólo para la fecha y hora indicadas.
        </p>
      </div>
    `;

    const htmlEncargado = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width:520px; padding:16px;">
        <h2 style="margin:0 0 8px;">Nueva reserva recibida 🍀</h2>
        <ul style="margin:0 0 16px; padding-left:18px;">
          <li><b>Nombre:</b> ${nombre}</li>
          <li><b>Email:</b> ${email}</li>
          <li><b>Teléfono:</b> ${telefono || '-'}</li>
          <li><b>Fecha:</b> ${fecha}</li>
          <li><b>Hora:</b> ${hora}</li>
          <li><b>Personas:</b> ${personas}</li>
          <li><b>Sitio:</b> ${sitio || '-'}</li>
          ${pay_ref ? `<li><b>Ref. pago:</b> ${pay_ref}</li>` : ''}
        </ul>
        <p style="margin:0 0 8px;">QR de check-in:</p>
        <img src="${qrUrl}" alt="QR reserva" style="max-width:200px;border-radius:6px;" />
      </div>
    `;

    const rawCliente = buildEmailRaw({
      from: fromAddr,
      to: email,
      subject,
      html: htmlCliente,
    });
    const rawEncargado = buildEmailRaw({
      from: fromAddr,
      to: fromAddr,
      subject: `[Nueva reserva] ${nombre} - ${fecha} ${hora}`,
      html: htmlEncargado,
    });

    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: rawCliente } });
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: rawEncargado } });

    // 3) Sheets (append) — ahora con qr_url al final
    stage = 'sheets';
    const now = new Date().toISOString();
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
    const ua = String(req.headers['user-agent'] || '');

    await appendReservaRow(sheets, SHEET_ID, [
      now,
      nombre,
      email,
      telefono,
      fecha,
      hora,
      personas,
      comentario || '',
      eventId,
      'SENT',
      ip,
      ua,
      sitio || '',
      qrUrl, // 👈 NUEVA COLUMNA: qr_url
    ]);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, eventId, qrUrl });
  } catch (err: any) {
    console.error('RESERVAS_ERROR', { stage, msg: err?.message, raw: err?.response?.data });
    const msg =
      err?.response?.data?.error?.message || err?.message || 'Error creando la reserva';
    return res.status(500).json({ ok: false, stage, message: msg });
  }
}
*/

// api/reservas.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getApisFromEnvTokens } from '../lib/google';
import { appendReservaRow } from '../lib/sheets';
import { buildEmailRaw } from '../lib/mailer';

// Helpers de fecha
const pad = (n: number) => String(n).padStart(2, '0');
function addHours(fecha: string, horaHHmm: string, deltaH: number) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [H, M] = horaHHmm.split(':').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, H, M, 0));
  base.setUTCHours(base.getUTCHours() + deltaH);
  const yy = base.getUTCFullYear();
  const mm = pad(base.getUTCMonth() + 1);
  const dd = pad(base.getUTCDate());
  const HH = pad(base.getUTCHours());
  const MM = pad(base.getUTCMinutes());
  return { fecha: `${yy}-${mm}-${dd}`, horaSS: `${HH}:${MM}:00` };
}

// Validación payload
const schema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  telefono: z.string().optional().default(''),
  fecha: z.string(),   // yyyy-mm-dd
  hora: z.string(),    // HH:mm
  personas: z.coerce.number().int().positive(),
  comentario: z.string().optional().default(''),
  sitio: z.string().optional().default(''),
  // viene del front para vincular seña ↔ reserva
  pay_ref: z.string().optional().default(''),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let stage: 'init' | 'env' | 'validate' | 'calendar' | 'gmail' | 'sheets' = 'init';

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    }

    // Seguridad opcional
    if (process.env.RESERVAS_API_KEY && req.headers['x-api-key'] !== process.env.RESERVAS_API_KEY) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    // Envs críticas
    const must = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
      'GOOGLE_REFRESH_TOKEN',
      'ENCARGADO_EMAIL',
      'SHEET_ID',
      'CALENDAR_ID',
    ];
    const missing = must.filter((k) => !process.env[k]);
    if (missing.length) {
      return res
        .status(500)
        .json({ ok: false, stage: 'env', message: 'Faltan variables', missing });
    }

    // Body
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ ok: false, stage: 'validate', error: parsed.error.flatten() });
    }

    const {
      nombre,
      email,
      telefono,
      fecha,
      hora,
      personas,
      comentario,
      sitio,
      pay_ref,
    } = parsed.data;

    const { calendar, gmail, sheets } = getApisFromEnvTokens();

    const CALENDAR_ID = process.env.CALENDAR_ID!;
    const SHEET_ID = process.env.SHEET_ID!;
    const fromAddr = process.env.ENCARGADO_EMAIL!;

    // ✅ Config de horario
    const tz = (process.env.RESERVAS_TZ || '').trim(); // ej. "America/Argentina/Buenos_Aires"
    const offset = (process.env.FORCE_TZ_OFFSET || '-03:00').trim();
    const useOffset = tz.length === 0;

    // Horarios locales
    const startLocal = `${fecha}T${hora}:00`;
    const end = addHours(fecha, hora, 1);
    const endLocal = `${end.fecha}T${end.horaSS}`;

    // ✅ Payload del QR en JSON (ideal para escáner)
    const qrPayloadObj = {
      type: 'flynn-reserva',
      v: 1,
      fecha,
      hora,
      nombre,
      email,
      personas,
      sitio,
      telefono,
      pay_ref,
    };
    const qrPayload = JSON.stringify(qrPayloadObj);
    const qrBase = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=';
    const qrUrl = `${qrBase}${encodeURIComponent(qrPayload)}`;

    // 1) Calendar
    stage = 'calendar';
    let eventId = '';
    try {
      if (!useOffset) {
        // Con IANA timeZone si definiste RESERVAS_TZ
        const ev = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: {
            summary: `Reserva: ${nombre} (${personas})`,
            description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${
              comentario || '-'
            }`,
            start: { dateTime: startLocal, timeZone: tz },
            end: { dateTime: endLocal, timeZone: tz },
          },
        });
        eventId = ev.data.id || '';
      } else {
        // Con offset directo
        const ev = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: {
            summary: `Reserva: ${nombre} (${personas})`,
            description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${
              comentario || '-'
            }`,
            start: { dateTime: `${startLocal}${offset}` },
            end: { dateTime: `${endLocal}${offset}` },
          },
        });
        eventId = ev.data.id || '';
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '';
      if (/Invalid time zone/i.test(msg)) {
        const ev2 = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: {
            summary: `Reserva: ${nombre} (${personas})`,
            description: `Sitio: ${sitio}\nTel: ${telefono}\nEmail: ${email}\nNotas: ${
              comentario || '-'
            }`,
            start: { dateTime: `${startLocal}${offset}` },
            end: { dateTime: `${endLocal}${offset}` },
          },
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
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background:#030806; color:#f8f5e9;">
        <h1 style="margin:0 0 8px;font-size:24px;color:#f7b55a;">Flynn Irish Pub 🍀</h1>
        <p style="margin:0 0 24px;color:#d0c7b5;font-size:14px;">Confirmación de reserva</p>

        <h2 style="margin:0 0 12px;font-size:20px;">¡Gracias, ${nombre}!</h2>
        <p style="margin:0 0 8px;">Tu reserva quedó confirmada.</p>

        <div style="margin:16px 0 20px;padding:12px 16px;border-radius:8px;background:#111a14;border:1px solid #26412b;">
          <p style="margin:0 0 4px;"><b>Fecha:</b> ${fecha}</p>
          <p style="margin:0 0 4px;"><b>Hora:</b> ${hora}</p>
          <p style="margin:0 0 4px;"><b>Personas:</b> ${personas}</p>
          <p style="margin:0 0 4px;"><b>Sitio:</b> ${sitio || '-'}</p>
          ${
            comentario
              ? `<p style="margin:0 0 4px;"><b>Notas:</b> ${comentario}</p>`
              : ''
          }
        </div>

        <div style="text-align:center;margin:24px 0;">
          <p style="margin:0 0 8px;">Mostrá este código QR al llegar al bar:</p>
          <img src="${qrUrl}" alt="QR de tu reserva" style="max-width:220px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.45);" />
        </div>

        <p style="margin:0 0 8px;font-size:13px;color:#d0c7b5;">
          Si necesitás reprogramar o cancelar, respondé este correo y el equipo de Flynn te va a ayudar.
        </p>

        <p style="margin:16px 0 0;font-size:12px;color:#8d8677;">
          Flynn Irish Pub · Esta reserva es válida sólo para la fecha y hora indicadas.
        </p>
      </div>
    `;

    const htmlEncargado = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width:520px; padding:16px;">
        <h2 style="margin:0 0 8px;">Nueva reserva recibida 🍀</h2>
        <ul style="margin:0 0 16px; padding-left:18px;">
          <li><b>Nombre:</b> ${nombre}</li>
          <li><b>Email:</b> ${email}</li>
          <li><b>Teléfono:</b> ${telefono || '-'}</li>
          <li><b>Fecha:</b> ${fecha}</li>
          <li><b>Hora:</b> ${hora}</li>
          <li><b>Personas:</b> ${personas}</li>
          <li><b>Sitio:</b> ${sitio || '-'}</li>
          ${pay_ref ? `<li><b>Ref. pago:</b> ${pay_ref}</li>` : ''}
        </ul>
        <p style="margin:0 0 8px;">QR de check-in:</p>
        <img src="${qrUrl}" alt="QR reserva" style="max-width:200px;border-radius:6px;" />
      </div>
    `;

    const rawCliente = buildEmailRaw({
      from: fromAddr,
      to: email,
      subject,
      html: htmlCliente,
    });
    const rawEncargado = buildEmailRaw({
      from: fromAddr,
      to: fromAddr,
      subject: `[Nueva reserva] ${nombre} - ${fecha} ${hora}`,
      html: htmlEncargado,
    });

    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: rawCliente } });
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: rawEncargado } });

    // 3) Sheets (append) — ahora con qr_url al final
    stage = 'sheets';
    const now = new Date().toISOString();
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
    const ua = String(req.headers['user-agent'] || '');

    await appendReservaRow(sheets, SHEET_ID, [
      now,
      nombre,
      email,
      telefono,
      fecha,
      hora,
      personas,
      comentario || '',
      eventId,
      'SENT',
      ip,
      ua,
      sitio || '',
      qrUrl, // 👈 NUEVA COLUMNA: qr_url
    ]);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, eventId, qrUrl });
  } catch (err: any) {
    console.error('RESERVAS_ERROR', { stage, msg: err?.message, raw: err?.response?.data });
    const msg =
      err?.response?.data?.error?.message || err?.message || 'Error creando la reserva';
    return res.status(500).json({ ok: false, stage, message: msg });
  }
}
