// ✅ Compatible con Windows + ESM
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import 'dotenv/config';


// === Setup de rutas base ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🧩 Iniciando server-local.ts...");

// ✅ Cargar handlers con pathToFileURL (Windows friendly)
const geminiPath = pathToFileURL(path.join(__dirname, "./api/gemini.ts")).href;
const searchMenuPath = pathToFileURL(path.join(__dirname, "./api/searchMenu.ts")).href;

console.log("📂 Cargando handlers:");
console.log("  - Gemini:", geminiPath);
console.log("  - SearchMenu:", searchMenuPath);

const geminiHandler = (await import(geminiPath)).default;
const searchMenuHandler = (await import(searchMenuPath)).default;

console.log("✅ Handlers cargados correctamente.");

// === Crear app Express ===
const app = express();
app.use(cors({ origin: "http://localhost:4200" }));
app.use(express.json());

// === Adaptador genérico ===
function adaptHandler(handler: any) {
  return async (req: any, res: any) => {
    try {
      console.log(`🧠 [Adapter] Recibiendo ${req.method} ${req.path}`);
      const vercelReq = {
        method: req.method,
        headers: req.headers,
        query: req.query as any,
        cookies: (req as any).cookies || {},
        body: req.body,
      };
      await handler(vercelReq, res);
    } catch (err) {
      console.error("🔥 [Adapter] Error en handler:", err);
      res.status(500).json({ error: "Error interno en el servidor local" });
    }
  };
}

// === Rutas ===
app.post("/api/gemini", adaptHandler(geminiHandler));
app.post("/api/searchMenu", adaptHandler(searchMenuHandler));

// ✅ Endpoint de prueba
app.get("/api/ping", (_, res) => res.json({ ok: true, message: "Servidor activo 🚀" }));

// === Iniciar servidor ===
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor API local corriendo en http://localhost:${PORT}`);
});
