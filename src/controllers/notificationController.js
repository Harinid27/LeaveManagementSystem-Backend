import { Notification } from "../models/Notification.js";
import { notFound } from "../utils/httpError.js";

export const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
};

export const markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!notification) {
      notFound("Notification not found");
    }

    notification.isRead = true;
    await notification.save();

    res.json({
      message: "Notification marked as read",
      notification
    });
  } catch (error) {
    next(error);
  }
};
