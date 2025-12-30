import { appendReservaRow } from './sheets';

test('appendReservaRow cita correctamente pestañas con espacios', async () => {
    process.env.SHEET_TAB_NAME = 'Hoja 1';

    const calls: any[] = [];
    const sheetsMock: any = {
        spreadsheets: {
            values: {
                append: async (args: any) => calls.push(args),
            },
        },
    };

    await appendReservaRow(sheetsMock, 'SHEET_ID', ['x']);

    expect(calls[0].range).toBe("'Hoja 1'!A:Z");
});
