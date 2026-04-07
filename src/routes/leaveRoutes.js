import express from "express";
import {
  applyLeave,
  approveLeave,
  getLeaveAnalytics,
  getMyLeaves,
  getPendingApprovals,
  rejectLeave
} from "../controllers/leaveController.js";
import { authorizeRoles, verifyToken } from "../middleware/authMiddleware.js";
import { uploadLeaveProof } from "../middleware/uploadMiddleware.js";
import { ROLES } from "../utils/constants.js";

const router = express.Router();

router.use(verifyToken);
router.post("/apply", uploadLeaveProof, applyLeave);
router.get("/my", getMyLeaves);
router.get("/pending", getPendingApprovals);
router.get("/analytics", authorizeRoles(ROLES.PRINCIPAL, ROLES.HOD), getLeaveAnalytics);
router.put("/:id/approve", approveLeave);
router.put("/:id/reject", rejectLeave);

export default router;
