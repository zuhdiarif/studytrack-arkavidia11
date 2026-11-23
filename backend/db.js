import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import pg from "pg";
import { DATABASE_SSL } from "./config.js";

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(__dirname, "db.json");
const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "001_initial_studytrack_schema.sql"
);

let pool = null;

export function isPostgresMode() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

function resolveSslOption(connectionString) {
  const sslSetting = (process.env.DATABASE_SSL || DATABASE_SSL || "").toLowerCase();
  if (sslSetting === "false" || sslSetting === "0" || sslSetting === "disable") {
    return false;
  }
  const isLocalHost =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  if (isLocalHost && sslSetting !== "true" && sslSetting !== "require") {
    return false;
  }
  return { rejectUnauthorized: false };
}

export function getPool() {
  if (!isPostgresMode()) return null;
  if (!pool) {
    const connectionString = process.env.DATABASE_URL.trim();
    pool = new Pool({
      connectionString,
      ssl: resolveSslOption(connectionString),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }
  return pool;
}

export async function closeDB() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

function getDbPath() {
  return process.env.DB_FILE_PATH || DEFAULT_DB_PATH;
}

export function seedData() {
  const passwordHash = bcrypt.hashSync("demo1234", 10);
  return {
    nextIds: { user: 2, course: 4, task: 4 },
    users: [
      {
        id: 1,
        nama: "Demo Mahasiswa",
        email: "demo@studytrack.test",
        password_hash: passwordHash
      }
    ],
    courses: [
      { id: 1, user_id: 1, name: "Database Systems", kode: "CS 186", dosen: "Dr. Andi Wijaya" },
      { id: 2, user_id: 1, name: "Data Structures", kode: "CS 61B", dosen: "Dr. Sari Lestari" },
      { id: 3, user_id: 1, name: "Software Engineering", kode: "CS 169", dosen: "Dr. Budi Santoso" }
    ],
    tasks: [
      {
        id: 1,
        user_id: 1,
        mata_kuliah_id: 1,
        judul: "Lab 4: Query Optimization Report",
        deskripsi: "Laporan hasil eksperimen optimasi query beserta analisis query plan.",
        deadline: "2026-07-03T23:59:00",
        status: "belum",
        created_at: "2026-06-15T09:00:00"
      },
      {
        id: 2,
        user_id: 1,
        mata_kuliah_id: 2,
        judul: "Project 3: BSTMap Implementation",
        deskripsi: "Implementasi BSTMap beserta pengujian dasarnya.",
        deadline: "2026-07-02T10:00:00",
        status: "belum",
        created_at: "2026-06-16T14:00:00"
      },
      {
        id: 3,
        user_id: 1,
        mata_kuliah_id: 3,
        judul: "Sprint 2: Backend API Integration",
        deskripsi: "Integrasi endpoint backend ke frontend untuk sprint 2.",
        deadline: "2026-07-06T23:59:00",
        status: "belum",
        created_at: "2026-06-17T11:00:00"
      }
    ]
  };
}

function readJsonDB() {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    writeJsonDB(seedData());
  }
  return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
}

function writeJsonDB(db) {
  const dbPath = getDbPath();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function formatPgTaskRow(row) {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    mata_kuliah_id: Number(row.mata_kuliah_id),
    judul: row.judul,
    deskripsi: row.deskripsi || "",
    deadline: row.deadline,
    status: row.status,
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    ...(row.mata_kuliah !== undefined ? { mata_kuliah: row.mata_kuliah } : {}),
    ...(row.kode_mata_kuliah !== undefined ? { kode_mata_kuliah: row.kode_mata_kuliah } : {})
  };
}

export async function runMigrations() {
  const pgPool = getPool();
  if (!pgPool) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }
  const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  await pgPool.query(sql);
}

export async function seedPostgres() {
  const pgPool = getPool();
  if (!pgPool) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }
  const seed = seedData();
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    for (const u of seed.users) {
      await client.query(
        `INSERT INTO public.users (id, nama, email, password_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.nama, u.email, u.password_hash]
      );
    }

    for (const c of seed.courses) {
      await client.query(
        `INSERT INTO public.courses (id, user_id, name, kode, dosen)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.user_id, c.name, c.kode, c.dosen]
      );
    }

    for (const t of seed.tasks) {
      await client.query(
        `INSERT INTO public.tasks (id, user_id, mata_kuliah_id, judul, deskripsi, deadline, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::timestamp, $7, $8::timestamptz)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.user_id, t.mata_kuliah_id, t.judul, t.deskripsi, t.deadline, t.status, t.created_at]
      );
    }

    await client.query(
      `SELECT setval(pg_get_serial_sequence('public.users', 'id'), COALESCE((SELECT MAX(id) FROM public.users), 1), true)`
    );
    await client.query(
      `SELECT setval(pg_get_serial_sequence('public.courses', 'id'), COALESCE((SELECT MAX(id) FROM public.courses), 1), true)`
    );
    await client.query(
      `SELECT setval(pg_get_serial_sequence('public.tasks', 'id'), COALESCE((SELECT MAX(id) FROM public.tasks), 1), true)`
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function resetDB() {
  if (isPostgresMode()) {
    const pgPool = getPool();
    await pgPool.query("TRUNCATE TABLE public.tasks, public.courses, public.users RESTART IDENTITY CASCADE");
    await seedPostgres();
    return;
  }
  writeJsonDB(seedData());
}

export async function findUserByEmail(email) {
  if (isPostgresMode()) {
    const { rows } = await getPool().query(
      `SELECT id, nama, email, password_hash
       FROM public.users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  }
  const db = readJsonDB();
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function createUser({ nama, email, passwordHash }) {
  if (isPostgresMode()) {
    const { rows } = await getPool().query(
      `INSERT INTO public.users (nama, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, nama, email`,
      [nama, email, passwordHash]
    );
    return rows[0];
  }
  const db = readJsonDB();
  const newUser = {
    id: db.nextIds.user++,
    nama,
    email,
    password_hash: passwordHash
  };
  db.users.push(newUser);
  writeJsonDB(db);
  return { id: newUser.id, nama: newUser.nama, email: newUser.email };
}

export async function getCoursesByUser(userId) {
  if (isPostgresMode()) {
    const { rows } = await getPool().query(
      `SELECT id, user_id, name, kode, dosen
       FROM public.courses
       WHERE user_id = $1
       ORDER BY id ASC`,
      [userId]
    );
    return rows;
  }
  const db = readJsonDB();
  return db.courses.filter((c) => c.user_id === userId);
}

export async function findCourseByIdForUser(courseId, userId) {
  if (isPostgresMode()) {
    const { rows } = await getPool().query(
      `SELECT id, user_id, name, kode, dosen
       FROM public.courses
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [courseId, userId]
    );
    return rows[0] || null;
  }
  const db = readJsonDB();
  return db.courses.find((c) => c.id === courseId && c.user_id === userId) || null;
}

export async function createCourse({ userId, name, kode, dosen }) {
  if (isPostgresMode()) {
    const { rows } = await getPool().query(
      `INSERT INTO public.courses (user_id, name, kode, dosen)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, name, kode, dosen`,
      [userId, name, kode || "", dosen || ""]
    );
    return rows[0];
  }
  const db = readJsonDB();
  const newCourse = {
    id: db.nextIds.course++,
    user_id: userId,
    name,
    kode: kode || "",
    dosen: dosen || ""
  };
  db.courses.push(newCourse);
  writeJsonDB(db);
  return newCourse;
}

export async function updateCourse(courseId, userId, { name, kode, dosen }) {
  if (isPostgresMode()) {
    const existing = await findCourseByIdForUser(courseId, userId);
    if (!existing) return null;
    const { rows } = await getPool().query(
      `UPDATE public.courses
       SET name = $1, kode = $2, dosen = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, name, kode, dosen`,
      [
        name !== undefined ? name : existing.name,
        kode !== undefined ? kode : existing.kode,
        dosen !== undefined ? dosen : existing.dosen,
        courseId,
        userId
      ]
    );
    return rows[0] || null;
  }
  const db = readJsonDB();
  const course = db.courses.find((c) => c.id === courseId && c.user_id === userId);
  if (!course) return null;
  if (name !== undefined) course.name = name;
  if (kode !== undefined) course.kode = kode;
  if (dosen !== undefined) course.dosen = dosen;
  writeJsonDB(db);
  return course;
}

export async function deleteCourse(courseId, userId) {
  if (isPostgresMode()) {
    const { rowCount } = await getPool().query(
      `DELETE FROM public.courses
       WHERE id = $1 AND user_id = $2`,
      [courseId, userId]
    );
    return rowCount > 0;
  }
  const db = readJsonDB();
  const course = db.courses.find((c) => c.id === courseId && c.user_id === userId);
  if (!course) return false;
  db.courses = db.courses.filter((c) => c.id !== courseId);
  db.tasks = db.tasks.filter((t) => t.mata_kuliah_id !== courseId);
  writeJsonDB(db);
  return true;
}

export async function getTasksWithCourseByUser(userId) {
  if (isPostgresMode()) {
    const { rows } = await getPool().query(
      `SELECT
         t.id,
         t.user_id,
         t.mata_kuliah_id,
         t.judul,
         t.deskripsi,
         TO_CHAR(t.deadline, 'YYYY-MM-DD"T"HH24:MI:SS') AS deadline,
         t.status,
         t.created_at,
         c.name AS mata_kuliah,
         c.kode AS kode_mata_kuliah
       FROM public.tasks t
       INNER JOIN public.courses c ON c.id = t.mata_kuliah_id
       WHERE t.user_id = $1
       ORDER BY t.deadline ASC, t.created_at DESC`,
      [userId]
    );
    return rows.map(formatPgTaskRow);
  }
  const db = readJsonDB();
  const courseMap = new Map(db.courses.map((c) => [c.id, c]));
  return db.tasks
    .filter((t) => t.user_id === userId)
    .map((t) => {
      const course = courseMap.get(t.mata_kuliah_id);
      return {
        ...t,
        mata_kuliah: course ? course.name : null,
        kode_mata_kuliah: course ? course.kode : null
      };
    });
}

export async function findTaskByIdForUser(taskId, userId) {
  if (isPostgresMode()) {
    const { rows } = await getPool().query(
      `SELECT
         t.id,
         t.user_id,
         t.mata_kuliah_id,
         t.judul,
         t.deskripsi,
         TO_CHAR(t.deadline, 'YYYY-MM-DD"T"HH24:MI:SS') AS deadline,
         t.status,
         t.created_at,
         c.name AS mata_kuliah,
         c.kode AS kode_mata_kuliah
       FROM public.tasks t
       INNER JOIN public.courses c ON c.id = t.mata_kuliah_id
       WHERE t.id = $1 AND t.user_id = $2
       LIMIT 1`,
      [taskId, userId]
    );
    return rows[0] ? formatPgTaskRow(rows[0]) : null;
  }
  const db = readJsonDB();
  const task = db.tasks.find((t) => t.id === taskId && t.user_id === userId);
  if (!task) return null;
  const course = db.courses.find((c) => c.id === task.mata_kuliah_id);
  return {
    ...task,
    mata_kuliah: course ? course.name : null,
    kode_mata_kuliah: course ? course.kode : null
  };
}

export async function createTask({ userId, mataKuliahId, judul, deskripsi, deadline }) {
  if (isPostgresMode()) {
    const { rows } = await getPool().query(
      `INSERT INTO public.tasks (user_id, mata_kuliah_id, judul, deskripsi, deadline, status)
       VALUES ($1, $2, $3, $4, $5::timestamp, 'belum')
       RETURNING
         id,
         user_id,
         mata_kuliah_id,
         judul,
         deskripsi,
         TO_CHAR(deadline, 'YYYY-MM-DD"T"HH24:MI:SS') AS deadline,
         status,
         created_at`,
      [userId, mataKuliahId, judul, deskripsi || "", deadline]
    );
    return formatPgTaskRow(rows[0]);
  }
  const db = readJsonDB();
  const newTask = {
    id: db.nextIds.task++,
    user_id: userId,
    mata_kuliah_id: mataKuliahId,
    judul,
    deskripsi: deskripsi || "",
    deadline,
    status: "belum",
    created_at: new Date().toISOString()
  };
  db.tasks.push(newTask);
  writeJsonDB(db);
  return newTask;
}

export async function updateTask(taskId, userId, { judul, deskripsi, deadline, status }) {
  if (isPostgresMode()) {
    const existing = await findTaskByIdForUser(taskId, userId);
    if (!existing) return null;
    const { rows } = await getPool().query(
      `UPDATE public.tasks
       SET judul = $1, deskripsi = $2, deadline = $3::timestamp, status = $4
       WHERE id = $5 AND user_id = $6
       RETURNING
         id,
         user_id,
         mata_kuliah_id,
         judul,
         deskripsi,
         TO_CHAR(deadline, 'YYYY-MM-DD"T"HH24:MI:SS') AS deadline,
         status,
         created_at`,
      [
        judul !== undefined ? judul : existing.judul,
        deskripsi !== undefined ? deskripsi : existing.deskripsi,
        deadline !== undefined ? deadline : existing.deadline,
        status !== undefined ? status : existing.status,
        taskId,
        userId
      ]
    );
    return rows[0] ? formatPgTaskRow(rows[0]) : null;
  }
  const db = readJsonDB();
  const task = db.tasks.find((t) => t.id === taskId && t.user_id === userId);
  if (!task) return null;
  if (judul !== undefined) task.judul = judul;
  if (deskripsi !== undefined) task.deskripsi = deskripsi;
  if (deadline !== undefined) task.deadline = deadline;
  if (status !== undefined) task.status = status;
  writeJsonDB(db);
  return task;
}

export async function deleteTask(taskId, userId) {
  if (isPostgresMode()) {
    const { rowCount } = await getPool().query(
      `DELETE FROM public.tasks
       WHERE id = $1 AND user_id = $2`,
      [taskId, userId]
    );
    return rowCount > 0;
  }
  const db = readJsonDB();
  const task = db.tasks.find((t) => t.id === taskId && t.user_id === userId);
  if (!task) return false;
  db.tasks = db.tasks.filter((t) => t.id !== taskId);
  writeJsonDB(db);
  return true;
}
