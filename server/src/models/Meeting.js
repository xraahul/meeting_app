import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true
        },

        meetingId: {
            type: String,
            required: true,
            unique: true
        },

        host: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        participants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],

        status: {
            type: String,
            enum: ["active", "ended"],
            default: "active"
        },

        endedAt: {
            type: Date
        },

        transcript: [{
            username: { type: String },
            text: { type: String },
            timestamp: { type: Date, default: Date.now }
        }],

        notes: {
            type: String,
            default: ""
        },

        summary: {
            text: { type: String, default: "" },
            keyPoints: [{ type: String }],
            actionItems: [{
                task: { type: String },
                assignee: { type: String },
                status: { type: String, enum: ["pending", "completed"], default: "pending" }
            }]
        },

        recordingUrl: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    });

const Meeting = mongoose.model(
    "Meeting",
    meetingSchema
);

export default Meeting;