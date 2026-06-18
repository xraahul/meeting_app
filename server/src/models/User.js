import mongoose from "mongoose";


const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true
        },

        email: {
            type: String,
            sparse: true
        },

        password: {
            type: String,
            required: true
        },

        avatar: {
            type: String,
            default: ""
        },

        bio: {
            type: String,
            default: ""
        },

        refreshToken: {
            type: String
        },

        role: {
            type: String,
            enum: ["Admin", "Member"],
            default: "Member"
        },

        team: {
            type: String,
            default: ""
        },

        workspaces: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Workspace"
        }]
    },
    {
        timestamps: true
    });

const User = mongoose.model("User", userSchema);

export default User;