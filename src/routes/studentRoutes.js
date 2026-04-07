import express from "express";
import { getStudentDashboardData } from "../controllers/studentController.js";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { ROLES } from "../utils/constants.js";

const router = express.Router();

// All student routes are protected and require student role
router.use(verifyToken);
router.use(authorizeRoles(ROLES.STUDENT));

router.get("/dashboard", getStudentDashboardData);

export default router;
