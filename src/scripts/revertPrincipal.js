import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User.js";

dotenv.config();

const revert = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    // 1. Find the correct Principal
    const mainPrincipalEmail = "principal@example.com";
    const mainPrincipal = await User.findOne({ email: mainPrincipalEmail });

    if (!mainPrincipal) {
      console.error(`Main Principal ${mainPrincipalEmail} not found!`);
      process.exit(1);
    }

    console.log(`Found Main Principal: ${mainPrincipal.name} (${mainPrincipal._id})`);

    // 2. Assign the Main Principal as their own institution root
    mainPrincipal.institutionId = mainPrincipal._id;
    await mainPrincipal.save();

    // 3. Re-assign all other users back to this Principal
    const updateResult = await User.updateMany(
      { email: { $ne: mainPrincipalEmail }, role: { $ne: "student" } }, // Update HODs and Profs
      { $set: { institutionId: mainPrincipal._id, reportingTo: mainPrincipal._id } }
    );
    
    // Note: This logic assumes HODs report to Principal. For Profs/Students, it's more complex.
    // However, to simply fix the "Visibility" and "Primary Authority" for HODs:
    await User.updateMany(
        { role: "hod" },
        { $set: { institutionId: mainPrincipal._id, reportingTo: mainPrincipal._id } }
    );
    
    // Ensure all users are in the same institution bubble
    await User.updateMany(
        { _id: { $ne: mainPrincipal._id } },
        { $set: { institutionId: mainPrincipal._id } }
    );

    console.log(`Re-assigned visible data back to ${mainPrincipalEmail}.`);

    // 4. Delete the duplicate Gmail account
    const deleteResult = await User.deleteOne({ email: "principal@gmail.com" });
    if (deleteResult.deletedCount > 0) {
      console.log("Successfully deleted principal@gmail.com.");
    } else {
      console.log("principal@gmail.com was not found or already deleted.");
    }

    console.log("Cleanup complete.");
    process.exit(0);
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  }
};

revert();
