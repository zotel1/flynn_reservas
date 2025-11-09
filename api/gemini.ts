import type { VercelRequest, VercelResponse } from "@vercel/node";
import "dotenv/config";

// === Control simple por IP ===
const accessLog: Record<string, { count: number; lastAccess: number }> = {};
const MAX_REQUESTS_PER_DAY = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// === Historial de conversación (últimos 8 mensajes) ===
let conversationHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("📥 [Gemini] Nueva solicitud recibida:", req.method);
  console.log("📦 [Gemini] Body:", req.body);

  try {
    // === Validación método HTTP ===
    if (req.method !== "POST") {
      console.warn("⚠️ [Gemini] Método no permitido:", req.method);
      return res.status(405).json({ error: "Método no permitido" });
    }

    // === Validación del cuerpo ===
    const { message, history } = req.body || {};
    if (!message || typeof message !== "string") {
      console.error("❌ [Gemini] Mensaje vacío o inválido:", message);
      return res.status(400).json({ error: "Mensaje vacío o inválido" });
    }

    // === Control de acceso por IP ===
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
      console.warn(`🚫 [Gemini] Límite diario alcanzado para IP ${ip}`);
      return res.status(429).json({
        reply: "🍀 Alcanzaste el límite de conversaciones por hoy. ¡Volvé mañana!",
      });
    }

    // === Validar API Key ===
    const GEMINI_API_KEY = process.env["GEMINI_API_KEY"];
    if (!GEMINI_API_KEY) {
      console.error("🚨 [Gemini] Falta GEMINI_API_KEY en el entorno");
      return res.status(500).json({ error: "Falta GEMINI_API_KEY en el entorno" });
    }

    console.log("🔑 [Gemini] API key presente:", !!GEMINI_API_KEY);
    console.log("👤 [Gemini] IP:", ip);

    // === Prompt del asistente ===
    const assistantPrompt = `
Sos Flynn Assistant 🍀, el asistente virtual del Flynn Irish Pub en Posadas, Misiones.
Tu estilo es cálido y cercano, con acento del litoral argentino.
Respondé en tono simpático, breve (máx. 2 frases) y en español.
Si preguntan por reservas, decí que pueden hacerlas desde el sitio web.
Si te preguntan algo fuera del contexto del bar, respondé:
"Perdón 🍀, eso no lo sé, pero puedo contarte sobre el bar o sus eventos."
`.trim();

    // === Historial limitado a 8 interacciones ===
    const recentMessages = (history || [])
      .slice(-8)
      .map((m: any) => ({
        role: m.isBot ? "model" : "user",
        parts: [{ text: m.text }],
      }));

    // === Actualizar historial ===
    conversationHistory = [...recentMessages, { role: "user", parts: [{ text: message }] }];

    // === Estructura CORRECTA para Gemini ===
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${assistantPrompt}\n\nUsuario: ${message}`,
            },
          ],
        },
      ],
    };

    // === Endpoint actualizado ===
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    console.log("🌐 [Gemini] Endpoint:", endpoint);
    console.log("🚀 [Gemini] Enviando request...");

    // === Request ===
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    console.log("📡 [Gemini] Status:", response.status);

    // === Log de respuesta cruda ===
    const rawText = await response.text();
    console.log("📨 [Gemini] Raw response:", rawText);

    if (!response.ok) {
      console.error("❌ [Gemini] Error HTTP:", response.status, rawText);
      return res.status(response.status).json({ error: rawText });
    }

    // === Procesar respuesta ===
    const data = JSON.parse(rawText);
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "🍀 No pude generar una respuesta, intentá nuevamente.";

    console.log("✅ [Gemini] Respuesta generada:", reply);

    conversationHistory.push({ role: "model", parts: [{ text: reply }] });
    conversationHistory = conversationHistory.slice(-8);

    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error("🔥 [Gemini] Error interno:", err);
    return res.status(500).json({ error: err.message || "Error interno del servidor" });
  }
}
