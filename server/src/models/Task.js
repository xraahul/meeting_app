import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
    {
        meetingId: {
            type: String,
            required: false,
            default: ""
        },
        title: {
            type: String,
            required: true
        },
        assignee: {
            type: String,
            default: "Unassigned"
        },
        status: {
            type: String,
            enum: ["todo", "in_progress", "completed"],
            default: "todo"
        },
        team: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

const Task = mongoose.model("Task", taskSchema);

export default Task;
