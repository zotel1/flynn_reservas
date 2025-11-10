// api/admin/reservas.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../lib/auth';
import { getApisFromEnvTokens } from '../../lib/google';

function a1RangeForTab(tabName: string, tailRange = 'A:M') {
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
    nombre:    row[1] || '',
    email:     row[2] || '',
    telefono:  row[3] || '',
    fecha:     row[4] || '',
    hora:      row[5] || '',
    personas:  row[6] ? Number(row[6]) : 0,
    comentario:row[7] || '',
    eventId:   row[8] || '',
    status:    row[9] || '',
    ip:        row[10] || '',
    ua:        row[11] || '',
    sitio:     row[12] || '',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 🔒 Solo el encargado (cookie creada en /api/auth/admin/login)
  if (!requireAdmin(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok:false, message:'Method Not Allowed' });
  }

  try {
    const sid = process.env.SHEET_ID!;
    const tab = (process.env.SHEET_TAB_NAME || 'Reservas').trim();
    const range = a1RangeForTab(tab, 'A:M');

    const { sheets } = getApisFromEnvTokens();
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range });
    const values = resp.data.values || [];

    let items = values
      .filter(r => Array.isArray(r) && r.length && (r as any[]).some(c => String(c||'').trim() !== ''))
      .map(mapRow);

    // Filtros opcionales
    const q = String((req.query as any).q || '').trim().toLowerCase();
    const desde = String((req.query as any).desde || '').trim(); // yyyy-mm-dd
    const hasta = String((req.query as any).hasta || '').trim(); // yyyy-mm-dd

    if (desde || hasta) {
      items = items.filter(r => {
        if (!r.fecha) return false;
        const f = r.fecha!;
        return (!desde || f >= desde) && (!hasta || f <= hasta);
      });
    }
    if (q) {
      items = items.filter(r =>
        `${r.nombre||''} ${r.email||''} ${r.telefono||''} ${r.sitio||''} ${r.comentario||''}`
          .toLowerCase()
          .includes(q)
      );
    }

    // Orden: más recientes primero
    items.sort((a, b) => `${b.fecha||''}T${b.hora||'00:00'}`.localeCompare(`${a.fecha||''}T${a.hora||'00:00'}`));

    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ ok:true, count: items.length, items });
  } catch (e:any) {
    return res.status(500).json({ ok:false, message: e?.message || 'No se pudieron obtener las reservas' });
  }
}
