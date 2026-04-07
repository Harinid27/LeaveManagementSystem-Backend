import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User.js";

dotenv.config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    const principalEmail = "principal@gmail.com";
    const principal = await User.findOne({ email: principalEmail, role: "principal" });

    if (!principal) {
      console.error(`Principal with email ${principalEmail} not found!`);
      process.exit(1);
    }

    console.log(`Found Principal: ${principal.name} (${principal._id})`);

    // 1. Update the Principal's own institutionId
    principal.institutionId = principal._id;
    await principal.save();
    console.log("Updated Principal's own institutionId.");

    // 2. Link all other users to this Principal's institutionId
    const result = await User.updateMany(
      { _id: { $ne: principal._id } },
      { $set: { institutionId: principal._id } }
    );

    console.log(`Migration complete. Updated ${result.modifiedCount} users.`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrate();
