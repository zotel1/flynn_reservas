import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOAuthClient } from '../../../lib/google';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Validar envs mínimas
    const miss: string[] = [];
    if (!process.env.GOOGLE_CLIENT_ID) miss.push('GOOGLE_CLIENT_ID');
    if (!process.env.GOOGLE_CLIENT_SECRET) miss.push('GOOGLE_CLIENT_SECRET');
    if (!process.env.GOOGLE_REDIRECT_URI) miss.push('GOOGLE_REDIRECT_URI');
    if (miss.length) {
      return res.status(500).json({ ok: false, stage: 'env', message: 'Faltan variables', missing: miss });
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      return res.status(400).json({ ok: false, stage: 'callback', message: 'Falta parámetro "code"', query: req.query });
    }

    const oauth2 = getOAuthClient();
    const { tokens } = await oauth2.getToken(code);

    // Mostrar todo para copiar el refresh_token
    return res.status(200).json({
      ok: true,
      hint: 'Copiá GOOGLE_REFRESH_TOKEN y guardalo en Vercel',
      tokens
    });
  } catch (err: any) {
    console.error('OAUTH_CALLBACK_ERROR', err?.response?.data || err?.message || err);
    // Mensaje útil
    return res.status(500).json({
      ok: false,
      stage: 'oauth',
      message: err?.response?.data?.error_description || err?.message || 'OAuth getToken falló',
      tips: [
        'Verificá que GOOGLE_REDIRECT_URI coincida EXACTO con el permitido en Google Cloud',
        'Revisá que esta misma URL esté en "URIs de redirección autorizadas"',
        'Si ya autorizaste antes, revocá el acceso en https://myaccount.google.com/permissions y repetí',
        'En la pantalla previa, tocá "Continuar" (app en prueba) y aceptá los scopes',
      ]
    });
  }
}
