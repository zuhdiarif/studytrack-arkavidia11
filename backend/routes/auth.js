import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createUser, findUserByEmail } from "../db.js";
import { JWT_SECRET } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function signToken(user) {
  return jwt.sign(
    { sub: user.id, nama: user.nama, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

router.post("/register", async (req, res, next) => {
  try {
    const { nama, email, password } = req.body;

    if (!nama || !email || !password) {
      return res.status(400).json({ error: "Nama, email, dan password wajib diisi." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password minimal 6 karakter." });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "Email sudah terdaftar." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await createUser({ nama, email, passwordHash });

    const token = signToken(newUser);
    return res.status(201).json({
      token,
      user: { id: newUser.id, nama: newUser.nama, email: newUser.email }
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email sudah terdaftar." });
    }
    return next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email dan password wajib diisi." });
    }

    const user = await findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Email atau password salah." });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, nama: user.nama, email: user.email }
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
