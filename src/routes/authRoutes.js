import express from "express";
import { getCurrentUser, login, register } from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", verifyToken, getCurrentUser);

export default router;
