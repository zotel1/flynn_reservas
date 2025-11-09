import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getApisFromEnvTokens } from '../lib/google';

export const config = { runtime: 'nodejs20' };

function parseLocalDateTime(fecha?: string, hora?: string): number {
  if (!fecha) return NaN;
  const [Y, M, D] = fecha.split('-').map(Number);
  let hh = 0, mm = 0;
  if (hora) [hh, mm] = hora.split(':').map(Number);
  return new Date(Y, (M || 1) - 1, D || 1, hh || 0, mm || 0, 0).getTime();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (process.env.RESERVAS_API_KEY && req.headers['x-api-key'] !== process.env.RESERVAS_API_KEY) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    const { sheets } = getApisFromEnvTokens();
    const SHEET_ID = process.env.SHEET_ID!;
    const range = 'Reservas!A:Z';

    const desde = typeof req.query.desde === 'string' ? req.query.desde : '';
    const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : '';
    const q     = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase();
    const order = (typeof req.query.order === 'string' ? req.query.order : 'desc').toLowerCase();
    const page  = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize || '50'), 10)));

    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
    const rows = resp.data.values || [];
    if (!rows.length) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
      return res.status(200).json({ ok: true, count: 0, total: 0, page, pages: 0, items: [] });
    }

    const headers = rows[0];
    const data = rows.slice(1).map(r => {
      const item: Record<string, any> = {};
      headers.forEach((h, i) => item[h] = r[i] ?? '');
      return item;
    });

    const minT = desde ? parseLocalDateTime(desde, '00:00') : -Infinity;
    const maxT = hasta ? parseLocalDateTime(hasta, '23:59') :  Infinity;

    let filtered = data.filter((it: any) => {
      const t = parseLocalDateTime(it.fecha, it.hora);
      const okFecha = isNaN(t) ? true : (t >= minT && t <= maxT);
      const okQ = !q ? true :
        (`${it.nombre} ${it.email} ${it.telefono} ${it.comentario || ''} ${it.sitio || ''}`.toLowerCase().includes(q));
      return okFecha && okQ;
    });

    filtered.sort((a: any, b: any) => {
      const ta = parseLocalDateTime(a.fecha, a.hora);
      const tb = parseLocalDateTime(b.fecha, b.hora);
      const delta = (ta || 0) - (tb || 0);
      return order === 'asc' ? delta : -delta;
    });

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const end   = start + pageSize;

    const items = filtered.slice(start, end).map((r: any) => ({
      timestamp: r.timestamp,
      nombre: r.nombre,
      email: r.email,
      telefono: r.telefono,
      fecha: r.fecha,
      hora: r.hora,
      personas: r.personas,
      sitio: r.sitio || (r.comentario || '').match(/^\[(.*?)\]/)?.[1] || '',
      comentario: r.comentario || '',
      id_evento: r.id_evento || '',
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    return res.status(200).json({ ok: true, count: items.length, total, page, pages, items });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message || 'Error leyendo reservas' });
  }
}
