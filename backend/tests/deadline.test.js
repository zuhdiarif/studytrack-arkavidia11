import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  PRIORITY,
  TWENTY_FOUR_HOURS_SEC,
  enrichAndSortTasks,
  getDeadlineCategory,
  parseDeadlineDate
} from "../utils/deadline.js";
import app from "../server.js";

const CASE_STUDY_TASKS = [
  {
    id: 1,
    user_id: 1,
    mata_kuliah_id: 1,
    mata_kuliah: "Database Systems",
    kode_mata_kuliah: "CS 186",
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
    mata_kuliah: "Data Structures",
    kode_mata_kuliah: "CS 61B",
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
    mata_kuliah: "Software Engineering",
    kode_mata_kuliah: "CS 169",
    judul: "Sprint 2: Backend API Integration",
    deskripsi: "Integrasi endpoint backend ke frontend untuk sprint 2.",
    deadline: "2026-07-06T23:59:00",
    status: "belum",
    created_at: "2026-06-17T11:00:00"
  }
];

function formatLocalDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

describe("StudyTrack Deadline Reminder — 5 Skenario Verifikasi Studi Kasus", () => {
  const referenceNow = parseDeadlineDate("2026-07-03T00:00:00");

  it("exports expected constants matching specification", () => {
    assert.equal(TWENTY_FOUR_HOURS_SEC, 86400);
    assert.deepEqual(PRIORITY, { NEAR: 1, OVERDUE: 2, NORMAL: 3 });
  });

  it("Skenario 1 (Positif F01/F02/F04): ID 1 (< 24h, belum) -> NEAR di urutan #1", () => {
    const sorted = enrichAndSortTasks(CASE_STUDY_TASKS, referenceNow);
    assert.equal(sorted[0].id, 1);
    assert.equal(sorted[0].deadline_category, "NEAR");
    assert.equal(sorted[0].remaining_seconds, 86340);
    assert.equal(sorted[0].remaining_hours, 23.98);
  });

  it("Skenario 2 (Positif F03 Overdue): ID 2 (terlewat 14j, belum) -> OVERDUE di urutan #2", () => {
    const sorted = enrichAndSortTasks(CASE_STUDY_TASKS, referenceNow);
    assert.equal(sorted[1].id, 2);
    assert.equal(sorted[1].deadline_category, "OVERDUE");
    assert.equal(sorted[1].remaining_hours, -14);
    assert.equal(sorted[1].remaining_seconds, -50400);
  });

  it("Skenario 3 (Negatif >= 24h): ID 3 (sisa 3h 23j, belum) -> NORMAL di urutan #3 & urutan penuh [1, 2, 3]", () => {
    const sorted = enrichAndSortTasks(CASE_STUDY_TASKS, referenceNow);
    assert.equal(sorted[2].id, 3);
    assert.equal(sorted[2].deadline_category, "NORMAL");
    assert.deepEqual(
      sorted.map((t) => t.id),
      [1, 2, 3]
    );
  });

  it("Skenario 4 (Edge Case batas tepat 24 jam): 86400s -> NORMAL, 86399s -> NEAR naik ke #1", () => {
    const exact24hBefore = parseDeadlineDate("2026-07-02T23:59:00");
    assert.equal(
      getDeadlineCategory(CASE_STUDY_TASKS[0].deadline, "belum", exact24hBefore),
      "NORMAL"
    );
    const sortedAtExact24h = enrichAndSortTasks(CASE_STUDY_TASKS, exact24hBefore);
    assert.equal(sortedAtExact24h[0].id, 2);
    assert.equal(sortedAtExact24h[0].deadline_category, "OVERDUE");
    const task1AtExact24h = sortedAtExact24h.find((t) => t.id === 1);
    assert.equal(task1AtExact24h.deadline_category, "NORMAL");
    assert.equal(task1AtExact24h.remaining_seconds, 86400);

    const oneSecondLater = parseDeadlineDate("2026-07-02T23:59:01");
    assert.equal(
      getDeadlineCategory(CASE_STUDY_TASKS[0].deadline, "belum", oneSecondLater),
      "NEAR"
    );
    const sortedOneSecLater = enrichAndSortTasks(CASE_STUDY_TASKS, oneSecondLater);
    assert.deepEqual(
      sortedOneSecLater.map((t) => t.id),
      [1, 2, 3]
    );
    assert.equal(sortedOneSecLater[0].deadline_category, "NEAR");
    assert.equal(sortedOneSecLater[0].remaining_seconds, 86399);
  });

  it("Skenario 5 (Edge Case status selesai): ID 1 (< 24h) berstatus selesai -> NORMAL & turun di bawah OVERDUE", () => {
    const completedVariant = CASE_STUDY_TASKS.map((task) =>
      task.id === 1 ? { ...task, status: "selesai" } : task
    );
    assert.equal(
      getDeadlineCategory(completedVariant[0].deadline, "selesai", referenceNow),
      "NORMAL"
    );

    const sorted = enrichAndSortTasks(completedVariant, referenceNow);
    const task1 = sorted.find((t) => t.id === 1);
    assert.equal(task1.deadline_category, "NORMAL");
    assert.deepEqual(
      sorted.map((t) => t.id),
      [2, 3, 1]
    );
  });
});

describe("Deadline Helper — Tie-Breaking, Boundary 0s & Datetime Parsing", () => {
  it("handles exact 0s (now === deadline) as OVERDUE", () => {
    const exactZero = parseDeadlineDate("2026-07-03T23:59:00");
    assert.equal(getDeadlineCategory("2026-07-03T23:59:00", "belum", exactZero), "OVERDUE");
  });

  it("sorts NEAR and OVERDUE by deadline ASC, and NORMAL by created_at DESC", () => {
    const now = parseDeadlineDate("2026-07-03T12:00:00");
    const tasks = [
      { id: 10, deadline: "2026-07-04T10:00:00", status: "belum", created_at: "2026-07-01T08:00:00Z" },
      { id: 11, deadline: "2026-07-03T15:00:00", status: "belum", created_at: "2026-07-01T07:00:00Z" },
      { id: 20, deadline: "2026-07-03T11:00:00", status: "belum", created_at: "2026-07-01T08:00:00Z" },
      { id: 21, deadline: "2026-07-02T09:00:00", status: "belum", created_at: "2026-07-01T09:00:00Z" },
      { id: 30, deadline: "2026-07-10T12:00:00", status: "belum", created_at: "2026-07-01T08:00:00Z" },
      { id: 31, deadline: "2026-07-12T12:00:00", status: "belum", created_at: "2026-07-02T08:00:00Z" }
    ];

    const sorted = enrichAndSortTasks(tasks, now);
    assert.deepEqual(
      sorted.map((t) => [t.id, t.deadline_category]),
      [
        [11, "NEAR"],
        [10, "NEAR"],
        [21, "OVERDUE"],
        [20, "OVERDUE"],
        [31, "NORMAL"],
        [30, "NORMAL"]
      ]
    );
  });

  it("parses naive datetime-local (with/without seconds, space-separated) and ISO UTC consistently", () => {
    const a = parseDeadlineDate("2026-07-03T23:59");
    const b = parseDeadlineDate("2026-07-03T23:59:00");
    const c = parseDeadlineDate("2026-07-03 23:59:00");
    assert.equal(a.getTime(), b.getTime());
    assert.equal(b.getTime(), c.getTime());

    const utcNow = new Date("2026-07-03T00:00:00.000Z");
    const utcNear = "2026-07-03T23:00:00.000Z";
    const offsetNear = "2026-07-04T06:00:00+07:00";
    assert.equal(parseDeadlineDate(utcNear).getTime(), parseDeadlineDate(offsetNear).getTime());
    assert.equal(getDeadlineCategory(utcNear, "belum", utcNow), "NEAR");
    assert.equal(getDeadlineCategory(offsetNear, "belum", utcNow), "NEAR");
  });
});

describe("Express HTTP Integration — /api/health, /api/tasks & Tenant Isolation (F04)", () => {
  let server;
  let baseUrl;
  let tempDbPath;
  let originalDbPath;
  let originalDatabaseUrl;

  before(async () => {
    originalDbPath = process.env.DB_FILE_PATH;
    originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    tempDbPath = path.join(
      os.tmpdir(),
      `studytrack-test-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
    );
    process.env.DB_FILE_PATH = tempDbPath;

    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (originalDbPath === undefined) {
      delete process.env.DB_FILE_PATH;
    } else {
      process.env.DB_FILE_PATH = originalDbPath;
    }
    if (originalDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it("GET /api/health returns storage mode and ISO timestamp", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.storage, "json");
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
  });

  it("GET /api/tasks returns server_time, enriched categories, and strict tenant isolation", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@studytrack.test", password: "demo1234" })
    });
    assert.equal(loginRes.status, 200);
    const { token: demoToken } = await loginRes.json();

    const tasksRes = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    assert.equal(tasksRes.status, 200);
    const demoBody = await tasksRes.json();
    assert.ok(!Number.isNaN(Date.parse(demoBody.server_time)));
    assert.equal(demoBody.tasks.length, 3);
    for (const task of demoBody.tasks) {
      assert.ok(["NEAR", "OVERDUE", "NORMAL"].includes(task.deadline_category));
      assert.equal(typeof task.remaining_hours, "number");
      assert.ok(task.mata_kuliah);
    }

    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama: "Mahasiswa Lain",
        email: "other@studytrack.test",
        password: "password123"
      })
    });
    assert.equal(regRes.status, 201);
    const { token: otherToken } = await regRes.json();

    const otherInitialRes = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.equal(otherInitialRes.status, 200);
    const otherInitialBody = await otherInitialRes.json();
    assert.deepEqual(otherInitialBody.tasks, []);

    const courseRes = await fetch(`${baseUrl}/api/courses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${otherToken}`
      },
      body: JSON.stringify({ name: "Sistem Operasi", kode: "IF2230", dosen: "Dr. Rina" })
    });
    assert.equal(courseRes.status, 201);
    const { course } = await courseRes.json();

    const twoHoursFromNow = formatLocalDateTime(new Date(Date.now() + 2 * 3600 * 1000));
    const fiveDaysFromNow = formatLocalDateTime(new Date(Date.now() + 5 * 24 * 3600 * 1000));

    await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${otherToken}`
      },
      body: JSON.stringify({
        mata_kuliah_id: course.id,
        judul: "Tugas Jauh",
        deadline: fiveDaysFromNow
      })
    });
    await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${otherToken}`
      },
      body: JSON.stringify({
        mata_kuliah_id: course.id,
        judul: "Tugas Mepet",
        deadline: twoHoursFromNow
      })
    });

    const otherTasksRes = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    const otherBody = await otherTasksRes.json();
    assert.equal(otherBody.tasks.length, 2);
    assert.equal(otherBody.tasks[0].judul, "Tugas Mepet");
    assert.equal(otherBody.tasks[0].deadline_category, "NEAR");
    assert.equal(otherBody.tasks[1].judul, "Tugas Jauh");
    assert.equal(otherBody.tasks[1].deadline_category, "NORMAL");

    const demoRecheckRes = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    const demoRecheckBody = await demoRecheckRes.json();
    assert.equal(demoRecheckBody.tasks.length, 3);
  });
});
