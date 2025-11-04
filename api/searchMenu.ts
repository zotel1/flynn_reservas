// /api/searchMenu.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenerativeAI } from '@google/generative-ai';

const QDRANT_URL = process.env.QDRANT_URL!;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const COLLECTION_NAME = 'flynn_menu_gemini'; // tu colección en Qdrant

// Inicializar clientes
const qdrant = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const { query, limit = 5, filter } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Falta "query" (string)' });
    }

    // 1) Embedding del texto del usuario (Gemini)
    const { embedding } = await embedModel.embedContent(query);
    const vector = embedding.values; // number[]

    // 2) Búsqueda en Qdrant (dos argumentos)
    const results = await qdrant.search(COLLECTION_NAME, {
      vector,
      limit,
      with_payload: true,
      with_vector: false,
      // opcional: filtros por categoría, etc.
      // filter: {
      //   must: [{ key: 'categoria', match: { value: 'Pizzas' } }]
      // }
      ...(filter ? { filter } : {}),
    });

    // 3) Devolver solo el payload útil
    const items = results.map((p) => p.payload);

    return res.status(200).json({ items });
  } catch (err: any) {
    console.error('searchMenu error:', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
}
