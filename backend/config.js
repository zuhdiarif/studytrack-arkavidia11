import "dotenv/config";

export const PORT = Number(process.env.PORT) || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || "studytrack-secret-key-change-this";
export const DATABASE_URL = process.env.DATABASE_URL || "";
export const DATABASE_SSL = process.env.DATABASE_SSL || "";
export const FRONTEND_URL = process.env.FRONTEND_URL || "";
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
