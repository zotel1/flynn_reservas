import type { VercelRequest, VercelResponse } from "@vercel/node";

export function mockReq(partial: Partial<VercelRequest>): VercelRequest {
    return partial as unknown as VercelRequest;
}

export function mockRes() {
    const res: any = {};
    res._status = 200;
    res.__json = undefined;
    res._headers = {};

    res.status = (code: number) => { res._status = code; return res; };
    res.json = (obj: any) => { res.__json = obj; return res; };
    res.setHeader = (key: string, value: string) => { res._headers[key] = value; return res; };

    return res as VercelResponse & { _status: number; __json: any; _headers: Record<string, any> };
}