import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { mockReq, mockRes } from '../lib/test-utils/vercelMock';

async function impoirtHandlerFresh() {
    jest.resetModules(); // Resetea accessLog del módulo
    const mod = await import('./gemini');
    return mod.default;
}

beforeEach(() => {
    // Limpia mocks y env
    jest.restoreAllMocks();
    delete process.env.GEMINI_API_KEY;
});

describe('api/gemini', () => {
    it('GET => 405', async () => {
        const handler = await impoirtHandlerFresh();
        const req = mockReq({ method: 'GET', body: {} });
        const res = mockRes();

        await handler(req, res);
        expect(res._status).toBe(405);
    });

    it('POST sin message => 400', async () => {
        const handler = await impoirtHandlerFresh();
        const req = mockReq({ method: 'POST', body: {} });
        const res = mockRes();

        await handler(req, res);
        expect(res._status).toBe(400);
    });

    it('POST sin GEMINI_API_KEY => 500', async () => {
        const handler = await impoirtHandlerFresh();
        const req = mockReq({
            method: 'POST',
            headers: { 'x-forwarder-for': '1.2.3.4' },
            body: { message: 'hola', history: [] },
            });
            const res = mockRes();

            await handler(req, res);
            expect(res._status).toBe(500);
            expect(res.__json?.error).toContain('GEMINI_API_KEY');
    });

    it('rate limit por IP (11va request) => 429', async () => {
        process.env.GEMINI_API_KEY = 'test';

        // Mock fetch: simula respuesta valida de GEmini
        jest.spyOn(globalThis as any, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => 
                JSON.stringify({
                    candidates: [{ content: { parts: [{ text: 'ok' }] } }],
                }),
        } as any);

        const handler = await impoirtHandlerFresh();

        for (let i = 0; i < 10; i++){
            const req = mockReq({
                method: 'POST',
                headers: { 'x-forwarded-for': '9.9.9.9' },
                body: { message: `hola ${i}`, history: [] },
            });
            const res = mockRes();
            await handler(req, res);
            expect(res._status).toBe(200);
        }

        // 11va
        const req11 = mockReq({
            method: 'POST',
            headers: { 'x-forwarded-for': '9.9.9.9' },
            body: { message: 'hola 11 intento', history: [] },
        });
        const res11 = mockRes();
        await handler(req11, res11);
        expect(res11._status).toBe(429);
        expect(res11.__json?.reply).toContain('limite');
    });

    it('OK => 200 y reply', async () => {
        process.env.GEMINI_API_KEY = 'test';

        jest.spyOn(globalThis as any, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            text: async () =>
                JSON.stringify({
                    candidates: [{ content: { parts: [{ text: 'Hola pibe🍀' }] } }],
                }),
        } as any);

        const handler = await impoirtHandlerFresh();
        const req = mockReq({
            method: 'POST',
            headers: { 'x-forwarded-for': '4.4.4.4' },
            body: { message: 'hola pibe', history: [] },
    });
    const res = mockRes();

    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res.__json?.reply).toBe('Hola pibe🍀');
    });
})