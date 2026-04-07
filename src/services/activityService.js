import { ActivityLog } from "../models/ActivityLog.js";

export const logActivity = async ({ actorId, action, targetId, targetType, description, metadata }) => {
  try {
    const log = await ActivityLog.create({
      actorId,
      action,
      targetId,
      targetType,
      description,
      metadata
    });
    return log;
  } catch (error) {
    console.error("Activity Logging Error:", error.message);
  }
};

export const getRecentActivities = async (filter = {}, limit = 10) => {
  return ActivityLog.find(filter)
    .populate("actorId", "name role email")
    .sort({ createdAt: -1 })
    .limit(limit);
};
