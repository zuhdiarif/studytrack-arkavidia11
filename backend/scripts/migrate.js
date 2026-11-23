import "../config.js";
import { closeDB, isPostgresMode, runMigrations } from "../db.js";

async function main() {
  if (!isPostgresMode()) {
    console.error("DATABASE_URL tidak ditemukan. Set DATABASE_URL di backend/.env untuk migrasi PostgreSQL/Supabase.");
    process.exit(1);
  }
  await runMigrations();
  console.log("Migrasi StudyTrack (001_initial_studytrack_schema.sql) berhasil dijalankan.");
}

main()
  .catch((err) => {
    console.error("Gagal menjalankan migrasi:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDB();
  });
