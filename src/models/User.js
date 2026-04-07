import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ROLE_LABELS } from "../utils/constants.js";

const leaveBalanceSchema = new mongoose.Schema(
  {
    casualLeave: {
      type: Number,
      default: 10
    },
    sickLeave: {
      type: Number,
      default: 8
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ROLE_LABELS,
      required: true
    },
    department: {
      type: String,
      required: true,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reportingTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    leaveBalance: {
      type: leaveBalanceSchema,
      default: () => ({})
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department,
    createdBy: this.createdBy,
    reportingTo: this.reportingTo,
    leaveBalance: this.leaveBalance,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export const User = mongoose.model("User", userSchema);
