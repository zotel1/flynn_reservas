import { GoogleGenerativeAI } from "@google/generative-ai";



export default async (req, res) => {
  return res.status(200).json({ version: process.version });
};