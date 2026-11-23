import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";

import { FRONTEND_URL, PORT } from "./config.js";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import taskRoutes from "./routes/tasks.js";
import { isPostgresMode, resetDB } from "./db.js";

const app = express();

function parseAllowedOrigins() {
  const raw = process.env.FRONTEND_URL ?? FRONTEND_URL ?? "";
  return raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      const normalized = origin.replace(/\/+$/, "");
      const allowedOrigins = parseAllowedOrigins();
      const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(normalized) || isLocalDev) {
        return callback(null, true);
      }
      const corsError = new Error("Origin tidak diizinkan oleh kebijakan CORS.");
      corsError.statusCode = 403;
      return callback(corsError);
    },
    credentials: true
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    storage: isPostgresMode() ? "postgres" : "json",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/tasks", taskRoutes);

if (process.env.NODE_ENV !== "production") {
  app.post("/api/dev/reset", async (req, res, next) => {
    try {
      await resetDB();
      return res.json({ success: true, message: "Database direset ke data seed awal." });
    } catch (err) {
      return next(err);
    }
  });
}

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint tidak ditemukan." });
});

app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Format JSON request tidak valid." });
  }
  const statusCode = err?.statusCode || 500;
  return res.status(statusCode).json({ error: err?.message || "Terjadi kesalahan pada server." });
});

const isMainEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainEntry) {
  app.listen(PORT, () => {
    console.log(`StudyTrack backend berjalan di http://localhost:${PORT}`);
  });
}

export default app;
