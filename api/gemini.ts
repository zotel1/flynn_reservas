import type { VercelRequest, VercelResponse } from "@vercel/node";

// === Control simple por IP ===
const accessLog: Record<string, { count: number; lastAccess: number }> = {};
const MAX_REQUESTS_PER_DAY = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// === Historial de conversación (últimos 8 mensajes) ===
let conversationHistory: { role: string; parts: { text: string }[] }[] = [];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || "unknown";
    const now = Date.now();

    if (!accessLog[ip]) {
      accessLog[ip] = { count: 1, lastAccess: now };
    } else {
      const elapsed = now - accessLog[ip].lastAccess;
      if (elapsed > ONE_DAY_MS) {
        accessLog[ip] = { count: 1, lastAccess: now };
      } else {
        accessLog[ip].count++;
      }
    }

    if (accessLog[ip].count > MAX_REQUESTS_PER_DAY) {
      return res.status(429).json({
        reply: "🍀 Alcanzaste el límite de conversaciones por hoy. ¡Volvé mañana!",
      });
    }

    const { message, history } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Mensaje vacío o inválido" });
    }

    const GEMINI_API_KEY = process.env["GEMINI_API_KEY"];
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Falta GEMINI_API_KEY en el entorno" });
    }

    // === Prompt del asistente ===
    const systemPrompt = `
Sos Flynn Assistant 🍀, el asistente virtual del Flynn Irish Pub en Posadas, Misiones.
Tu estilo es cálido y cercano, con acento del litoral argentino.
Respondé en tono simpático, breve (máx. 2 frases) y en español.
Si preguntan por reservas, decí que pueden hacerlas desde el sitio web.
Si te preguntan algo fuera del contexto del bar, respondé: "Perdón 🍀, eso no lo sé, pero puedo contarte sobre el bar o sus eventos."
`.trim();

    // === Historial limitado a 8 interacciones ===
    const recentMessages = (history || [])
      .slice(-8)
      .map((m: any) => ({
        role: m.isBot ? "model" : "user",
        parts: [{ text: m.text }],
      }));

    recentMessages.push({ role: "user", parts: [{ text: message }] });
    conversationHistory = [...conversationHistory, ...recentMessages].slice(-8);

    // === Endpoint de Gemini ===
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      contents: [
        { role: "system", parts: [{ text: systemPrompt }] },
        ...conversationHistory,
        { role: "user", parts: [{ text: message }] },
      ],
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error en Gemini:", errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "🍀 No pude generar una respuesta, intentá nuevamente.";

    conversationHistory.push({ role: "model", parts: [{ text: reply }] });
    conversationHistory = conversationHistory.slice(-8);

    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error("🔥 Error interno:", err);
    return res.status(500).json({ error: err.message || "Error interno del servidor" });
  }
}


