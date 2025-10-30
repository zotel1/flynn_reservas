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
Sos Flynn Assistant 🍀, el asistente virtual del Flynn Irish Pub en Posadas, Misiones.
Tu estilo es cálido, cercano y con acento del litoral argentino.
Respondé con tono simpático, como un amigo del bar.
Sé breve (máx. 2 frases) y respondé en español.
Si te preguntan por reservas, decí que pueden hacerlas desde el sitio.
Si te preguntan algo fuera del contexto del bar, respondé: "Perdón 🍀, eso no lo sé, pero puedo contarte sobre el bar o sus eventos."
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
