import mongoose from "mongoose";
import { LEAVE_STATUS, APPROVAL_ACTION } from "../utils/constants.js";

const approvalStepSchema = new mongoose.Schema(
  {
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: Object.values(APPROVAL_ACTION),
      default: APPROVAL_ACTION.PENDING
    },
    remarks: {
      type: String,
      default: ""
    },
    actionDate: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const leaveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    leaveType: {
      type: String,
      required: true,
      trim: true
    },
    fromDate: {
      type: Date,
      required: true
    },
    toDate: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    proofFile: {
      fileName: {
        type: String,
        default: ""
      },
      originalName: {
        type: String,
        default: ""
      },
      mimeType: {
        type: String,
        default: ""
      },
      filePath: {
        type: String,
        default: ""
      },
      fileUrl: {
        type: String,
        default: ""
      }
    },
    status: {
      type: String,
      enum: Object.values(LEAVE_STATUS),
      default: LEAVE_STATUS.PENDING
    },
    currentApprover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    approvalFlow: {
      type: [approvalStepSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const Leave = mongoose.model("Leave", leaveSchema);
