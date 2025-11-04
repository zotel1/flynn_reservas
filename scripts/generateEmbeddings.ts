import fs from "fs";
import path from "path";
import { QdrantClient } from "@qdrant/js-client-rest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

const QDRANT_URL = process.env["QDRANT_URL"]!;
const QDRANT_API_KEY = process.env["QDRANT_API_KEY"]!;
const GEMINI_API_KEY = process.env["GEMINI_API_KEY"]!;
const COLLECTION_NAME = "menu-flynn-collection";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const qdrant = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });

async function generateEmbeddings() {
  try {
    // 1️⃣ Leer JSON
    const filePath = path.join(process.cwd(), "flynn_menu_enriched.json");
    if (!fs.existsSync(filePath)) {
      throw new Error(`❌ No se encontró el archivo ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, "utf-8").trim();
    const json = JSON.parse(raw);

    // 2️⃣ Extraer productos desde "categorias"
    if (!json.categorias || !Array.isArray(json.categorias)) {
      throw new Error("⚠️ El JSON no tiene la propiedad 'categorias' o no es un array.");
    }

    const data = json.categorias.flatMap((cat: any) =>
      (cat.items || []).map((i: any) => ({
        ...i,
        categoria: i.categoria || cat.nombre || "Sin categoría",
      }))
    );

    console.log(`✅ Archivo cargado: ${data.length} productos detectados`);

    // 3️⃣ Crear colección si no existe
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some((c: any) => c.name === COLLECTION_NAME);

    if (!exists) {
      console.log(`🆕 Creando colección '${COLLECTION_NAME}' en Qdrant...`);
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: { size: 768, distance: "Cosine" },
      });
    } else {
      console.log(`✅ Colección '${COLLECTION_NAME}' ya existe`);
    }

    // 4️⃣ Generar embeddings
    console.log(`📦 Generando embeddings para ${data.length} productos...`);
    const points = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const text = `${item.nombre}. ${item.receta || ""}. Precio: ${item.precio}. Categoría: ${item.categoria}`;
      const { embedding } = await embedModel.embedContent(text);

      points.push({
        id: i + 1,
        vector: embedding.values,
        payload: {
          nombre: item.nombre,
          precio: item.precio,
          categoria: item.categoria,
          receta: item.receta,
          tags: item.tags || [],
        },
      });

      console.log(`✅ Procesado: ${item.nombre}`);
    }

    // 5️⃣ Subir a Qdrant
    console.log(`🚀 Subiendo ${points.length} vectores a Qdrant...`);
    await qdrant.upsert(COLLECTION_NAME, { points });

    console.log("🎉 ¡Embeddings generados y subidos correctamente a Qdrant!");
  } catch (err: any) {
    console.error("🔥 Error generando embeddings:", err);
  }
}

generateEmbeddings();
