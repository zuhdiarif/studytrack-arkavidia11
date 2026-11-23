import { Router } from "express";
import {
  createTask,
  deleteTask,
  findCourseByIdForUser,
  findTaskByIdForUser,
  getTasksWithCourseByUser,
  updateTask
} from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { generateTaskStudyPlan } from "../services/aiPlanner.js";
import { enrichAndSortTasks, enrichTaskWithDeadline } from "../utils/deadline.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const now = new Date();
    const rawTasks = await getTasksWithCourseByUser(req.user.id);
    const tasks = enrichAndSortTasks(rawTasks, now);
    return res.json({
      server_time: now.toISOString(),
      tasks
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const task = await findTaskByIdForUser(id, req.user.id);
    if (!task) {
      return res.status(404).json({ error: "Tugas tidak ditemukan." });
    }
    return res.json({ task: enrichTaskWithDeadline(task, new Date()) });
  } catch (err) {
    return next(err);
  }
});

router.post("/:id/ai-plan", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID tugas tidak valid." });
    }
    const task = await findTaskByIdForUser(id, req.user.id);
    if (!task) {
      return res.status(404).json({ error: "Tugas tidak ditemukan." });
    }
    const now = new Date();
    const plan = await generateTaskStudyPlan({ task, now });
    return res.json({
      server_time: now.toISOString(),
      plan
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { mata_kuliah_id, judul, deskripsi, deadline } = req.body;
    if (!mata_kuliah_id || !judul || !deadline) {
      return res.status(400).json({
        error: "mata_kuliah_id, judul, dan deadline wajib diisi."
      });
    }

    const course = await findCourseByIdForUser(Number(mata_kuliah_id), req.user.id);
    if (!course) {
      return res.status(400).json({
        error: "Mata kuliah tidak ditemukan untuk user ini."
      });
    }

    const task = await createTask({
      userId: req.user.id,
      mataKuliahId: Number(mata_kuliah_id),
      judul,
      deskripsi,
      deadline
    });
    return res.status(201).json({ task });
  } catch (err) {
    return next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { judul, deskripsi, deadline, status } = req.body;
    if (status !== undefined && !["belum", "selesai"].includes(status)) {
      return res.status(400).json({ error: "Status hanya boleh 'belum' atau 'selesai'." });
    }

    const task = await updateTask(id, req.user.id, { judul, deskripsi, deadline, status });
    if (!task) {
      return res.status(404).json({ error: "Tugas tidak ditemukan." });
    }
    return res.json({ task });
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const deleted = await deleteTask(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: "Tugas tidak ditemukan." });
    }
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
