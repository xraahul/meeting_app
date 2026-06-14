import axios from "axios";

/**
 * Generates an AI summary, key points, and action items from a meeting transcript.
 * @param {string} meetingTitle - Title of the meeting.
 * @param {Array} transcript - List of transcript entries { username, text, timestamp }.
 * @returns {Promise<object>} Summary payload.
 */
export const generateAISummary = async (meetingTitle, transcript) => {
    const transcriptText = transcript
        .map((t) => `${t.username || "Unknown"}: ${t.text}`)
        .join("\n");

    const participants = [...new Set(transcript.map((t) => t.username || "Participant"))].filter(Boolean);

    const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
    const useOpenAI = !!process.env.OPENAI_API_KEY;

    if (apiKey) {
        try {
            const prompt = `
            You are an AI meeting assistant. Analyze the following meeting transcript for the meeting titled "${meetingTitle}".
            Provide a response strictly in JSON format. Do not add any markdown formattings, backticks, or text before/after the JSON.
            
            The JSON response must have exactly this structure:
            {
              "text": "A brief overall summary paragraph of what was discussed.",
              "keyPoints": [
                "Key point or topic 1",
                "Key point or topic 2"
              ],
              "actionItems": [
                {
                  "task": "Specific task description",
                  "assignee": "Name of the participant assigned to it (must be chosen from: ${participants.join(", ") || "Unassigned"}. If not clear, use 'Unassigned')",
                  "status": "pending"
                }
              ]
            }

            Transcript:
            ${transcriptText || "No discussion recorded."}
            `;

            if (useOpenAI) {
                const response = await axios.post(
                    "https://api.openai.com/v1/chat/completions",
                    {
                        model: "gpt-4o-mini",
                        messages: [{ role: "user", content: prompt }],
                        response_format: { type: "json_object" }
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            "Content-Type": "application/json"
                        }
                    }
                );
                const rawText = response.data?.choices?.[0]?.message?.content;
                if (rawText) {
                    const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                    return JSON.parse(cleanedText);
                }
            } else {
                const url = `https://generativetext.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
                const response = await axios.post(url, {
                    contents: [{ parts: [{ text: prompt }] }]
                });

                const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (rawText) {
                    const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                    return JSON.parse(cleanedText);
                }
            }
        } catch (error) {
            console.error(`${useOpenAI ? "OpenAI" : "Gemini"} API Error, falling back to NLP summarizer:`, error.message);
        }
    }

    // ─── NLP Fallback Summarizer ──────────────────────────────────────────────
    console.log("Using local NLP fallback summarizer for meeting summary.");

    if (!transcriptText || transcript.length === 0) {
        return {
            text: `The meeting "${meetingTitle}" had no spoken transcript recorded. No discussions were captured.`,
            keyPoints: ["No topics discussed during the meeting."],
            actionItems: []
        };
    }

    const sentences = transcript.map((t) => ({
        user: t.username || "Participant",
        text: t.text
    }));

    // Generate summary text
    const text = `The meeting "${meetingTitle}" was held with participants: ${participants.join(", ")}. The conversation centered around setting up collaboration, coordinating tasks, and addressing real-time updates. Live transcription captured ${transcript.length} turns of conversation.`;

    // Extract key points
    const keyPoints = [];
    const keywords = ["discuss", "progress", "setup", "error", "server", "code", "design", "ui", "api", "database"];
    
    sentences.forEach((s) => {
        const lower = s.text.toLowerCase();
        if (keywords.some((kw) => lower.includes(kw)) && keyPoints.length < 5) {
            keyPoints.push(`${s.user} pointed out: "${s.text.slice(0, 80)}${s.text.length > 80 ? "..." : ""}"`);
        }
    });

    if (keyPoints.length === 0) {
        keyPoints.push("General updates and check-ins between participants.");
        keyPoints.push("Reviewing current status and next steps.");
    }

    // Extract action items
    const actionItems = [];
    const actionPhrases = ["will do", "should check", "assign", "todo", "make sure", "fix", "update", "need to", "task"];

    sentences.forEach((s) => {
        const lower = s.text.toLowerCase();
        if (actionPhrases.some((ph) => lower.includes(ph)) && actionItems.length < 5) {
            // Pick an assignee from participants or current speaker
            let assignee = "Unassigned";
            for (const p of participants) {
                if (lower.includes(p.toLowerCase())) {
                    assignee = p;
                    break;
                }
            }
            if (assignee === "Unassigned" && Math.random() > 0.3) {
                assignee = s.user;
            }

            actionItems.push({
                task: s.text,
                assignee,
                status: "pending"
            });
        }
    });

    // If still no action items, add a generic one
    if (actionItems.length === 0) {
        actionItems.push({
            task: "Follow up on discussion topics and outline next milestones.",
            assignee: participants[0] || "Unassigned",
            status: "pending"
        });
    }

    return { text, keyPoints, actionItems };
};
