// lib/admin.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getApisFromEnvTokens, getOAuthClient } from './google';
import { requireAdmin } from './auth';

//
// === /api/admin/diag  =====================================
//
export async function handleAdminDiag(req: VercelRequest, res: VercelResponse) {
  // 🔒 Solo encargado
  if (!requireAdmin(req, res)) return;

  try {
    const missing: string[] = [];
    for (const k of [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
      'GOOGLE_REFRESH_TOKEN',
      'SHEET_ID',
      'CALENDAR_ID',
    ]) {
      if (!process.env[k]) missing.push(k);
    }
    if (missing.length) {
      return res.status(200).json({ ok: false, stage: 'env', missing });
    }

    const { calendar, sheets } = getApisFromEnvTokens();

    const oauth2 = getOAuthClient();
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN! });

    const out: any = { ok: true, checks: {} };

    // Gmail scopes
    try {
      const { token } = await oauth2.getAccessToken();
      if (!token) throw new Error('No se pudo obtener access_token');
      const oauth2info = google.oauth2('v2');
      const info = await oauth2info.tokeninfo({ access_token: token });
      const scopes = (info.data.scope || '').split(' ');
      (out.checks as any).gmail = {
        ok: scopes.includes('https://www.googleapis.com/auth/gmail.send'),
        scopes,
      };
    } catch (e: any) {
      (out.checks as any).gmail = { ok: false, error: e?.message || String(e) };
    }

    // Calendar
    try {
      const id = process.env.CALENDAR_ID!;
      const cl = await calendar.calendarList.list();
      const found = id === 'primary' ? true : !!cl.data.items?.find((c) => c.id === id);
      (out.checks as any).calendar = {
        ok: found,
        id,
        total: cl.data.items?.length || 0,
      };
    } catch (e: any) {
      (out.checks as any).calendar = { ok: false, error: e?.message || String(e) };
    }

    // Sheets
    try {
      const sid = process.env.SHEET_ID!;
      const s = await sheets.spreadsheets.get({ spreadsheetId: sid });
      (out.checks as any).sheets = {
        ok: true,
        sid,
        sheets: s.data.sheets?.map((x) => x.properties?.title),
      };
    } catch (e: any) {
      (out.checks as any).sheets = { ok: false, error: e?.message || String(e) };
    }

    return res.status(200).json(out);
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message || 'diag failed' });
  }
}


// lib/admin.ts  (solo muestro la parte de reservas)

function a1RangeForTab(tabName: string, tailRange = 'A:N') {
  const needsQuotes = /[\s!@#$%^&*()[\]{};:'",.<>/?\\|`~+-]/.test(tabName);
  const safeTab = needsQuotes ? `'${tabName.replace(/'/g, "''")}'` : tabName;
  return `${safeTab}!${tailRange}`;
}


type ReservaItem = {
  timestamp?: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  fecha?: string;
  hora?: string;
  personas?: number;
  comentario?: string;
  eventId?: string;
  status?: string;
  ip?: string;
  ua?: string;
  sitio?: string;
  qr_url?: string;
  checked_in_at?: string;
  checked_in_by?: string;

};



function mapRow(row: any[] = []): ReservaItem {
  return {
    timestamp: row[0] || '',
    nombre:    row[1] || '',
    email:     row[2] || '',
    telefono:  row[3] || '',
    fecha:     row[4] || '',
    hora:      row[5] || '',
    personas:  row[6] ? Number(row[6]) : 0,
    comentario: row[7] || '',
    eventId:   row[8] || '',
    status:    row[9] || '',
    ip:        row[10] || '',
    ua:        row[11] || '',
    sitio:     row[12] || '',
    qr_url:    row[13] || '',
    checked_in_at: row[14] || '',
    checked_in_by: row[15] || '',

  };
}


export async function handleAdminReservas(req: VercelRequest, res: VercelResponse) {
  // 🔒 Solo encargado
  if (!requireAdmin(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  try {
    const sid = process.env.SHEET_ID!;
    const tab = (process.env.SHEET_TAB_NAME || 'Reservas').trim();
    const range = a1RangeForTab(tab, 'A:P'); 

    const { sheets } = getApisFromEnvTokens();
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range });
    const values = resp.data.values || [];

    let items = values
      .filter(
        (r) => Array.isArray(r) && r.length && (r as any[]).some((c) => String(c || '').trim() !== '')
      )
      .map(mapRow);

    // Filtros opcionales
    const q = String((req.query as any).q || '').trim().toLowerCase();
    const desde = String((req.query as any).desde || '').trim(); // yyyy-mm-dd
    const hasta = String((req.query as any).hasta || '').trim(); // yyyy-mm-dd

    if (desde || hasta) {
      items = items.filter((r) => {
        if (!r.fecha) return false;
        const f = r.fecha!;
        return (!desde || f >= desde) && (!hasta || f <= hasta);
      });
    }
    if (q) {
      items = items.filter((r) =>
        `${r.nombre || ''} ${r.email || ''} ${r.telefono || ''} ${r.sitio || ''} ${
          r.comentario || ''
        }`
          .toLowerCase()
          .includes(q)
      );
    }

    // Orden: más recientes primero
    items.sort((a, b) =>
      `${b.fecha || ''}T${b.hora || '00:00'}`.localeCompare(`${a.fecha || ''}T${a.hora || '00:00'}`)
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, count: items.length, items });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, message: e?.message || 'No se pudieron obtener las reservas' });
  }
}


//
// === /api/admin/reservas  =================================
//

/*function a1RangeForTab(tabName: string, tailRange = 'A:M') {
  const needsQuotes = /[\s!@#$%^&*()[\]{};:'",.<>/?\\|`~+-]/.test(tabName);
  const safeTab = needsQuotes ? `'${tabName.replace(/'/g, "''")}'` : tabName;
  return `${safeTab}!${tailRange}`;
} 

type ReservaItem = {
  timestamp?: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  fecha?: string;
  hora?: string;
  personas?: number;
  comentario?: string;
  eventId?: string;
  status?: string;
  ip?: string;
  ua?: string;
  sitio?: string;
};

function mapRow(row: any[] = []): ReservaItem {
  return {
    timestamp: row[0] || '',
    nombre: row[1] || '',
    email: row[2] || '',
    telefono: row[3] || '',
    fecha: row[4] || '',
    hora: row[5] || '',
    personas: row[6] ? Number(row[6]) : 0,
    comentario: row[7] || '',
    eventId: row[8] || '',
    status: row[9] || '',
    ip: row[10] || '',
    ua: row[11] || '',
    sitio: row[12] || '',
  };
}

export async function handleAdminReservas(req: VercelRequest, res: VercelResponse) {
  // 🔒 Solo encargado
  if (!requireAdmin(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  try {
    const sid = process.env.SHEET_ID!;
    const tab = (process.env.SHEET_TAB_NAME || 'Reservas').trim();
    const range = a1RangeForTab(tab, 'A:M');

    const { sheets } = getApisFromEnvTokens();
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range });
    const values = resp.data.values || [];

    let items = values
      .filter(
        (r) => Array.isArray(r) && r.length && (r as any[]).some((c) => String(c || '').trim() !== '')
      )
      .map(mapRow);

    // Filtros opcionales
    const q = String((req.query as any).q || '').trim().toLowerCase();
    const desde = String((req.query as any).desde || '').trim(); // yyyy-mm-dd
    const hasta = String((req.query as any).hasta || '').trim(); // yyyy-mm-dd

    if (desde || hasta) {
      items = items.filter((r) => {
        if (!r.fecha) return false;
        const f = r.fecha!;
        return (!desde || f >= desde) && (!hasta || f <= hasta);
      });
    }
    if (q) {
      items = items.filter((r) =>
        `${r.nombre || ''} ${r.email || ''} ${r.telefono || ''} ${r.sitio || ''} ${
          r.comentario || ''
        }`
          .toLowerCase()
          .includes(q)
      );
    }

    // Orden: más recientes primero
    items.sort((a, b) =>
      `${b.fecha || ''}T${b.hora || '00:00'}`.localeCompare(`${a.fecha || ''}T${a.hora || '00:00'}`)
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, count: items.length, items });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, message: e?.message || 'No se pudieron obtener las reservas' });
  }
}*/

//
// === /api/admin/weekly-summary  ===========================
//

export async function handleWeeklySummary(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;

  try {
    const { gmail, sheets } = getApisFromEnvTokens();
    const SHEET_ID = process.env.SHEET_ID!;
    const encargado = process.env.ENCARGADO_EMAIL!;
    const from = `Flynn Irish Pub <${encargado}>`;

    const range = 'Reservas!A:Z';
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
    const rows = resp.data.values || [];
    if (!rows.length) return res.status(200).json({ ok: true, msg: 'sin datos' });

    const headers = rows[0];
    const idxTs = headers.indexOf('timestamp');
    const idxFecha = headers.indexOf('fecha');
    const idxHora = headers.indexOf('hora');

    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const last7 = rows.slice(1).filter((r) => {
      const t = Date.parse(r[idxTs] || `${r[idxFecha]}T${r[idxHora] || '00:00'}:00`);
      return !isNaN(t) && t >= since;
    });

    const total = last7.length;
    const mapa = new Map<string, number>();
    for (const r of last7) {
      const key = `${r[idxFecha]} ${r[idxHora]}`;
      mapa.set(key, (mapa.get(key) || 0) + 1);
    }
    const lista = [...mapa.entries()].map(([k, v]) => `<li>${k}: ${v}</li>`).join('');
    const html = `<h2>Resumen de reservas (últimos 7 días)</h2><p>Total: <b>${total}</b></p><ul>${lista}</ul>`;

    const raw = Buffer.from(
      `From: ${from}
To: ${encargado}
Subject: Resumen semanal de reservas
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8

${html}`
    ).toString('base64url');

    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    return res.status(200).json({ ok: true, total });
  } catch (err: any) {
    return res
      .status(500)
      .json({ ok: false, message: err?.message || 'Error enviando resumen' });
  }
}



