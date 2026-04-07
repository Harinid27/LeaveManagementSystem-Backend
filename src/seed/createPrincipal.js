import dotenv from "dotenv";
import { connectDb } from "../config/db.js";
import { User } from "../models/User.js";
import { ROLES } from "../utils/constants.js";

dotenv.config();

const createPrincipal = async () => {
  try {
    await connectDb();

    const email = process.env.PRINCIPAL_EMAIL?.toLowerCase().trim();
    const existingPrincipal = await User.findOne({ email });

    if (existingPrincipal) {
      console.log("Principal already exists:", email);
      process.exit(0);
    }

    const principal = await User.create({
      name: process.env.PRINCIPAL_NAME || "Principal Admin",
      email,
      password: process.env.PRINCIPAL_PASSWORD || "Admin@123",
      role: ROLES.PRINCIPAL,
      department: process.env.PRINCIPAL_DEPARTMENT || "Administration",
      createdBy: null,
      reportingTo: null
    });

    console.log("Principal created successfully:", principal.email);
    process.exit(0);
  } catch (error) {
    console.error("Failed to create principal:", error.message);
    process.exit(1);
  }
};

createPrincipal();
