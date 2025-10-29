import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ FALTA GEMINI_API_KEY en las variables de entorno");
      return res.status(500).json({ error: "Falta GEMINI_API_KEY" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt base para mantener el tono irlandés y del bar
    const prompt = `
      Sos Flynn Assistant 🍀, el asistente virtual del Flynn Irish Pub.
      Respondé con tono cálido, irlandés y en español con acento misionero o correntino.
      Sé breve (máx. 2 frases). Si el mensaje habla de reservas, mencioná que pueden hacerse desde el sitio.
      Usuario dice: "${message}"
    `;

    const result = await model.generateContent(prompt);
    const reply = result?.response?.text?.() || "No pude generar una respuesta.";

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("❌ Error en la API Gemini:", error);
    return res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
}
