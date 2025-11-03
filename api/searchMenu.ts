import type { VercelRequest, VercelResponse } from "@vercel/node";
import { QdrantClient } from "@qdrant/js-client-rest";
import "dotenv/config";

const qdrant = new QdrantClient({
  url: process.env.QDRANT_API_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const COLLECTION_NAME = process.env.COLLECTION_NAME || "flynn_menu_embeddings";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { query } = req.body || {};
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Consulta inválida" });
  }

  try {
    // 1️⃣ Crear embedding con Gemini
    const embedResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: query }] },
        }),
      }
    );

    if (!embedResponse.ok) {
      const text = await embedResponse.text();
      throw new Error(`Error generando embedding: ${text}`);
    }

    const embedData = await embedResponse.json();
    const vector = embedData.embedding?.values;
    if (!vector) throw new Error("Embedding vacío o inválido");

    // 2️⃣ Buscar en Qdrant los items más similares
    const results = await qdrant.search(COLLECTION_NAME, {
      vector,
      limit: 5,
      score_threshold: 0.6,
    });

    // 3️⃣ Mapear resultados
    const items = results.map((r: any) => ({
      score: r.score,
      ...r.payload,
    }));

    return res.status(200).json({
      success: true,
      items,
    });
  } catch (err: any) {
    console.error("❌ Error en /api/searchMenu:", err);
    return res.status(500).json({
      error: err.message || "Error interno del servidor",
    });
  }
}
