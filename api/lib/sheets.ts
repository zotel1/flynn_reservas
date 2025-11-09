// /lib/sheets.ts
import { sheets_v4 } from 'googleapis';

export async function appendReservaRow(
  sheets: sheets_v4.Sheets,
  sheetId: string,
  values: any[]
) {
  return sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Reservas!A:Z',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] }
  });
}
