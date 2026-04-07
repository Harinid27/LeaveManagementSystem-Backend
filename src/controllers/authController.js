import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { requireFields } from "../utils/validation.js";
import { ROLES } from "../utils/constants.js";

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });

const buildAuthResponse = (user) => ({
  token: signToken(user),
  user: user.toSafeObject()
});

export const register = async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "email", "password"]);

    const principalExists = await User.exists({ role: ROLES.PRINCIPAL });
    if (principalExists) {
      throw new HttpError(403, "Initial principal account already exists");
    }

    const email = req.body.email.toLowerCase().trim();
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw new HttpError(409, "User with this email already exists");
    }

    const user = await User.create({
      name: req.body.name,
      email,
      password: req.body.password,
      role: ROLES.PRINCIPAL,
      department: req.body.department || "Administration",
      reportingTo: null,
      createdBy: null
    });

    res.status(201).json({
      message: "Principal registered successfully",
      ...buildAuthResponse(user)
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    requireFields(req.body, ["email", "password"]);

    const user = await User.findOne({ email: req.body.email.toLowerCase().trim() });

    if (!user || !(await user.comparePassword(req.body.password))) {
      throw new HttpError(401, "Invalid email or password");
    }

    res.json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
};
