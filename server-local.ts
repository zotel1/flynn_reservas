import express from "express";
import type { Request, Response } from "express";
import cors from "cors";

import geminiHandler from "./api/gemini.ts";
import searchMenuHandler from "./api/searchMenu.ts";

const app = express();
app.use(cors({ origin: "http://localhost:4200" }));
app.use(express.json());

function adaptHandler(handler: any) {
  return async (req: Request, res: Response) => {
    try {
      const vercelReq = {
        query: req.query as any,
        cookies: (req as any).cookies || {},
        body: req.body,
      };
      await handler(vercelReq, res);
    } catch (err) {
      console.error("🔥 Error en handler local:", err);
      res.status(500).json({ error: "Error interno en el servidor local" });
    }
  };
}

app.post("/api/gemini", adaptHandler(geminiHandler));
app.post("/api/searchMenu", adaptHandler(searchMenuHandler));

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`🚀 API local corriendo en http://localhost:${PORT}`)
);
