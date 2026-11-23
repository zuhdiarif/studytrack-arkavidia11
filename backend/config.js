import "dotenv/config";

export const PORT = Number(process.env.PORT) || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || "studytrack-secret-key-change-this";
export const DATABASE_URL = process.env.DATABASE_URL || "";
export const DATABASE_SSL = process.env.DATABASE_SSL || "";
export const FRONTEND_URL = process.env.FRONTEND_URL || "";
