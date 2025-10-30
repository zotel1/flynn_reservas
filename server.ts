import expressPkg from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

const express = expressPkg;
const { Request, Response } = expressPkg as any;

dotenv.config();

const app = express();
app.use(express.json());

app.post('/api/gemini', async (req: any, res: any): Promise<void> => {
  const { message } = req.body || {};

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Mensaje vacío o inválido' });
    return;
  }

  const GEMINI_API_KEY = process.env['GEMINI_API_KEY'];
  if (!GEMINI_API_KEY) {
    res.status(500).json({ error: 'Falta GEMINI_API_KEY en .env' });
    return;
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;



    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: message }] }]
      })
    });

    const data: any = await response.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No se generó respuesta 🍀';

    res.status(200).json({ reply });
  } catch (error: any) {
    console.error('Error interno:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`✅ Servidor local corriendo en http://localhost:${PORT}`);
});
