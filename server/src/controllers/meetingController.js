import { v4 as uuidv4 } from "uuid";

import Meeting from "../models/Meeting.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { generateAISummary } from "../services/aiService.js";
import redisClient from "../config/redis.js";

export const createMeeting = async (req, res) => {

    try {

        const meeting = await Meeting.create({
            title: req.body.title,
            meetingId: uuidv4(),
            host: req.user ? req.user.userId : undefined
        });

        res.status(201).json(meeting);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });
    }
};

export const getMeetings = async (req, res) => {

    try {

        const meetings = await Meeting.find()
            .populate("host", "username email");

        res.status(200).json(meetings);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });
    }
};

export const getMeetingById = async (req, res) => {

    try {
        if (redisClient && redisClient.isReady) {
            const cachedMeeting = await redisClient.get(`meeting:${req.params.id}`);
            if (cachedMeeting) {
                return res.status(200).json(JSON.parse(cachedMeeting));
            }
        }

        const meeting = await Meeting.findOne({
            meetingId: req.params.id
        });

        if (!meeting) {
            return res.status(404).json({
                message: "Meeting not found"
            });
        }

        if (redisClient && redisClient.isReady) {
            await redisClient.setEx(`meeting:${req.params.id}`, 3600, JSON.stringify(meeting));
        }

        res.status(200).json(meeting);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });
    }
};

export const deleteMeeting = async (req, res) => {

    try {

        const meeting = await Meeting.findOne({
            meetingId: req.params.id
        });

        if (!meeting) {
            return res.status(404).json({
                message: "Meeting not found"
            });
        }

        await meeting.deleteOne();

        if (redisClient && redisClient.isReady) {
            await redisClient.del(`meeting:${req.params.id}`);
        }

        res.status(200).json({
            message: "Meeting deleted"
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });
    }
};

// ─── END MEETING & GENERATE AI SUMMARY ───────────────────────────────────────
export const endMeeting = async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ meetingId: req.params.id });

        if (!meeting) {
            return res.status(404).json({ message: "Meeting not found" });
        }

        meeting.status = "ended";
        meeting.endedAt = new Date();

        // Generate AI Summary
        const aiSummary = await generateAISummary(meeting.title, meeting.transcript);
        meeting.summary = aiSummary;

        await meeting.save();

        if (redisClient && redisClient.isReady) {
            await redisClient.del(`meeting:${req.params.id}`);
        }

        // Create tasks in Task collection from AI action items
        if (aiSummary.actionItems && aiSummary.actionItems.length > 0) {
            const tasksToInsert = aiSummary.actionItems.map((item) => ({
                meetingId: meeting.meetingId,
                title: item.task,
                assignee: item.assignee || "Unassigned",
                status: "pending"
            }));
            await Task.insertMany(tasksToInsert);
        }

        res.status(200).json({
            message: "Meeting ended and summary generated",
            meeting
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── UPLOAD RECORDING ────────────────────────────────────────────────────────
export const uploadRecording = async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ meetingId: req.params.id });
        if (!meeting) {
            return res.status(404).json({ message: "Meeting not found" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No recording file provided" });
        }

        // Construct public URL
        const hostname = req.get("host");
        const protocol = req.protocol;
        const recordingUrl = `${protocol}://${hostname}/uploads/recordings/${req.file.filename}`;

        meeting.recordingUrl = recordingUrl;
        await meeting.save();

        if (redisClient && redisClient.isReady) {
            await redisClient.del(`meeting:${req.params.id}`);
        }

        res.status(200).json({
            message: "Recording uploaded successfully",
            recordingUrl
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── SAVE NOTES ──────────────────────────────────────────────────────────────
export const saveNotes = async (req, res) => {
    try {
        const { notes } = req.body;
        const meeting = await Meeting.findOneAndUpdate(
            { meetingId: req.params.id },
            { notes },
            { new: true }
        );

        if (!meeting) {
            return res.status(404).json({ message: "Meeting not found" });
        }

        if (redisClient && redisClient.isReady) {
            await redisClient.del(`meeting:${req.params.id}`);
        }

        res.status(200).json({ message: "Notes saved successfully", notes: meeting.notes });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── GET TASKS ───────────────────────────────────────────────────────────────
export const getTasks = async (req, res) => {
    try {
        const tasks = await Task.find({ meetingId: req.params.id });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── CREATE OR UPDATE TASK ───────────────────────────────────────────────────
export const createOrUpdateTask = async (req, res) => {
    try {
        const { title, assignee, status, taskId } = req.body;
        const user = req.user ? await User.findById(req.user.userId) : null;
        const teamName = user ? user.team : "";

        if (taskId) {
            // Update
            const task = await Task.findByIdAndUpdate(
                taskId,
                { title, assignee, status },
                { new: true }
            );
            return res.status(200).json(task);
        }

        // Create
        const task = await Task.create({
            meetingId: req.params.id || "",
            title,
            assignee: assignee || "Unassigned",
            status: status || "todo",
            team: teamName
        });

        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── UPDATE TASK STATUS ──────────────────────────────────────────────────────
export const updateTaskStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const task = await Task.findByIdAndUpdate(
            req.params.taskId,
            { status },
            { new: true }
        );

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── GET TEAM TASKS (KANBAN) ────────────────────────────────────────────────
export const getTeamTasks = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // If user belongs to a team, show team tasks. Otherwise show tasks with empty team.
        const query = user.team ? { team: user.team } : { team: "" };
        const tasks = await Task.find(query);
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── GET MEETING ANALYTICS & INSIGHTS ────────────────────────────────────────
export const getAnalytics = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // 1. Gather all team member userIds
        let userIds = [user._id];
        if (user.team) {
            const teamUsers = await User.find({ team: user.team }, "_id");
            userIds = teamUsers.map((u) => u._id);
        }

        // 2. Fetch all meetings involving host or participants from team
        const meetings = await Meeting.find({
            $or: [
                { host: { $in: userIds } },
                { participants: { $in: userIds } }
            ]
        });

        // 3. Fetch all tasks for the team
        const taskQuery = user.team ? { team: user.team } : { team: "" };
        const tasks = await Task.find(taskQuery);

        const endedMeetings = meetings.filter((m) => m.status === "ended");

        // 4. Calculate Meeting Frequency over last 7 days
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            last7Days.push({
                date: dateStr,
                count: 0
            });
        }

        meetings.forEach((m) => {
            const mDateStr = new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const foundDay = last7Days.find((day) => day.date === mDateStr);
            if (foundDay) {
                foundDay.count += 1;
            }
        });

        // 5. Calculate Task metrics
        const todoCount = tasks.filter((t) => t.status === "todo").length;
        const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
        const completedCount = tasks.filter((t) => t.status === "completed").length;

        // 6. Calculate Engagement and Productivity
        let totalTranscriptTurns = 0;
        let totalParticipantsCount = 0;

        endedMeetings.forEach((m) => {
            totalTranscriptTurns += m.transcript ? m.transcript.length : 0;
            totalParticipantsCount += m.participants ? m.participants.length : 0;
        });

        const avgParticipants = endedMeetings.length > 0 
            ? Math.round((totalParticipantsCount / endedMeetings.length) * 10) / 10 
            : 0;

        // Mock engagement factor: message count is estimated from chat actions
        const totalMessagesSimulated = Math.round(totalTranscriptTurns * 1.5 + meetings.length * 3);

        res.status(200).json({
            meetingsCount: meetings.length,
            endedMeetingsCount: endedMeetings.length,
            activeMeetingsCount: meetings.filter((m) => m.status !== "ended").length,
            tasksCount: tasks.length,
            tasksBreakdown: {
                todo: todoCount,
                in_progress: inProgressCount,
                completed: completedCount
            },
            meetingFrequency: last7Days,
            productivity: {
                completionRate: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
                avgParticipants,
                transcriptTurns: totalTranscriptTurns,
                messagesSent: totalMessagesSimulated
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};