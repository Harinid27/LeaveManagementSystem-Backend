import express from "express";
import {
  createUser,
  getUserById,
  getUsers,
  getSummary,
  deleteUser,
  getHierarchy,
  getActivities,
  updateProfile,
  getProfile,
  updateUserAsAdmin,
  getAllUsers,
  bulkImportUsers
} from "../controllers/userController.js";
import { authorizeRoles, verifyToken } from "../middleware/authMiddleware.js";
import { uploadCSV } from "../middleware/uploadMiddleware.js";
import {
  validateUserCreation,
  validateUserListFilter
} from "../middleware/userHierarchyMiddleware.js";
import { ROLES } from "../utils/constants.js";

const router = express.Router();

router.use(verifyToken);
router.get("/profile", getProfile); 
router.get("/summary", getSummary);
router.get("/hierarchy", getHierarchy);
router.get("/activities", getActivities);
router.get("/all", authorizeRoles(ROLES.PRINCIPAL), getAllUsers);
router.post("/bulk-import", authorizeRoles(ROLES.PRINCIPAL), uploadCSV, bulkImportUsers);
router.put("/profile", updateProfile);
router.get("/", validateUserListFilter, getUsers);
router.get("/:id", getUserById);

// Administrative update for Principal and HOD
router.put(
  "/:id", 
  authorizeRoles(ROLES.PRINCIPAL, ROLES.HOD), 
  updateUserAsAdmin
);

router.post(
  "/create",
  authorizeRoles(ROLES.PRINCIPAL, ROLES.HOD, ROLES.PROFESSOR),
  validateUserCreation,
  createUser
);

router.delete("/:id", authorizeRoles(ROLES.PRINCIPAL, ROLES.HOD), deleteUser);

export default router;
