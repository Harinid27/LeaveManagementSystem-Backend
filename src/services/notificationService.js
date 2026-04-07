import { Notification } from "../models/Notification.js";

export const createNotification = async ({
  userId,
  title,
  message,
  type = "leave-status",
  relatedLeaveId = null
}) =>
  Notification.create({
    userId,
    title,
    message,
    type,
    relatedLeaveId
  });
