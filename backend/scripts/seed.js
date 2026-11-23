import "../config.js";
import { closeDB, isPostgresMode, runMigrations, seedPostgres } from "../db.js";

async function main() {
  if (!isPostgresMode()) {
    console.error("DATABASE_URL tidak ditemukan. Set DATABASE_URL di backend/.env untuk seeding PostgreSQL/Supabase.");
    process.exit(1);
  }
  await runMigrations();
  await seedPostgres();
  console.log("Seed data StudyTrack (demo@studytrack.test + 3 mata kuliah + 3 tugas contoh) berhasil dimasukkan.");
}

main()
  .catch((err) => {
    console.error("Gagal menjalankan seed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDB();
  });
