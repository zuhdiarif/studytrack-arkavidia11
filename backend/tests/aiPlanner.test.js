import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_GEMINI_MODEL, generateTaskStudyPlan } from "../services/aiPlanner.js";
import { parseDeadlineDate } from "../utils/deadline.js";
import app from "../server.js";

const SAMPLE_TASKS = {
  near: {
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
  overdue: {
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
  normal: {
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
};

describe("AI Study Planner Service — Gemini API & Deterministic Fallback", () => {
  const referenceNow = parseDeadlineDate("2026-07-03T00:00:00");

  it("calls Gemini API with x-goog-api-key header (not URL) and returns normalized live plan", async () => {
    let capturedUrl = "";
    let capturedOptions = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        urgency_summary:
                          "Deadline kurang dari 24 jam, fokuskan pada analisis query plan inti terlebih dahulu.",
                        estimated_total_minutes: 90,
                        first_action_now:
                          "Buka file hasil benchmark EXPLAIN ANALYZE dan rangkum 3 perbandingan waktu eksekusi utama.",
                        steps: [
                          {
                            step: "Validasi hasil EXPLAIN ANALYZE sebelum dan sesudah indexing",
                            duration_minutes: 25,
                            tip: "Sorot penurunan cost dan execution time pada tabel ringkasan."
                          },
                          {
                            step: "Tulis pembahasan analisis query plan pada laporan Lab 4",
                            duration_minutes: 45,
                            tip: "Gunakan struktur masalah -> perubahan index -> dampak performa."
                          },
                          {
                            step: "Proofread, ekspor PDF, dan unggah sebelum pukul 22.00",
                            duration_minutes: 20,
                            tip: "Pastikan seluruh grafik dan lampiran SQL terbaca jelas."
                          }
                        ]
                      })
                    }
                  ]
                }
              }
            ]
          };
        }
      };
    };

    const fakeApiKey = "fake-gemini-key-for-unit-test";
    const plan = await generateTaskStudyPlan({
      task: SAMPLE_TASKS.near,
      now: referenceNow,
      apiKey: fakeApiKey,
      model: DEFAULT_GEMINI_MODEL,
      fetchImpl: mockFetch
    });

    assert.equal(
      capturedUrl,
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`
    );
    assert.equal(capturedUrl.includes(fakeApiKey), false);
    assert.equal(capturedOptions.method, "POST");
    assert.equal(capturedOptions.headers["x-goog-api-key"], fakeApiKey);
    assert.equal(capturedOptions.headers["Content-Type"], "application/json");
    assert.ok(capturedOptions.signal);

    const reqBody = JSON.parse(capturedOptions.body);
    assert.equal(reqBody.generationConfig.responseMimeType, "application/json");
    assert.equal(reqBody.generationConfig.temperature, 0.3);
    assert.ok(reqBody.contents[0].parts[0].text.includes("Lab 4: Query Optimization Report"));
    assert.ok(reqBody.contents[0].parts[0].text.includes("NEAR"));

    assert.equal(plan.task_id, 1);
    assert.equal(plan.deadline_category, "NEAR");
    assert.equal(plan.remaining_hours, 23.98);
    assert.equal(plan.source, "gemini");
    assert.equal(plan.model, DEFAULT_GEMINI_MODEL);
    assert.equal(plan.fallback_reason, undefined);
    assert.equal(plan.estimated_total_minutes, 90);
    assert.equal(plan.steps.length, 3);
    assert.equal(plan.steps[0].duration_minutes, 25);
    assert.ok(plan.first_action_now.includes("EXPLAIN ANALYZE"));
    assert.ok(plan.urgency_summary.includes("24 jam"));
  });

  it("falls back deterministically with missing_api_key and tailors copy for NEAR, OVERDUE, and NORMAL", async () => {
    let fetchCalled = false;
    const forbiddenFetch = async () => {
      fetchCalled = true;
      throw new Error("fetchImpl should not be called when GEMINI_API_KEY is missing");
    };

    const nearPlan = await generateTaskStudyPlan({
      task: SAMPLE_TASKS.near,
      now: referenceNow,
      apiKey: "",
      fetchImpl: forbiddenFetch
    });
    const overduePlan = await generateTaskStudyPlan({
      task: SAMPLE_TASKS.overdue,
      now: referenceNow,
      apiKey: "",
      fetchImpl: forbiddenFetch
    });
    const normalPlan = await generateTaskStudyPlan({
      task: SAMPLE_TASKS.normal,
      now: referenceNow,
      apiKey: "",
      fetchImpl: forbiddenFetch
    });

    assert.equal(fetchCalled, false);

    assert.equal(nearPlan.source, "fallback");
    assert.equal(nearPlan.fallback_reason, "missing_api_key");
    assert.equal(nearPlan.deadline_category, "NEAR");
    assert.equal(nearPlan.remaining_hours, 23.98);
    assert.ok(nearPlan.urgency_summary.includes(SAMPLE_TASKS.near.judul));
    assert.ok(nearPlan.urgency_summary.toLowerCase().includes("mendekati deadline"));
    assert.equal(
      nearPlan.estimated_total_minutes,
      nearPlan.steps.reduce((sum, s) => sum + s.duration_minutes, 0)
    );

    assert.equal(overduePlan.source, "fallback");
    assert.equal(overduePlan.fallback_reason, "missing_api_key");
    assert.equal(overduePlan.deadline_category, "OVERDUE");
    assert.equal(overduePlan.remaining_hours, -14);
    assert.ok(overduePlan.urgency_summary.includes(SAMPLE_TASKS.overdue.judul));
    assert.ok(overduePlan.urgency_summary.toLowerCase().includes("melewati deadline"));

    assert.equal(normalPlan.source, "fallback");
    assert.equal(normalPlan.fallback_reason, "missing_api_key");
    assert.equal(normalPlan.deadline_category, "NORMAL");
    assert.ok(normalPlan.remaining_hours > 24);
    assert.ok(normalPlan.urgency_summary.includes(SAMPLE_TASKS.normal.judul));
    assert.ok(normalPlan.urgency_summary.toLowerCase().includes("aman"));
  });

  it("gracefully degrades to api_unavailable on upstream HTTP 500, malformed JSON, or network error", async () => {
    const http500Fetch = async () => ({
      ok: false,
      status: 500,
      async json() {
        return { error: { message: "Internal Server Error" } };
      }
    });

    const malformedJsonFetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          candidates: [
            {
              content: {
                parts: [{ text: "{ invalid json payload" }]
              }
            }
          ]
        };
      }
    });

    const invalidSchemaFetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ urgency_summary: "Ringkas", steps: [] }) }]
              }
            }
          ]
        };
      }
    });

    const networkErrorFetch = async () => {
      throw new Error("socket hang up");
    };

    for (const failingFetch of [
      http500Fetch,
      malformedJsonFetch,
      invalidSchemaFetch,
      networkErrorFetch
    ]) {
      const plan = await generateTaskStudyPlan({
        task: SAMPLE_TASKS.near,
        now: referenceNow,
        apiKey: "fake-key",
        fetchImpl: failingFetch
      });

      assert.equal(plan.source, "fallback");
      assert.equal(plan.fallback_reason, "api_unavailable");
      assert.equal(plan.task_id, 1);
      assert.equal(plan.deadline_category, "NEAR");
      assert.ok(plan.steps.length >= 3);
      assert.ok(plan.first_action_now.length > 0);
    }
  });
});

describe("Express HTTP Integration — POST /api/tasks/:id/ai-plan (Auth & Anti-IDOR)", () => {
  let server;
  let baseUrl;
  let tempDbPath;
  let originalDbPath;
  let originalDatabaseUrl;
  let originalGeminiKey;

  before(async () => {
    originalDbPath = process.env.DB_FILE_PATH;
    originalDatabaseUrl = process.env.DATABASE_URL;
    originalGeminiKey = process.env.GEMINI_API_KEY;

    delete process.env.DATABASE_URL;
    delete process.env.GEMINI_API_KEY;

    tempDbPath = path.join(
      os.tmpdir(),
      `studytrack-ai-test-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
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
    if (originalGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it("enforces authentication (401), blocks cross-user IDOR (404), and returns structured plan (200) for owner", async () => {
    const unauthRes = await fetch(`${baseUrl}/api/tasks/1/ai-plan`, {
      method: "POST"
    });
    assert.equal(unauthRes.status, 401);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@studytrack.test", password: "demo1234" })
    });
    assert.equal(loginRes.status, 200);
    const { token: demoToken } = await loginRes.json();

    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama: "Penguji Isolasi AI",
        email: "other-ai@studytrack.test",
        password: "password123"
      })
    });
    assert.equal(regRes.status, 201);
    const { token: otherToken } = await regRes.json();

    const idorRes = await fetch(`${baseUrl}/api/tasks/1/ai-plan`, {
      method: "POST",
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.equal(idorRes.status, 404);

    const invalidIdRes = await fetch(`${baseUrl}/api/tasks/not-a-number/ai-plan`, {
      method: "POST",
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    assert.equal(invalidIdRes.status, 400);

    const ownerRes = await fetch(`${baseUrl}/api/tasks/1/ai-plan`, {
      method: "POST",
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    assert.equal(ownerRes.status, 200);

    const body = await ownerRes.json();
    assert.ok(!Number.isNaN(Date.parse(body.server_time)));
    assert.ok(body.plan);
    assert.equal(body.plan.task_id, 1);
    assert.ok(["NEAR", "OVERDUE", "NORMAL"].includes(body.plan.deadline_category));
    assert.equal(typeof body.plan.remaining_hours, "number");
    assert.equal(body.plan.source, "fallback");
    assert.equal(body.plan.fallback_reason, "missing_api_key");
    assert.ok(typeof body.plan.urgency_summary === "string" && body.plan.urgency_summary.length > 0);
    assert.ok(typeof body.plan.first_action_now === "string" && body.plan.first_action_now.length > 0);
    assert.ok(Array.isArray(body.plan.steps) && body.plan.steps.length >= 3);
    assert.ok(body.plan.estimated_total_minutes > 0);
  });
});
