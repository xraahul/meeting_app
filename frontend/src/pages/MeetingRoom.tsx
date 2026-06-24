import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import io, { type Socket } from "socket.io-client";
import Peer from "simple-peer";
import type { ChatMessage, RemoteStream, Task } from "../types";
import api from "../api/api";
import { Mic, MicOff, Video, VideoOff, MonitorUp, MessageSquare, PhoneOff, Users, CircleDot } from "lucide-react";
import "./MeetingRoom.css";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";

type LiveSubtitle = { username: string; text: string; roomId?: string };

export default function MeetingRoom() {
    const { roomId } = useParams<{ roomId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peersRef = useRef<Record<string, InstanceType<typeof Peer>>>({});
    const screenStreamRef = useRef<MediaStream | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

    const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isCamOff, setIsCamOff] = useState(false);
    const [isSharingScreen, setIsSharingScreen] = useState(false);

    const [chatOpen, setChatOpen] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<"chat" | "notes" | "tasks">("chat");

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [notes, setNotes] = useState("");
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskAssignee, setNewTaskAssignee] = useState("");

    const [participantCount, setParticipantCount] = useState(1);
    const [copied, setCopied] = useState(false);
    const [status, setStatus] = useState("Connecting…");

    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [liveSubtitle, setLiveSubtitle] = useState<LiveSubtitle | null>(null);

    // ── Fetch Initial Notes and Tasks ────────────────────────────────────────
    useEffect(() => {
        const fetchRoomData = async () => {
            try {
                const { data: meeting } = await api.get(`/meetings/${roomId}`);
                if (meeting.notes) setNotes(meeting.notes);

                const { data: fetchedTasks } = await api.get(`/meetings/${roomId}/tasks`);
                setTasks(fetchedTasks);
            } catch (err) {
                console.error("Error fetching initial meeting data:", err);
            }
        };

        if (status === "Connected") {
            fetchRoomData();
        }
    }, [roomId, status]);

    // ── Clear subtitle after a timeout ───────────────────────────────────────
    useEffect(() => {
        if (liveSubtitle) {
            const timer = setTimeout(() => setLiveSubtitle(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [liveSubtitle]);

    // ── Create a peer connection ─────────────────────────────────────────────
    const createPeer = useCallback((targetId: string, initiator: boolean, stream: MediaStream | null) => {
        const peer = new Peer({
            initiator,
            trickle: true,
            stream,
            config: {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                ],
            },
        });

        peer.on("signal", (signal: unknown) => {
            socketRef.current?.emit("signal", { to: targetId, signal });
        });

        peer.on("stream", (remoteStream: MediaStream) => {
            setRemoteStreams((prev) => {
                const exists = prev.find((r) => r.id === targetId);
                if (exists) {
                    return prev.map((r) =>
                        r.id === targetId ? { ...r, stream: remoteStream } : r
                    );
                }
                return [...prev, { id: targetId, stream: remoteStream, username: "Participant" }];
            });
            setParticipantCount((n) => n + 1);
        });

        peer.on("error", (err: Error) => console.warn("Peer error:", err));

        return peer;
    }, []);

    // ── Main setup effect ────────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                // 1. Get local media
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });

                if (!mounted) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.play().catch(() => {});
                }

                // 2. Connect socket
                socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });

                socketRef.current.on("connect", () => {
                    if (!mounted) return;
                    setStatus("Connected");
                    socketRef.current?.emit("join-room", {
                        roomId,
                        username: user?.username || "Guest",
                    });
                    const userId = user?.id || user?._id;
                    if (userId) {
                        socketRef.current?.emit("join-user", userId);
                    }
                });

                // 3. Existing users in room → initiate peers
                socketRef.current.on("existing-users", (userIds: string[]) => {
                    if (!mounted) return;
                    userIds.forEach((uid) => {
                        const peer = createPeer(uid, true, localStreamRef.current);
                        peersRef.current[uid] = peer;
                    });
                });

                // 4. New user joined
                socketRef.current.on("user-joined", ({ socketId, username }: { socketId: string; username: string }) => {
                    if (!mounted) return;
                    if (!peersRef.current[socketId]) {
                        const peer = createPeer(socketId, false, localStreamRef.current);
                        peersRef.current[socketId] = peer;
                        setRemoteStreams((prev) => {
                            const exists = prev.find((r) => r.id === socketId);
                            if (exists) {
                                return prev.map((r) => r.id === socketId ? { ...r, username } : r);
                            }
                            return prev;
                        });
                    }
                });

                // 5. Signal relay
                socketRef.current.on("signal", ({ from, signal }: { from: string; signal: unknown }) => {
                    if (!mounted) return;
                    let peer = peersRef.current[from];
                    if (!peer) {
                        peer = createPeer(from, false, localStreamRef.current);
                        peersRef.current[from] = peer;
                    }
                    try { peer.signal(signal as never); } catch { /* ignore */ }
                });

                // 6. User left
                socketRef.current.on("user-left", ({ socketId }: { socketId: string }) => {
                    if (!mounted) return;
                    if (peersRef.current[socketId]) {
                        peersRef.current[socketId].destroy();
                        delete peersRef.current[socketId];
                    }
                    setRemoteStreams((prev) => prev.filter((r) => r.id !== socketId));
                    setParticipantCount((n) => Math.max(1, n - 1));
                });

                // 7. Chat
                socketRef.current.on("chat-message", (msg: ChatMessage) => {
                    if (!mounted) return;
                    setMessages((prev) => [...prev, msg]);
                });

                // 8. Notes Sync
                socketRef.current.on("notes-update", (updatedNotes: string) => {
                    if (!mounted) return;
                    setNotes(updatedNotes);
                });

                // 9. Transcription Sync
                socketRef.current.on("transcript-chunk", (chunk: LiveSubtitle) => {
                    if (!mounted) return;
                    setLiveSubtitle(chunk);
                });

                // 10. Tasks Sync
                socketRef.current.on("task-created", (createdTask: Task) => {
                    if (!mounted) return;
                    setTasks((prev) => [...prev, createdTask]);
                });

                socketRef.current.on("task-updated", (updatedTask: Task) => {
                    if (!mounted) return;
                    setTasks((prev) =>
                        prev.map((t) => t._id === updatedTask._id ? updatedTask : t)
                    );
                });

            } catch (err) {
                if (!mounted) return;
                console.error("Media error:", err);
                setStatus("Camera/mic access denied");
            }
        };

        init();

        return () => {
            mounted = false;
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            screenStreamRef.current?.getTracks().forEach((t) => t.stop());
            Object.values(peersRef.current).forEach((p) => p.destroy());
            peersRef.current = {};
            socketRef.current?.disconnect();
            
            // Stop speech recognition
            if (recognitionRef.current) {
                recognitionRef.current.onend = null;
                recognitionRef.current.stop();
            }
        };
    }, [roomId, user, createPeer]);

    // ── Video/Audio Controls ──────────────────────────────────────────────────

    const toggleMute = () => {
        setIsMuted((prev) => {
            const newMuted = !prev;
            if (localStreamRef.current) {
                const track = localStreamRef.current.getAudioTracks()[0];
                if (track) {
                    track.enabled = !newMuted;
                }
            }
            return newMuted;
        });
    };

    const toggleCam = () => {
        setIsCamOff((prev) => {
            const newCamOff = !prev;
            if (localStreamRef.current) {
                const track = localStreamRef.current.getVideoTracks()[0];
                if (track) {
                    track.enabled = !newCamOff;
                }
            }
            return newCamOff;
        });
    };

    const toggleScreenShare = async () => {
        if (isSharingScreen) {
            screenStreamRef.current?.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
            const camTrack = localStreamRef.current?.getVideoTracks()[0];
            if (camTrack) {
                Object.values(peersRef.current).forEach((p) => {
                    try {
                        const sender = p._pc?.getSenders?.().find(
                            (s: RTCRtpSender) => s.track?.kind === "video"
                        );
                        sender?.replaceTrack(camTrack);
                    } catch {}
                });
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStreamRef.current;
                }
            }
            setIsSharingScreen(false);
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                });
                screenStreamRef.current = screenStream;
                const screenTrack = screenStream.getVideoTracks()[0];

                Object.values(peersRef.current).forEach((p) => {
                    try {
                        const sender = p._pc?.getSenders?.().find(
                            (s: RTCRtpSender) => s.track?.kind === "video"
                        );
                        sender?.replaceTrack(screenTrack);
                    } catch {}
                });

                if (localVideoRef.current) {
                    const mixed = new MediaStream([
                        screenTrack,
                        ...(localStreamRef.current?.getAudioTracks() || []),
                    ]);
                    localVideoRef.current.srcObject = mixed;
                }

                screenTrack.onended = () => {
                    setIsSharingScreen(false);
                    screenStreamRef.current = null;
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = localStreamRef.current;
                    }
                };

                setIsSharingScreen(true);
            } catch {
                // User cancelled
            }
        }
    };

    // ── MediaRecorder Recording Logic ────────────────────────────────────────

    const toggleRecording = () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
        } else {
            recordedChunksRef.current = [];
            const stream = localStreamRef.current;
            if (!stream) {
                alert("No stream available to record!");
                return;
            }

            let options = { mimeType: "video/webm;codecs=vp9" };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: "video/webm;codecs=vp8" };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = { mimeType: "video/webm" };
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                        options = { mimeType: "" };
                    }
                }
            }

            try {
                const recorder = new MediaRecorder(stream, options);
                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        recordedChunksRef.current.push(e.data);
                    }
                };

                recorder.onstop = async () => {
                    const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
                    
                    // 1. Download Locally
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.style.display = "none";
                    a.href = url;
                    a.download = `meeting-${roomId}-${Date.now()}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    }, 100);

                    // 2. Upload to Server
                    const formData = new FormData();
                    formData.append("recording", blob, "recording.webm");
                    try {
                        await api.post(`/meetings/${roomId}/recording`, formData, {
                            headers: { "Content-Type": "multipart/form-data" }
                        });
                    } catch (err) {
                        console.error("Recording upload failed:", err);
                    }
                };

                mediaRecorderRef.current = recorder;
                recorder.start(1000); // chunk slices
                setIsRecording(true);
            } catch (err) {
                console.error("MediaRecorder start failed:", err);
            }
        }
    };

    // ── SpeechRecognition Transcription Logic ───────────────────────────────

    const toggleTranscription = () => {
        if (isTranscribing) {
            if (recognitionRef.current) {
                recognitionRef.current.onend = null;
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
            setIsTranscribing(false);
        } else {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert("Speech recognition is not supported in this browser. Please use Chrome/Safari.");
                return;
            }

            const rec = new SpeechRecognition();
            rec.continuous = true;
            rec.interimResults = false;
            rec.lang = "en-US";

            rec.onresult = (event) => {
                const text = event.results[event.results.length - 1][0].transcript;
                const entry = {
                    roomId,
                    username: user?.username || "Guest",
                    text: text.trim()
                };
                socketRef.current?.emit("transcript-chunk", entry);
                setLiveSubtitle(entry);
            };

            rec.onerror = (e) => console.error("Speech Recognition Error:", e);
            rec.onend = () => {
                if (isTranscribing && recognitionRef.current) {
                    rec.start(); // Keep listening
                }
            };

            recognitionRef.current = rec;
            rec.start();
            setIsTranscribing(true);
        }
    };

    // ── Collaborative Notes Logic ────────────────────────────────────────────

    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setNotes(val);
        socketRef.current?.emit("notes-edit", { roomId, notes: val });
    };

    // ── Collaborative Tasks Logic ────────────────────────────────────────────

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            const { data: createdTask } = await api.post(`/meetings/${roomId}/tasks`, {
                title: newTaskTitle.trim(),
                assignee: newTaskAssignee || "Unassigned",
                status: "todo"
            });

            setTasks((prev) => [...prev, createdTask]);
            socketRef.current?.emit("task-created", { roomId, task: createdTask });
            setNewTaskTitle("");
            setNewTaskAssignee("");
        } catch (err) {
            console.error("Failed to create task:", err);
        }
    };

    const handleToggleTask = async (task: Task) => {
        const newStatus = task.status === "completed" ? "todo" : "completed";
        try {
            const { data: updatedTask } = await api.put(`/meetings/tasks/${task._id}`, {
                status: newStatus
            });

            setTasks((prev) =>
                prev.map((t) => t._id === task._id ? updatedTask : t)
            );
            socketRef.current?.emit("task-updated", { roomId, task: updatedTask });
        } catch (err) {
            console.error("Failed to update task status:", err);
        }
    };

    // ── Meeting Leave and End Logic ──────────────────────────────────────────

    const leaveMeeting = () => {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        Object.values(peersRef.current).forEach((p) => p.destroy());
        socketRef.current?.disconnect();
        navigate("/dashboard");
    };

    const handleEndMeeting = async () => {
        if (!confirm("Are you sure you want to end this meeting for all? This will generate the AI summary and close the room.")) return;
        try {
            await api.post(`/meetings/${roomId}/end`);
            
            // Trigger AI Summary Generation
            console.log("Triggering AI Summarization...");
            // We do not await this, so it runs in background and notifies users later
            api.post(`/meetings/${roomId}/summarize`).catch(e => console.error("Summary failed", e));
            
            leaveMeeting();
        } catch (err: any) {
            console.error("Failed to end meeting:", err);
            const msg = err.response?.data?.message || err.message;
            alert(`Error ending meeting: ${msg}`);
        }
    };

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        socketRef.current?.emit("chat-message", {
            roomId,
            message: chatInput.trim(),
            username: user?.username || "Me",
        });
        setMessages((prev) => [
            ...prev,
            {
                socketId: "me",
                username: user?.username || "Me",
                message: chatInput.trim(),
                timestamp: new Date().toISOString(),
            },
        ]);
        setChatInput("");
    };

    const copyLink = () => {
        if (!roomId) return;
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    // Compile active participant names for assignee dropdown selection
    const participantsList = [
        user?.username || "You",
        ...remoteStreams.map((r) => r.username)
    ];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="room-page">

            {/* ── Top Bar ── */}
            <header className="room-header">
                <div className="room-info">
                    <span className="room-logo" style={{ display: 'flex', alignItems: 'center' }}>
                        <img src="/logo.png" alt="IntellMeet Logo" style={{ height: '32px', borderRadius: '50%' }} />
                    </span>
                    <div>
                        <div className="room-id-label">
                            Room ID: <code>{roomId?.slice(0, 8)}…</code>
                        </div>
                        <div className="room-status-indicator">
                            <span
                                className="status-dot"
                                style={{ background: status === "Connected" ? "var(--green)" : "var(--yellow)" }}
                            />
                            {status}
                        </div>
                    </div>
                </div>

                <div className="room-header-actions">
                    <div className="badge badge-purple">
                        👥 {participantCount} participant{participantCount !== 1 ? "s" : ""}
                    </div>

                    <button
                        id="copy-room-link"
                        className="btn btn-secondary"
                        onClick={copyLink}
                    >
                        {copied ? "✅ Copied!" : "🔗 Copy Link"}
                    </button>

                    <button
                        id="toggle-chat"
                        className="btn btn-secondary btn-icon"
                        onClick={() => setChatOpen(!chatOpen)}
                        title="Toggle collaboration sidebar"
                    >
                        <MessageSquare size={18} />
                    </button>

                    <button
                        id="end-meeting-btn"
                        className="btn btn-danger"
                        onClick={handleEndMeeting}
                    >
                        🛑 End for All
                    </button>
                </div>
            </header>

            {/* ── Content ── */}
            <div className="room-content">

                {/* ── Subtitles Overlay ── */}
                {liveSubtitle && (
                    <div className="subtitles-overlay">
                        <span className="subtitles-user">{liveSubtitle.username}:</span>
                        <span>{liveSubtitle.text}</span>
                    </div>
                )}

                {/* ── Video Grid ── */}
                <div className={`video-grid ${remoteStreams.length === 0 ? "solo" : ""} ${chatOpen ? "with-chat" : ""}`}>

                    {/* Local video */}
                    <div className="video-tile local-tile">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className={isCamOff ? "video-hidden" : ""}
                        />
                        {isCamOff && (
                            <div className="video-avatar">
                                {(user?.username || "Y").slice(0, 2).toUpperCase()}
                            </div>
                        )}
                        <div className="video-label">
                            <span>{user?.username || "You"} (You)</span>
                            {isMuted && <span className="muted-badge">🔇</span>}
                            {isSharingScreen && <span className="screen-badge">🖥️</span>}
                        </div>
                    </div>

                    {/* Remote videos */}
                    {remoteStreams.map(({ id, stream, username }) => (
                        <RemoteVideo
                            key={id}
                            stream={stream}
                            username={username}
                        />
                    ))}
                </div>

                {/* ── Collaboration Sidebar Panel ── */}
                {chatOpen && (
                    <div className="chat-panel">
                        
                        {/* Sidebar Tabs */}
                        <div className="sidebar-tabs">
                            <button
                                className={`tab-btn ${sidebarTab === "chat" ? "active" : ""}`}
                                onClick={() => setSidebarTab("chat")}
                            >
                                💬 Chat
                            </button>
                            <button
                                className={`tab-btn ${sidebarTab === "notes" ? "active" : ""}`}
                                onClick={() => setSidebarTab("notes")}
                            >
                                📝 Notes
                            </button>
                            <button
                                className={`tab-btn ${sidebarTab === "tasks" ? "active" : ""}`}
                                onClick={() => setSidebarTab("tasks")}
                            >
                                ✅ Tasks
                            </button>
                        </div>

                        {/* Sidebar Tab Content */}
                        <div className="tab-content">
                            
                            {/* 1. Live Chat */}
                            {sidebarTab === "chat" && (
                                <>
                                    <div className="chat-messages">
                                        {messages.length === 0 && (
                                            <div className="chat-empty">No messages yet. Say hi! 👋</div>
                                        )}
                                        {messages.map((msg, i) => (
                                            <div
                                                key={i}
                                                className={`chat-msg ${msg.socketId === "me" ? "chat-msg-me" : ""}`}
                                            >
                                                <div className="chat-msg-meta">
                                                    <span className="chat-msg-user">{msg.username}</span>
                                                    <span className="chat-msg-time">{formatTime(msg.timestamp)}</span>
                                                </div>
                                                <div className="chat-msg-text">{msg.message}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <form className="chat-input-row" onSubmit={sendMessage}>
                                        <input
                                            id="chat-input"
                                            className="input-field"
                                            placeholder="Type a message… Use @username to mention"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            autoComplete="off"
                                        />
                                        <button
                                            id="chat-send"
                                            type="submit"
                                            className="btn btn-primary btn-icon"
                                        >
                                            ↑
                                        </button>
                                    </form>
                                </>
                            )}

                            {/* 2. Collaborative Notes */}
                            {sidebarTab === "notes" && (
                                <div className="notes-container">
                                    <h4 style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "500" }}>
                                        Collaborative Notepad (Real-time Synced)
                                    </h4>
                                    <textarea
                                        id="notes-editor"
                                        className="notes-textarea"
                                        placeholder="Type meeting notes here. Everyone in the room will see changes in real-time."
                                        value={notes}
                                        onChange={handleNotesChange}
                                    />
                                </div>
                            )}

                            {/* 3. Action Items Board */}
                            {sidebarTab === "tasks" && (
                                <div className="tasks-container">
                                    <h4 style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "500", marginBottom: "8px" }}>
                                        Meeting Action Items
                                    </h4>

                                    {/* Add Task Form */}
                                    <form onSubmit={handleAddTask} style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                                        <input
                                            id="task-title-input"
                                            className="input-field"
                                            style={{ height: "32px", fontSize: "12px" }}
                                            placeholder="Task title..."
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            required
                                        />
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <select
                                                id="task-assignee-select"
                                                className="input-field"
                                                style={{ height: "32px", fontSize: "12px", flex: 1, padding: "0 6px", background: "var(--bg-input)" }}
                                                value={newTaskAssignee}
                                                onChange={(e) => setNewTaskAssignee(e.target.value)}
                                            >
                                                <option value="">Select Assignee</option>
                                                {participantsList.map((p, idx) => (
                                                    <option key={idx} value={p}>{p}</option>
                                                ))}
                                            </select>
                                            <button
                                                id="task-add-btn"
                                                type="submit"
                                                className="btn btn-primary"
                                                style={{ height: "32px", fontSize: "12px", padding: "0 12px" }}
                                            >
                                                + Add
                                            </button>
                                        </div>
                                    </form>

                                    {/* Tasks Roster */}
                                    <div className="task-list">
                                        {tasks.length === 0 ? (
                                            <div className="chat-empty" style={{ marginTop: "20px" }}>No tasks created yet.</div>
                                        ) : (
                                            tasks.map((task) => (
                                                <div key={task._id} className={`task-item ${task.status === "completed" ? "completed" : ""}`}>
                                                    <input
                                                        type="checkbox"
                                                        className="task-checkbox"
                                                        checked={task.status === "completed"}
                                                        onChange={() => handleToggleTask(task)}
                                                    />
                                                    <div className="task-details">
                                                        <span className="task-title-text">{task.title}</span>
                                                        <span className="task-assignee-tag">👤 {task.assignee}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>

            {/* ── Control Bar ── */}
            <div className="control-bar">
                <div className="controls">

                    <button
                        id="ctrl-mute"
                        className={`ctrl-btn ${isMuted ? "ctrl-btn-off" : "ctrl-btn-on"}`}
                        onClick={toggleMute}
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        <span className="ctrl-icon">{isMuted ? <MicOff size={20} /> : <Mic size={20} />}</span>
                        <span className="ctrl-label">{isMuted ? "Unmute" : "Mute"}</span>
                    </button>

                    <button
                        id="ctrl-cam"
                        className={`ctrl-btn ${isCamOff ? "ctrl-btn-off" : "ctrl-btn-on"}`}
                        onClick={toggleCam}
                        title={isCamOff ? "Turn on camera" : "Turn off camera"}
                    >
                        <span className="ctrl-icon">{isCamOff ? <VideoOff size={20} /> : <Video size={20} />}</span>
                        <span className="ctrl-label">{isCamOff ? "Start Cam" : "Stop Cam"}</span>
                    </button>

                    <button
                        id="ctrl-screen"
                        className={`ctrl-btn ${isSharingScreen ? "ctrl-btn-active" : "ctrl-btn-on"}`}
                        onClick={toggleScreenShare}
                        title="Share screen"
                    >
                        <span className="ctrl-icon"><MonitorUp size={20} /></span>
                        <span className="ctrl-label">{isSharingScreen ? "Stop Share" : "Share"}</span>
                    </button>

                    {/* Live Transcription Button */}
                    <button
                        id="ctrl-transcript"
                        className={`ctrl-btn ${isTranscribing ? "ctrl-btn-active" : "ctrl-btn-on"}`}
                        onClick={toggleTranscription}
                        title="Toggle live transcription subtitles"
                    >
                        <span className="ctrl-icon"><MessageSquare size={20} /></span>
                        <span className="ctrl-label">{isTranscribing ? "Captions On" : "Captions"}</span>
                    </button>

                    {/* Recording Button */}
                    <button
                        id="ctrl-record"
                        className={`ctrl-btn ${isRecording ? "ctrl-btn-active" : "ctrl-btn-on"}`}
                        onClick={toggleRecording}
                        title="Record meeting local & cloud storage"
                        style={{ border: isRecording ? "1px solid rgba(239,68,68,0.4)" : "1px solid var(--border)" }}
                    >
                        <span className="ctrl-icon" style={{ color: isRecording ? "var(--red)" : "inherit" }}><CircleDot size={20} /></span>
                        <span className="ctrl-label">{isRecording ? "Stop Rec" : "Record"}</span>
                    </button>

                    <button
                        id="ctrl-chat"
                        className={`ctrl-btn ${chatOpen ? "ctrl-btn-active" : "ctrl-btn-on"}`}
                        onClick={() => setChatOpen(!chatOpen)}
                        title="Collaboration"
                    >
                        <span className="ctrl-icon"><Users size={20} /></span>
                        <span className="ctrl-label">Collaborate</span>
                    </button>

                    <button
                        id="ctrl-leave"
                        className="ctrl-btn ctrl-btn-leave"
                        onClick={leaveMeeting}
                        title="Leave meeting"
                    >
                        <span className="ctrl-icon"><PhoneOff size={20} /></span>
                        <span className="ctrl-label">Leave</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Remote Video tile ────────────────────────────────────────────────────────
function RemoteVideo({ stream, username }: { stream: MediaStream; username: string }) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="video-tile">
            <video ref={videoRef} autoPlay playsInline />
            <div className="video-label">
                <span>{username || "Participant"}</span>
            </div>
        </div>
    );
}