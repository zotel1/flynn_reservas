import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getApisFromEnvTokens } from '../lib/google';

export const config = { runtime: 'nodejs20' };

// Util: parsear fecha/hora como "local" (sin depender de TZ del server)
function parseLocalDateTime(fecha?: string, hora?: string): number {
  if (!fecha) return NaN;
  const [Y, M, D] = fecha.split('-').map(Number);
  let hh = 0, mm = 0;
  if (hora) [hh, mm] = hora.split(':').map(Number);
  const d = new Date(Y, (M || 1) - 1, D || 1, hh || 0, mm || 0, 0, 0);
  return d.getTime();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Seguridad simple (opcional)
    const apiKey = req.headers['x-api-key'];
    if (process.env.RESERVAS_API_KEY && apiKey !== process.env.RESERVAS_API_KEY) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    const { sheets } = getApisFromEnvTokens();
    const SHEET_ID = process.env.SHEET_ID!;
    const range = 'Reservas!A:Z';

    // Query params
    const desde = typeof req.query.desde === 'string' ? req.query.desde : '';
    const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : '';
    const q     = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase();
    const order = (typeof req.query.order === 'string' ? req.query.order : 'desc').toLowerCase(); // 'asc' | 'desc'
    const page  = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize || '50'), 10)));

    // Traemos la hoja
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

    // Campos esperados en tu Sheet:
    // timestamp | nombre | email | telefono | fecha | hora | personas | comentario | id_evento | email_status | ip | userAgent | sitio (si lo agregás)
    const idxFecha = headers.indexOf('fecha');
    const idxHora  = headers.indexOf('hora');

    // Filtro fecha
    const minT = desde ? parseLocalDateTime(desde, '00:00') : -Infinity;
    const maxT = hasta ? parseLocalDateTime(hasta, '23:59') :  Infinity;

    let filtered = data.filter((it: any) => {
      const t = parseLocalDateTime(it.fecha, it.hora);
      const okFecha = isNaN(t) ? true : (t >= minT && t <= maxT);
      const hayQ = !!q;
      const okQ = !hayQ
        ? true
        : (`${it.nombre} ${it.email} ${it.telefono} ${it.comentario || ''} ${it.sitio || ''}`.toLowerCase().includes(q));
      return okFecha && okQ;
    });

    // Orden por fecha/hora
    filtered.sort((a: any, b: any) => {
      const ta = parseLocalDateTime(a.fecha, a.hora);
      const tb = parseLocalDateTime(b.fecha, b.hora);
      const delta = (ta || 0) - (tb || 0);
      return order === 'asc' ? delta : -delta;
    });

    // Paginación
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
      comentario: r.comentario || r.notas || '',
      id_evento: r.id_evento || '',
    }));

    // Cache en la CDN de Vercel (reduce consumo de API)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');

    return res.status(200).json({ ok: true, count: items.length, total, page, pages, items });
  } catch (err: any) {
    const msg = err?.message || 'Error leyendo reservas';
    return res.status(500).json({ ok: false, message: msg });
  }
}
