import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getApisFromEnvTokens } from './lib/google';

//export const config = { runtime: 'nodejs20' };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
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
    const last7 = rows.slice(1).filter(r => {
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
    return res.status(500).json({ ok: false, message: err?.message || 'Error enviando resumen' });
  }
}
