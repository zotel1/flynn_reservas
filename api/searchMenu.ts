import type { VercelRequest, VercelResponse } from "@vercel/node";
import { QdrantClient } from "@qdrant/js-client-rest";
import { GoogleGenerativeAI } from "@google/generative-ai";

// === Variables de entorno ===
const QDRANT_URL = process.env["QDRANT_URL"]!;
const QDRANT_API_KEY = process.env["QDRANT_API_KEY"]!;
const GEMINI_API_KEY = process.env["GEMINI_API_KEY"]!;
const COLLECTION_NAME = "flynn_bar_beta"; // ✅ tu colección real

// === Inicializar clientes ===
const qdrant = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const { query, limit = 5 } = req.body || {};
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: 'Falta "query" (string)' });
    }

    // 1️⃣ Generar embedding del texto del usuario
    const { embedding } = await embedModel.embedContent(query);
    const vector = embedding.values;

    // 2️⃣ Buscar en Qdrant
    const results = await qdrant.query(COLLECTION_NAME, {
      query: vector,
      limit,
      with_payload: true,
    });

    // 3️⃣ Devolver solo el payload útil
    const items = results.points?.map((p: any) => p.payload) || [];

    return res.status(200).json({ items });
  } catch (err: any) {
    console.error("❌ searchMenu error:", err);
    return res.status(500).json({ error: err?.message || "Error interno" });
  }
}
