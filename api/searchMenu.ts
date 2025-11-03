import { QdrantClient } from "@qdrant/js-client-rest";
import { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const qdrant = new QdrantClient({
    url: process.env.QDRANT_API_URL!,
    apiKey: process.env.QDRANT_API_KEY!,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

const COLLECTION_NAME = process.env.COLLECTION_NAME || "flynn_menu_embeddings";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido" });
    }

    const { query } = req.body || {};
    if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Consulta vacía o inválida" });
    }

    try {
        // 🔹 Generar embedding para la consulta
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: query,
        });

        const vector = embeddingResponse.data[0].embedding;

        const results = await qdrant.search(COLLECTION_NAME, {
            vector,
            limit: 5,
            score_threshold: 0.6,
        });

        const items = results.map((r: any) => ({
            score: r.score,
            ...r.payload,
        }));
        return res.status(200).json({ 
            success: true,
            items, 
        });
        } catch (err: any) {
            console.error("Error en /api/searchMenu:", err);
            return res.status(500).json({ error: "Error interno del servidor",
        });
    }
}