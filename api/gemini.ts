import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { message } = req.body as { message?: string };
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Mensaje vacío' });
    }

    // ✅ Acceso seguro a la variable de entorno
    const apiKey = process.env['GEMINI_API_KEY'] ?? '';
    if (!apiKey) {
      console.error('❌ Falta la variable GEMINI_API_KEY en el entorno');
      return res.status(500).json({ error: 'Falta GEMINI_API_KEY' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      Sos Flynn Assistant 🍀, el asistente virtual del Flynn Irish Pub.
      Responde con tono cálido, irlandés y en español con tono misionero y correntino, argentino.
      Sé breve (máx. 2 frases). Si el mensaje habla de reservas, menciona que puede reservarse desde el sitio.
      Usuario dice: "${message}"
    `;

    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();

    return res.status(200).json({ reply: responseText });
  } catch (err) {
    console.error('Error en Gemini:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}