import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Mensaje vacío o inválido' });
  }

  const GEMINI_API_KEY = process.env["GEMINI_API_KEY"] as string;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Falta GEMINI_API_KEY en el entorno' });
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: message }] }]
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ Error en Gemini:', text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No pude generar una respuesta 🍀';

    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error('🔥 Error interno:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
