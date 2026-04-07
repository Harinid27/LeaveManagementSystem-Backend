import { HttpError } from "../utils/httpError.js";
import { requireFields } from "../utils/validation.js";
import {
  canCreateRole,
  ensureDepartmentAccess,
  getVisibleRolesForUser
} from "../services/hierarchyService.js";

export const validateUserCreation = (req, _res, next) => {
  try {
    requireFields(req.body, ["name", "email", "password", "role", "department"]);

    const { role, department } = req.body;

    if (!canCreateRole(req.user.role, role)) {
      throw new HttpError(
        403,
        `${req.user.role} can only create users directly below their hierarchy`
      );
    }

    ensureDepartmentAccess(req.user, department);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateUserListFilter = (req, _res, next) => {
  try {
    if (!req.query.role) {
      return next();
    }

    const visibleRoles = getVisibleRolesForUser(req.user);

    if (!visibleRoles.includes(req.query.role)) {
      throw new HttpError(403, "You are not allowed to view users for this role");
    }

    next();
  } catch (error) {
    next(error);
  }
};
