export default async function handler(req, res) {
  try {
    // 1️⃣ Método válido
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido jaja" });
    }

    // 2️⃣ Leer mensaje
    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "Mensaje vacío o inválido" });
    }

    // 3️⃣ Clave de API
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      console.error("❌ Falta la variable GEMINI_API_KEY");
      return res
        .status(500)
        .json({ error: "Falta la variable GEMINI_API_KEY en el entorno" });
    }

    // 4️⃣ Preparar solicitud
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    console.log("📡 Enviando solicitud a Gemini");
    console.log("🔑 Clave detectada:", GEMINI_API_KEY.slice(0, 10) + "...");

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log("📥 Gemini respondió con status:", response.status);

    // 5️⃣ Revisar respuesta
    const text = await response.text();
    console.log("🧾 Texto crudo:", text);

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `Gemini devolvió error ${response.status}`, detail: text });
    }

    // 6️⃣ Procesar JSON
    const data = JSON.parse(text);
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No pude generar una respuesta 🍀";

    console.log("✅ Respuesta generada:", reply);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error("🔥 Error interno del servidor:", error);
    return res.status(500).json({ error: error.message || "Error interno" });
  }
}
