import type { sheets_v4 } from 'googleapis';

export async function appendReservaRow(
  sheets: sheets_v4.Sheets, spreadsheetId: string, values: any[]
) {
  const tab = process.env.SHEET_TAB_NAME || 'Reservas'; // ← usa ENV si existe
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] }
  });
}
