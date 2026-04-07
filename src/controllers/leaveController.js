import { Leave } from "../models/Leave.js";
import { User } from "../models/User.js";
import { createNotification } from "../services/notificationService.js";
import { buildApprovalChain } from "../services/hierarchyService.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { APPROVAL_ACTION, LEAVE_STATUS, ROLES } from "../utils/constants.js";
import { requireFields, validateDateRange } from "../utils/validation.js";
import { logActivity } from "../services/activityService.js";

const leaveQueryPopulate = [
  { path: "userId", select: "name email role department" },
  { path: "currentApprover", select: "name email role department" },
  { path: "approvalFlow.approverId", select: "name email role department" }
];

export const applyLeave = async (req, res, next) => {
  try {
    requireFields(req.body, ["leaveType", "fromDate", "toDate", "reason"]);
    validateDateRange(req.body.fromDate, req.body.toDate);

    const chain = await buildApprovalChain(req.user._id);

    if (!chain.length) {
      throw new HttpError(400, "No reporting hierarchy found for this user");
    }

    const leave = await Leave.create({
      userId: req.user._id,
      leaveType: req.body.leaveType,
      fromDate: req.body.fromDate,
      toDate: req.body.toDate,
      reason: req.body.reason,
      proofFile: req.file
        ? {
            fileName: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            filePath: req.file.path,
            fileUrl: `/uploads/leave-proofs/${req.file.filename}`
          }
        : undefined,
      status: LEAVE_STATUS.PENDING,
      currentApprover: chain[0]._id,
      approvalFlow: chain.map((approver) => ({
        approverId: approver._id,
        status: APPROVAL_ACTION.PENDING
      }))
    });

    const populatedLeave = await Leave.findById(leave._id).populate(leaveQueryPopulate);

    res.status(201).json({
      message: "Leave applied successfully",
      leave: populatedLeave
    });
  } catch (error) {
    next(error);
  }
};

export const getMyLeaves = async (req, res, next) => {
  try {
    const leaves = await Leave.find({ userId: req.user._id })
      .populate(leaveQueryPopulate)
      .sort({ createdAt: -1 });

    res.json({ leaves });
  } catch (error) {
    next(error);
  }
};

export const getPendingApprovals = async (req, res, next) => {
  try {
    const leaves = await Leave.find({
      currentApprover: req.user._id,
      status: LEAVE_STATUS.PENDING
    })
      .populate(leaveQueryPopulate)
      .sort({ createdAt: -1 });

    res.json({ leaves });
  } catch (error) {
    next(error);
  }
};

export const getLeaveAnalytics = async (req, res, next) => {
  try {
    const matchStage = {};

    if (req.user.role === ROLES.HOD) {
      const departmentUsers = await User.find({ department: req.user.department }).select("_id");
      matchStage.userId = { $in: departmentUsers.map((user) => user._id) };
    } else if (![ROLES.PRINCIPAL, ROLES.HOD].includes(req.user.role)) {
      throw new HttpError(403, "Only principal and HOD can view leave analytics");
    }

    const [totalsResult, departmentResult] = await Promise.all([
      Leave.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalLeaves: { $sum: 1 },
            approvedLeaves: {
              $sum: {
                $cond: [{ $eq: ["$status", LEAVE_STATUS.APPROVED] }, 1, 0]
              }
            },
            rejectedLeaves: {
              $sum: {
                $cond: [{ $eq: ["$status", LEAVE_STATUS.REJECTED] }, 1, 0]
              }
            },
            pendingLeaves: {
              $sum: {
                $cond: [{ $eq: ["$status", LEAVE_STATUS.PENDING] }, 1, 0]
              }
            }
          }
        }
      ]),
      Leave.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $group: {
            _id: "$user.department",
            total: { $sum: 1 }
          }
        },
        { $sort: { total: -1, _id: 1 } }
      ])
    ]);

    const totals = totalsResult[0] || {
      totalLeaves: 0,
      approvedLeaves: 0,
      rejectedLeaves: 0,
      pendingLeaves: 0
    };

    res.json({
      totals,
      departmentBreakdown: departmentResult.map((item) => ({
        department: item._id || "Unassigned",
        total: item.total
      }))
    });
  } catch (error) {
    next(error);
  }
};

const updateLeaveStatus = async (req, res, next, action) => {
  try {
    const leave = await Leave.findById(req.params.id).populate("userId", "name");

    if (!leave) {
      notFound("Leave request not found");
    }

    if (`${leave.currentApprover}` !== `${req.user._id}`) {
      throw new HttpError(403, "You are not the current approver for this leave");
    }

    if (leave.status !== LEAVE_STATUS.PENDING) {
      throw new HttpError(400, "This leave request is already closed");
    }

    const flowIndex = leave.approvalFlow.findIndex(
      (item) => `${item.approverId}` === `${req.user._id}`
    );

    if (flowIndex === -1) {
      throw new HttpError(400, "Approval step not found");
    }

    leave.approvalFlow[flowIndex].status = action;
    leave.approvalFlow[flowIndex].remarks = req.body.remarks || "";
    leave.approvalFlow[flowIndex].actionDate = new Date();

    if (action === APPROVAL_ACTION.REJECTED) {
      leave.status = LEAVE_STATUS.REJECTED;
      leave.currentApprover = null;
    } else {
      const nextStep = leave.approvalFlow.slice(flowIndex + 1).find((item) => item);

      if (!nextStep) {
        leave.status = LEAVE_STATUS.APPROVED;
        leave.currentApprover = null;
      } else {
        leave.currentApprover = nextStep.approverId;
      }
    }

    await leave.save();

    await createNotification({
      userId: leave.userId._id,
      title: `Leave ${action}`,
      message:
        action === APPROVAL_ACTION.APPROVED
          ? leave.status === LEAVE_STATUS.APPROVED
            ? "Your leave request has been fully approved."
            : "Your leave request moved to the next approver."
          : "Your leave request has been rejected.",
      relatedLeaveId: leave._id
    });

    // Integrated Logging
    await logActivity({
      actorId: req.user._id,
      action: `leave_${action.toLowerCase()}`,
      targetId: leave._id,
      targetType: "Leave",
      description: `${req.user.name} (${req.user.role}) ${action.toLowerCase()}ed leave for ${leave.userId.name}. ${leave.status === LEAVE_STATUS.APPROVED ? "Final approval granted." : ""}`,
      metadata: { remarks: req.body.remarks || "" }
    });

    const populatedLeave = await Leave.findById(leave._id).populate(leaveQueryPopulate);

    res.json({
      message: `Leave ${action} successfully`,
      leave: populatedLeave
    });
  } catch (error) {
    next(error);
  }
};

export const approveLeave = (req, res, next) =>
  updateLeaveStatus(req, res, next, APPROVAL_ACTION.APPROVED);

export const rejectLeave = (req, res, next) =>
  updateLeaveStatus(req, res, next, APPROVAL_ACTION.REJECTED);
