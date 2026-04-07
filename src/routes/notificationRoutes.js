import express from "express";
import {
  getMyNotifications,
  markNotificationAsRead
} from "../controllers/notificationController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken);
router.get("/", getMyNotifications);
router.put("/:id/read", markNotificationAsRead);

export default router;
