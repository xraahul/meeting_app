import Notification from "../models/Notification.js";
import User from "../models/User.js";

/**
 * Create a notification and optionally emit via Socket.io.
 * @param {object} params
 * @param {import("mongoose").Types.ObjectId|string} params.userId
 * @param {"mention"|"action_item"|"task_assigned"} params.type
 * @param {string} params.title
 * @param {string} params.message
 * @param {object} [params.metadata]
 * @param {import("socket.io").Server} [params.io]
 */
export const createNotification = async ({
    userId,
    type,
    title,
    message,
    metadata = {},
    io = null
}) => {
    if (!userId) return null;

    const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        metadata
    });

    if (io) {
        io.to(`user:${userId}`).emit("notification", notification);
    }

    return notification;
};

/**
 * Notify a user by username if they exist in the database.
 */
export const notifyUserByUsername = async ({
    username,
    type,
    title,
    message,
    metadata = {},
    io = null
}) => {
    if (!username || username === "Unassigned" || username === "Guest") {
        return null;
    }

    const user = await User.findOne({
        username: { $regex: new RegExp(`^${username}$`, "i") }
    });

    if (!user) return null;

    return createNotification({
        userId: user._id,
        type,
        title,
        message,
        metadata,
        io
    });
};

/**
 * Parse @mentions from chat text and notify mentioned users.
 */
export const notifyMentions = async ({
    message,
    fromUsername,
    meetingId,
    io = null
}) => {
    const mentionPattern = /@([a-zA-Z0-9_]+)/g;
    const matches = [...message.matchAll(mentionPattern)];
    const notified = new Set();

    for (const match of matches) {
        const mentionedUsername = match[1];
        if (
            notified.has(mentionedUsername.toLowerCase()) ||
            mentionedUsername.toLowerCase() === fromUsername?.toLowerCase()
        ) {
            continue;
        }

        notified.add(mentionedUsername.toLowerCase());

        await notifyUserByUsername({
            username: mentionedUsername,
            type: "mention",
            title: "You were mentioned",
            message: `${fromUsername || "Someone"} mentioned you in a meeting chat: "${message.slice(0, 120)}${message.length > 120 ? "…" : ""}"`,
            metadata: { meetingId, fromUsername: fromUsername || "" },
            io
        });
    }
};
