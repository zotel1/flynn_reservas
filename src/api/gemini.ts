// api/gemini.ts
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

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt base con estilo "Flynn Irish Pub"
    const prompt = `
      Sos Flynn Assistant 🍀, el asistente virtual de un bar irlandés familiar en Misiones.
      Responde siempre en tono amigable, cálido y breve (máx. 2 frases).
      Hablas sobre horarios, eventos, menú, ambiente o reservas.
      Usuario dice: "${message}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response.text();

    res.status(200).json({ reply: response });
  } catch (err) {
    console.error("Error en función Gemini:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
