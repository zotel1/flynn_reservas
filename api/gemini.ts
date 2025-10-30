import type { VercelRequest, VercelResponse } from '@vercel/node';

// === Registro simple en memoria para limitar accesos ===
const accessLog: Record<string, { count: number; lastAccess: number }> = {};
const MAX_REQUESTS_PER_DAY = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// === Historial limitado a las últimas 8 interacciones ===
let conversationHistory: { role: string; parts: { text: string }[] }[] = [];

module.exports = async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // === Lógica de conteo por IP ===
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown';
  const now = Date.now();

  if (!accessLog[ip]) {
    accessLog[ip] = { count: 1, lastAccess: now };
  } else {
    const elapsed = now - accessLog[ip].lastAccess;
    if (elapsed > ONE_DAY_MS) {
      // Reinicia cada 24h
      accessLog[ip] = { count: 1, lastAccess: now };
    } else {
      accessLog[ip].count++;
    }
  }

  if (accessLog[ip].count > MAX_REQUESTS_PER_DAY) {
    return res.status(429).json({
      reply: '🍀 Alcanzaste el límite de conversaciones por hoy. ¡Volvé mañana para seguir charlando!',
    });
  }

  // === Validaciones generales ===
  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Mensaje vacío o inválido' });
  }

  // Reiniciar conversación
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
    // === Personalidad del bot ===
    const systemPrompt = `
Sos Flynn Assistant 🍀, el asistente virtual del Flynn Irish Pub en Posadas, Misiones.
Tu estilo es cálido, cercano y con acento del litoral argentino.
Respondé con tono simpático, como un amigo del bar.
Sé breve (máx. 2 frases) y respondé en español.
Si te preguntan por reservas, decí que pueden hacerlas desde el sitio.
Si te preguntan algo fuera del contexto del bar, respondé: "Perdón 🍀, eso no lo sé, pero puedo contarte sobre el bar o sus eventos."
Usuario dice: "${message}"
`.trim();

    // === Historial limitado (máx. 8 mensajes) ===
    const recentMessages = (history || [])
      .slice(-8)
      .map((m: any) => ({
        role: m.isBot ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));

    // Agregar mensaje actual
    recentMessages.push({ role: 'user', parts: [{ text: message }] });
    conversationHistory = [...conversationHistory, ...recentMessages].slice(-8);

    // === Endpoint de Gemini 2.5 Flash ===
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
    return res.status(500).json({
      error: err.message || 'Error interno del servidor',
    });
  }
};
