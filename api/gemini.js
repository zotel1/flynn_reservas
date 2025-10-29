// /api/gemini.js
export default async function handler(req, res) {
  try {
    const body = req.body || (await req.json?.());
    const { message, history = [] } = body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Mensaje vacío o inválido" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

    // === Prompt base ===
    const systemPrompt = `
Sos el asistente virtual de *Flynn Irish Pub 🍀*, un bar deportivo con espíritu familiar en Misiones.
Respondé siempre con un tono cálido, breve y amistoso, como si fueras parte del equipo del bar.
Podés hablar sobre: horarios, reservas, eventos, menú, bebidas y ambiente.
Si el usuario menciona "reservar" o "reserva", recordale amablemente que puede hacerlo desde la sección de reservas.
`;

    // === Construir contexto (últimos 5 mensajes) ===
    const conversationContext = history
      .slice(-5)
      .map((m) => ({
        role: m.isBot ? "model" : "user",
        parts: [{ text: m.text }],
      }));

    // === Enviar al modelo ===
    const response = await fetch(`${url}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          ...conversationContext,
          { role: "user", parts: [{ text: message }] },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini API error: ${errorData}`);
    }

    const data = await response.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No pude generar una respuesta 🍀";

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Error al conectar con Gemini:", error);
    return res.status(500).json({ error: error.message });
  }
}
