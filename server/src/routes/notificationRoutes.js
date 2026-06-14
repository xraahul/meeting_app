import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.put("/read-all", protect, markAllNotificationsRead);
router.put("/:id/read", protect, markNotificationRead);

export default router;
