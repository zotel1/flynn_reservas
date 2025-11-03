import { QdrantClient } from "@qdrant/js-client-rest";
import fs from "fs";
import "dotenv/config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const QDRANT_URL = process.env.QDRANT_API_URL!;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!;
const COLLECTION_NAME = process.env.COLLECTION_NAME || "flynn_menu_embeddings";
const FILE_PATH = "./flynn_menu_enriched.json"; // tu archivo enriquecido

const client = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Error generando embedding: ${text}`);
  }

  const data = await response.json();
  return data.embedding?.values || [];
}

async function main() {
  const data = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));

  // Crear colección (si no existe)
  try {
    await client.getCollection(COLLECTION_NAME);
    console.log("✅ Colección ya existente:", COLLECTION_NAME);
  } catch {
    console.log("📦 Creando nueva colección...");
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 768, // tamaño estándar de Gemini embeddings
        distance: "Cosine",
      },
    });
  }

  let points: any[] = [];
  let id = 1;

  for (const categoria of data.categorias) {
    for (const item of categoria.items) {
      const texto = `${item.nombre}. ${item.receta || ""}. ${categoria.nombre}`;
      const vector = await generateEmbedding(texto);

      points.push({
        id: id++,
        vector,
        payload: {
          categoria: categoria.nombre,
          nombre: item.nombre,
          precio: item.precio,
          receta: item.receta || "",
          tags: item.tags || [],
        },
      });

      console.log(`🧠 Procesado: ${item.nombre}`);
    }
  }

  // Subir los puntos a Qdrant
  await client.upsert(COLLECTION_NAME, { points });
  console.log(`✅ ${points.length} items cargados en ${COLLECTION_NAME}`);
}

main().catch((err) => console.error("❌ Error:", err));
