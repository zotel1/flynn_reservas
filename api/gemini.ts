import type { VercelRequest, VercelResponse } from '@vercel/node';

// Historial limitado a las últimas 8 interacciones
let conversationHistory: { role: string; parts: { text: string }[] }[] = [];

module.exports = async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Mensaje vacío o inválido' });
  }

  // Permitir reiniciar conversación
  if (message.toLowerCase().includes('reiniciar') || message.toLowerCase().includes('borrar')) {
    conversationHistory = [];
    return res.status(200).json({
      reply: 'Conversación reiniciada 🍀 ¡Empecemos de nuevo!',
    });
  }

  const GEMINI_API_KEY = process.env['GEMINI_API_KEY'] as string | undefined;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Falta GEMINI_API_KEY en el entorno' });
  }

  try {
    // === PERSONALIDAD DEL BOT ===
    const systemPrompt = `
Sos Flynn Assistant 🍀, el asistente virtual del Flynn Irish Pub.
Respondé en español argentino, con tono cálido, misionero e irlandés.
Sé breve (máximo dos frases).
Si te preguntan sobre reservas, recordá que pueden hacerse desde el sitio web.
No respondas preguntas sobre política, religión o temas personales.
Si el usuario pregunta algo fuera del contexto del bar, decí: "Perdón 🍀, eso no lo sé, pero puedo contarte sobre el bar o sus eventos."
Usuario dice: "${message}"
`.trim();

    // Actualizar historial (máx. 8 mensajes)
    const recentMessages = (history || [])
      .slice(-8)
      .map((m: any) => ({
        role: m.isBot ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));

    // Agregar mensaje actual
    recentMessages.push({ role: 'user', parts: [{ text: message }] });
    conversationHistory = [...conversationHistory, ...recentMessages].slice(-8);

    // Endpoint actualizado a Gemini 2.5 Flash
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          ...conversationHistory,
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ Error en Gemini:', text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'No pude generar una respuesta 🍀';

    // Guardar respuesta en historial
    conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
    conversationHistory = conversationHistory.slice(-8);

    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error('🔥 Error interno:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
};



/*import type { VercelRequest, VercelResponse } from '@vercel/node';

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
*/