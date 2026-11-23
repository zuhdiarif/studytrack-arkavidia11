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

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const rawTasks = await getTasksWithCourseByUser(req.user.id);
    const tasks = [...rawTasks].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    return res.json({ tasks });
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
    return res.json({ task });
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
