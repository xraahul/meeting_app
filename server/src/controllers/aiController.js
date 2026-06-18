import OpenAI from "openai";
import Meeting from "../models/Meeting.js";
import Task from "../models/Task.js";
import Notification from "../models/Notification.js";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy-key-for-development",
});

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

        // Format transcript for OpenAI
        const formattedTranscript = meeting.transcript
            .map((t) => `[${t.username}]: ${t.text}`)
            .join("\n");

        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "dummy-key-for-development") {
            const prompt = `You are an AI meeting assistant. Analyze the following meeting transcript. Provide a concise summary, an array of key points, and an array of actionable tasks. Format the output strictly as a JSON object with this exact structure: 
            { 
              "summaryText": "Brief paragraph summary", 
              "keyPoints": ["Point 1", "Point 2"], 
              "actionItems": [
                { "task": "Description of task", "assignee": "Name or Unassigned" }
              ] 
            }
            
            Transcript:
            ${formattedTranscript}
            `;

            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "gpt-3.5-turbo",
                response_format: { type: "json_object" }
            });

            const aiResponse = JSON.parse(completion.choices[0].message.content);

            meeting.summary = {
                text: aiResponse.summaryText || "",
                keyPoints: aiResponse.keyPoints || [],
                actionItems: (aiResponse.actionItems || []).map(item => ({
                    task: item.task,
                    assignee: item.assignee,
                    status: "pending"
                }))
            };
        } else {
            // Development fallback / Mock response
            meeting.summary = {
                text: "Mock Summary: This is an automatically generated summary because no OpenAI key was provided. The meeting discussed several important topics.",
                keyPoints: ["Discussed project timelines", "Agreed on new UI changes"],
                actionItems: [
                    { task: "Update the landing page UI", assignee: "Unassigned", status: "pending" }
                ]
            };
        }

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
