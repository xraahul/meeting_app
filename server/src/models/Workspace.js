import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: ""
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        members: [{
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            role: { type: String, enum: ["Admin", "Editor", "Viewer"], default: "Viewer" }
        }],
        meetings: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Meeting"
        }],
        joinCode: {
            type: String,
            unique: true
        }
    },
    {
        timestamps: true
    }
);

// Auto-generate a join code before saving
workspaceSchema.pre("save", function(next) {
    if (!this.joinCode) {
        this.joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    next();
});

const Workspace = mongoose.model("Workspace", workspaceSchema);

export default Workspace;
