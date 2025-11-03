import fs from "fs";
import path from "path";
import "dotenv/config";
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const qdrant = new QdrantClient({
  url: process.env.QDRANT_API_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

const COLLECTION_NAME = process.env.COLLECTION_NAME || "flynn_menu_embeddings";

interface Item {
  nombre: string;
  precio: number;
  categoria: string;
  receta?: string;
  tags?: string[];
}

interface Categoria {
  nombre: string;
  items: Item[];
}

interface FlynnMenu {
  categorias: Categoria[];
}

async function main() {
  const filePath = path.resolve("assets/flynn_menu_full.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const menu: FlynnMenu = JSON.parse(raw);

  console.log("📦 Archivo JSON cargado:", filePath);

  // 🔹 Crear colección si no existe
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

  if (!exists) {
    console.log("🧩 Creando colección en Qdrant...");
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: 1536, distance: "Cosine" },
    });
  }

  // 🔹 Convertir los ítems del menú a embeddings
  const allItems: Item[] = menu.categorias.flatMap((c) =>
    c.items.map((item) => ({
      ...item,
      categoria: c.nombre,
    }))
  );

  console.log(`📚 Generando embeddings para ${allItems.length} ítems...`);

  for (const [i, item] of allItems.entries()) {
    const text = `${item.nombre}. ${item.receta || ""} Categoría: ${item.categoria}. Tags: ${(item.tags || []).join(", ")}.`;
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    const vector = embeddingResponse.data[0].embedding;

    // Subir cada ítem a Qdrant
    await qdrant.upsert(COLLECTION_NAME, {
      points: [
        {
          id: i + 1,
          vector,
          payload: {
            nombre: item.nombre,
            categoria: item.categoria,
            precio: item.precio,
            receta: item.receta,
            tags: item.tags,
          },
        },
      ],
    });

    console.log(`✅ Insertado [${i + 1}/${allItems.length}] → ${item.nombre}`);
  }

  console.log("🎉 Embeddings generados y subidos correctamente a Qdrant!");
}

main().catch((err) => console.error("❌ Error:", err));