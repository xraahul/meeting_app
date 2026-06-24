import Meeting from "../models/Meeting.js";
import Task from "../models/Task.js";
import Notification from "../models/Notification.js";
import { generateAISummary } from "../services/aiService.js";

export const summarizeMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const meeting = await Meeting.findById(id);

        if (!meeting) {
            return res.status(404).json({ message: "Meeting not found" });
        }

        if (!meeting.transcript || meeting.transcript.length === 0) {
            return res.status(400).json({ message: "No transcript available to summarize." });
        }

        // Use the shared aiService which handles OpenAI, Gemini, and NLP fallback
        const aiResponse = await generateAISummary(meeting.title, meeting.transcript);

        meeting.summary = {
            text: aiResponse.text || "",
            keyPoints: aiResponse.keyPoints || [],
            actionItems: (aiResponse.actionItems || []).map(item => ({
                task: item.task,
                assignee: item.assignee || "Unassigned",
                status: item.status || "pending"
            }))
        };

        await meeting.save();

        // Phase 3 Automations: Automatically create global tasks and send notifications
        if (meeting.summary.actionItems && meeting.summary.actionItems.length > 0) {
            for (const item of meeting.summary.actionItems) {
                await Task.create({
                    meetingId: meeting.meetingId,
                    title: item.task,
                    assignee: item.assignee,
                    status: "todo"
                });
            }
        }

        // Notify participants that summary is ready
        if (meeting.participants && meeting.participants.length > 0) {
            const notifications = meeting.participants.map(userId => ({
                userId: userId,
                type: "system",
                title: "Meeting Summary Ready",
                message: `The AI summary for ${meeting.title} is now available.`,
                read: false
            }));
            await Notification.insertMany(notifications);
        }

        res.status(200).json(meeting);
    } catch (error) {
        console.error("Error summarizing meeting:", error);
        res.status(500).json({ message: "Failed to summarize meeting", error: error.message });
    }
};
