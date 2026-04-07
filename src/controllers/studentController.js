import { Leave } from "../models/Leave.js";
import { User } from "../models/User.js";
import { LEAVE_STATUS } from "../utils/constants.js";
import { HttpError } from "../utils/httpError.js";

/**
 * @desc    Get student dashboard summary and recent leaves
 * @route   GET /api/student/dashboard
 * @access  Private (Student only)
 */
export const getStudentDashboardData = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [stats, recentLeaves, studentProfile] = await Promise.all([
      Leave.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalLeaves: { $sum: 1 },
            approvedLeaves: {
              $sum: { $cond: [{ $eq: ["$status", LEAVE_STATUS.APPROVED] }, 1, 0] }
            },
            pendingLeaves: {
              $sum: { $cond: [{ $eq: ["$status", LEAVE_STATUS.PENDING] }, 1, 0] }
            },
            rejectedLeaves: {
              $sum: { $cond: [{ $eq: ["$status", LEAVE_STATUS.REJECTED] }, 1, 0] }
            }
          }
        }
      ]),
      Leave.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("currentApprover", "name role"),
      User.findById(userId)
        .populate("reportingTo", "name role department")
        .select("-password")
    ]);

    const dashboardStats = stats[0] || {
      totalLeaves: 0,
      approvedLeaves: 0,
      pendingLeaves: 0,
      rejectedLeaves: 0
    };

    res.json({
      stats: dashboardStats,
      recentLeaves,
      profile: studentProfile
    });
  } catch (error) {
    next(error);
  }
};
