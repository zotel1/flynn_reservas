import type { sheets_v4 } from 'googleapis';

/**
 * Arma un rango A1 seguro para el nombre de pestaña dado.
 * - Si el nombre tiene espacios o caracteres raros, lo envuelve en comillas simples.
 * - Escapa comillas simples duplicándolas (regla de A1 notation).
 */
function a1RangeForTab(tabName: string, tailRange = 'A:Z') {
  const needsQuotes = /[\s!@#$%^&*()[\]{};:'",.<>/?\\|`~+-]/.test(tabName);
  const safeTab = needsQuotes ? `'${tabName.replace(/'/g, "''")}'` : tabName;
  return `${safeTab}!${tailRange}`;
}

/**
 * Agrega una fila al final de la pestaña configurada.
 * - Usa SHEET_TAB_NAME si está definida; si no, "Reservas".
 * - No pongas comillas en la env; este helper se encarga de citarlas si hace falta.
 */
export async function appendReservaRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  values: any[],
) {
  const tabName = (process.env.SHEET_TAB_NAME || 'Reservas').trim();
  const range = a1RangeForTab(tabName, 'A:Z'); // ej: 'Hoja 1'!A:Z

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}
