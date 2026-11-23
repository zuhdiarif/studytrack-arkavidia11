import React, { useCallback, useEffect, useState } from "react";
import api from "../api.js";
import Navbar from "../components/Navbar.jsx";
import TaskCard from "../components/TaskCard.jsx";

const AUTO_REFRESH_MS = 5 * 60 * 1000;

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [serverTime, setServerTime] = useState("");
  const [courseId, setCourseId] = useState("");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [tasksRes, coursesRes] = await Promise.all([
        api.get("/tasks"),
        api.get("/courses")
      ]);
      setTasks(tasksRes.data.tasks || []);
      setServerTime(tasksRes.data.server_time || "");
      setCourses(coursesRes.data.courses || []);
    } catch (err) {
      setError(err.response?.data?.error || "Gagal memuat data tugas.");
    }
  }, []);

  useEffect(() => {
    loadData();

    const intervalId = setInterval(loadData, AUTO_REFRESH_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadData]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!courseId) {
      setError("Pilih mata kuliah terlebih dahulu.");
      return;
    }
    try {
      await api.post("/tasks", { mata_kuliah_id: courseId, judul, deskripsi, deadline });
      setJudul("");
      setDeskripsi("");
      setDeadline("");
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menambahkan tugas.");
    }
  }

  async function handleToggleStatus(task) {
    const newStatus = task.status === "selesai" ? "belum" : "selesai";
    await api.put(`/tasks/${task.id}`, { status: newStatus });
    loadData();
  }

  async function handleDelete(id) {
    await api.delete(`/tasks/${id}`);
    loadData();
  }

  const nearCount = tasks.filter((t) => t.deadline_category === "NEAR").length;
  const overdueCount = tasks.filter((t) => t.deadline_category === "OVERDUE").length;
  const normalCount = tasks.filter(
    (t) => !t.deadline_category || t.deadline_category === "NORMAL"
  ).length;

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="page-header">
          <h1>Daftar Tugas</h1>
          {serverTime && (
            <span className="server-clock-meta">
              Sinkron server:{" "}
              {new Date(serverTime).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit"
              })}
            </span>
          )}
        </div>

        <div className="summary-strip" aria-label="Ringkasan status deadline">
          <div className="summary-item near">
            <span className="summary-label">Mendekati Deadline</span>
            <strong className="summary-count">{nearCount}</strong>
          </div>
          <div className="summary-item overdue">
            <span className="summary-label">Terlambat</span>
            <strong className="summary-count">{overdueCount}</strong>
          </div>
          <div className="summary-item normal">
            <span className="summary-label">Normal</span>
            <strong className="summary-count">{normalCount}</strong>
          </div>
        </div>

        <div className="card">
          <h2>Tambah Tugas</h2>
          <form onSubmit={handleSubmit}>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
              <option value="">-- Pilih Mata Kuliah --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.kode ? `${c.kode} · ${c.name}` : c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Judul Tugas"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              required
            />
            <textarea
              placeholder="Deskripsi (opsional)"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={2}
            />
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
            {error && <p className="error">{error}</p>}
            <button type="submit">Tambah Tugas</button>
          </form>
        </div>

        {tasks.length === 0 && <p>Belum ada tugas. Tambahkan tugas pertama Anda di atas.</p>}

        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </>
  );
}
