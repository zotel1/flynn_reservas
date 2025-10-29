import { GoogleGenerativeAI } from "@google/generative-ai";




export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  console.log("Runtime version:", process.version);
  res.status(200).json({ version: process.version });

  try {
    const { message } = req.body || {};
    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Falta GEMINI_API_KEY" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Sos Flynn Assistant 🍀, el asistente virtual del Flynn Irish Pub.
      Responde con tono cálido, irlandés y en español con tono misionero y correntino, argentino.
      Sé breve (máx. 2 frases). Si el mensaje habla de reservas, menciona que puede reservarse desde el sitio.
      Usuario dice: "${message}"
    `;


    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return res.status(200).json({ reply: text });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
