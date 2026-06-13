import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        team: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ["Admin", "Member"],
            default: "Member"
        },
        status: {
            type: String,
            enum: ["Pending", "Accepted", "Declined"],
            default: "Pending"
        },
        token: {
            type: String,
            required: true,
            unique: true
        }
    },
    {
        timestamps: true
    }
);

const Invitation = mongoose.model("Invitation", invitationSchema);

export default Invitation;
