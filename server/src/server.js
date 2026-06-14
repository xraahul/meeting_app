import "./instrument.js";
import { Server } from "socket.io";
import dotenv from "dotenv";
import app from "./app.js";
import { notifyMentions } from "./services/notificationService.js";
import { setIO } from "./config/socket.js";
import { activeConnections } from "./metrics.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

export const io = new Server(server, {
    cors: {
        origin: [
            process.env.CLIENT_URL,
            "http://localhost:5173",
            "http://127.0.0.1:5173"
        ].filter(Boolean),
        methods: ["GET", "POST"],
        credentials: true,
    }
});

setIO(io);

// Track which room each socket is in
const socketRooms = new Map();

io.on("connection", (socket) => {
    activeConnections.inc();

    console.log(`✅ User connected: ${socket.id}`);

    // ─── Join a meeting room ──────────────────────────────────────────────────
    socket.on("join-room", ({ roomId, username }) => {

        socket.join(roomId);
        socketRooms.set(socket.id, { roomId, username });

        // Notify all OTHER users already in the room
        socket.to(roomId).emit("user-joined", {
            socketId: socket.id,
            username: username || "Guest",
        });

        // Send the joiner the list of existing users in the room
        const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || [])
            .filter(id => id !== socket.id);

        socket.emit("existing-users", clients);

        console.log(`👤 ${username} joined room: ${roomId}`);
    });

    // ─── WebRTC signaling relay ───────────────────────────────────────────────
    socket.on("signal", (data) => {
        io.to(data.to).emit("signal", {
            from: socket.id,
            signal: data.signal,
        });
    });

    // ─── User notification channel ────────────────────────────────────────────
    socket.on("join-user", (userId) => {
        if (userId) {
            socket.join(`user:${userId}`);
            console.log(`🔔 Socket ${socket.id} joined user channel: user:${userId}`);
        }
    });

    // ─── Chat message relay + @mention notifications ─────────────────────────
    socket.on("chat-message", async ({ roomId, message, username }) => {
        io.to(roomId).emit("chat-message", {
            socketId: socket.id,
            username,
            message,
            timestamp: new Date().toISOString(),
        });

        try {
            await notifyMentions({
                message,
                fromUsername: username,
                meetingId: roomId,
                io
            });
        } catch (err) {
            console.error("Mention notification error:", err.message);
        }
    });

    // ─── Shared Notes sync ────────────────────────────────────────────────────
    socket.on("notes-edit", async ({ roomId, notes }) => {
        try {
            const Meeting = (await import("./models/Meeting.js")).default;
            await Meeting.findOneAndUpdate({ meetingId: roomId }, { notes });
        } catch (err) {
            console.error("Error saving notes to DB:", err.message);
        }
        socket.to(roomId).emit("notes-update", notes);
    });

    // ─── Live Transcription relay & save ──────────────────────────────────────
    socket.on("transcript-chunk", async ({ roomId, username, text }) => {
        try {
            const Meeting = (await import("./models/Meeting.js")).default;
            await Meeting.findOneAndUpdate(
                { meetingId: roomId },
                { $push: { transcript: { username, text, timestamp: new Date() } } }
            );
        } catch (err) {
            console.error("Error saving transcript chunk to DB:", err.message);
        }
        socket.to(roomId).emit("transcript-chunk", { username, text });
    });

    // ─── Real-Time Tasks sync ─────────────────────────────────────────────────
    socket.on("task-created", (data) => {
        socket.to(data.roomId).emit("task-created", data.task);
    });

    socket.on("task-updated", (data) => {
        socket.to(data.roomId).emit("task-updated", data.task);
    });

    // ─── Team Workspace Sockets ───────────────────────────────────────────────
    socket.on("join-team", (teamName) => {
        if (teamName) {
            socket.join(`team:${teamName}`);
            console.log(`👤 Socket ${socket.id} joined team channel: team:${teamName}`);
        }
    });

    socket.on("task-board-update", (data) => {
        if (data.team) {
            // Broadcast task-board-update to all team members
            socket.to(`team:${data.team}`).emit("task-board-update", data);
        }
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
        activeConnections.dec();
        const roomInfo = socketRooms.get(socket.id);

        if (roomInfo) {
            socket.to(roomInfo.roomId).emit("user-left", {
                socketId: socket.id,
                username: roomInfo.username,
            });
            socketRooms.delete(socket.id);
            console.log(`❌ ${roomInfo.username} left room: ${roomInfo.roomId}`);
        }

        console.log(`User disconnected: ${socket.id}`);
    });
});