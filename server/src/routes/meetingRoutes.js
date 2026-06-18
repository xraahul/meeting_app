import express from "express";

import protect, { optionalProtect } from "../middleware/authMiddleware.js";

import {
    createMeeting,
    getMeetings,
    getMeetingById,
    deleteMeeting,
    endMeeting,
    uploadRecording,
    saveNotes,
    getTasks,
    createOrUpdateTask,
    updateTaskStatus,
    getAnalytics,
    getTeamTasks
} from "../controllers/meetingController.js";

import { summarizeMeeting } from "../controllers/aiController.js";

import recordingUpload from "../middleware/recordingUpload.js";

const router = express.Router();

// Specific analytics and dashboard endpoints must be above parametric /:id routes
router.get("/dashboard/analytics", protect, getAnalytics);
router.get("/dashboard/team-tasks", protect, getTeamTasks);

router.post("/", optionalProtect, createMeeting);

router.get("/", protect, getMeetings);

router.get("/:id", optionalProtect, getMeetingById);

router.delete("/:id", protect, deleteMeeting);

router.post("/:id/end", optionalProtect, endMeeting);

router.post("/:id/summarize", optionalProtect, summarizeMeeting);

router.post("/:id/recording", optionalProtect, recordingUpload.single("recording"), uploadRecording);

router.post("/:id/notes", optionalProtect, saveNotes);

router.get("/:id/tasks", optionalProtect, getTasks);

router.post("/:id/tasks", optionalProtect, createOrUpdateTask);

router.put("/tasks/:taskId", optionalProtect, updateTaskStatus);

export default router;