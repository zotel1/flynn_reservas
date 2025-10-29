import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { message } = body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ Falta GEMINI_API_KEY en entorno");
      return res.status(500).json({ error: "Falta GEMINI_API_KEY" });
    }

    // Inicializar cliente con API Key
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // Prompt base para mantener el tono irlandés y del bar
    const prompt = `
      Sos Flynn Assistant 🍀, el asistente virtual del Flynn Irish Pub.
      Respondé con tono cálido, irlandés y en español con acento misionero o correntino.
      Sé breve (máx. 2 frases). Si el mensaje habla de reservas, mencioná que pueden hacerse desde el sitio.
      Usuario dice: "${message}"
    `;

    // Nuevo método según SDK v1
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const reply = result.response.text();
    console.log("✅ Respuesta de Gemini:", reply);

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("❌ Error interno en Gemini:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    });
  }
}