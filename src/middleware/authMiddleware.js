import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";

export const verifyToken = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new HttpError(401, "Authorization token missing");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new HttpError(401, "User no longer exists");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(new HttpError(401, "Invalid token"));
    }

    if (error.name === "TokenExpiredError") {
      return next(new HttpError(401, "Token expired"));
    }

    next(error);
  }
};

export const authorizeRoles = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new HttpError(403, "Access denied"));
  }

  next();
};

export const checkRole = (roles) => authorizeRoles(...roles);
