import { Router } from "express";
import {
  createCourse,
  deleteCourse,
  getCoursesByUser,
  updateCourse
} from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const courses = await getCoursesByUser(req.user.id);
    return res.json({ courses });
  } catch (err) {
    return next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, kode, dosen } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Nama mata kuliah wajib diisi." });
    }

    const course = await createCourse({
      userId: req.user.id,
      name,
      kode,
      dosen
    });
    return res.status(201).json({ course });
  } catch (err) {
    return next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, kode, dosen } = req.body;
    const course = await updateCourse(id, req.user.id, { name, kode, dosen });
    if (!course) {
      return res.status(404).json({ error: "Mata kuliah tidak ditemukan." });
    }
    return res.json({ course });
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const deleted = await deleteCourse(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: "Mata kuliah tidak ditemukan." });
    }
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
