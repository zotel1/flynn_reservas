import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getApisFromEnvTokens, getOAuthClient } from '../../lib/google';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (process.env.RESERVAS_API_KEY && req.headers['x-api-key'] !== process.env.RESERVAS_API_KEY) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    const missing: string[] = [];
    for (const k of [
      'GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','GOOGLE_REFRESH_TOKEN',
      'SHEET_ID','CALENDAR_ID'
    ]) if (!process.env[k]) missing.push(k);
    if (missing.length) return res.status(200).json({ ok:false, stage:'env', missing });

    // Helpers (gmail no se usa en diag para no pedir gmail.readonly)
    const { calendar, sheets } = getApisFromEnvTokens();

    // oauth2 local para inspeccionar scopes (sin leer el buzón)
    const oauth2 = getOAuthClient();
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN! });

    const out: any = { ok:true, checks:{} };

    // ---- Gmail: validar que el token tenga gmail.send
    try {
      const { token } = await oauth2.getAccessToken();
      if (!token) throw new Error('No se pudo obtener access_token');
      const oauth2info = google.oauth2('v2');
      const info = await oauth2info.tokeninfo({ access_token: token });
      const scopes = (info.data.scope || '').split(' ');
      out.checks.gmail = {
        ok: scopes.includes('https://www.googleapis.com/auth/gmail.send'),
        scopes
      };
    } catch (e:any) {
      out.checks.gmail = { ok:false, error: e?.message || String(e) };
    }

    // ---- Calendar
    try {
      const id = process.env.CALENDAR_ID!;
      const cl = await calendar.calendarList.list();
      const found = id === 'primary' ? true : !!cl.data.items?.find(c => c.id === id);
      out.checks.calendar = { ok: found, id, total: cl.data.items?.length || 0 };
    } catch (e:any) {
      out.checks.calendar = { ok:false, error: e?.message || String(e) };
    }

    // ---- Sheets
    try {
      const sid = process.env.SHEET_ID!;
      const s = await sheets.spreadsheets.get({ spreadsheetId: sid });
      out.checks.sheets = { ok:true, sid, sheets: s.data.sheets?.map(x => x.properties?.title) };
    } catch (e:any) {
      out.checks.sheets = { ok:false, error: e?.message || String(e) };
    }

    return res.status(200).json(out);
  } catch (err:any) {
    return res.status(500).json({ ok:false, message: err?.message || 'diag failed' });
  }
}
