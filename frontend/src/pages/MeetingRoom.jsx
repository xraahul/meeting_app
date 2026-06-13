import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import io from "socket.io-client";
import Peer from "simple-peer";
import "./MeetingRoom.css";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function MeetingRoom() {
    const { roomId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    // ── Refs ────────────────────────────────────────────────────────────────
    const localVideoRef    = useRef(null);
    const socketRef        = useRef(null);
    const localStreamRef   = useRef(null);
    const peersRef         = useRef({});  // socketId -> Peer instance
    const screenStreamRef  = useRef(null);
    
    // Recording & Transcription Refs
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const recognitionRef   = useRef(null);

    // ── State ───────────────────────────────────────────────────────────────
    const [remoteStreams, setRemoteStreams] = useState([]); // [{ id, stream, username }]
    const [isMuted, setIsMuted]           = useState(false);
    const [isCamOff, setIsCamOff]         = useState(false);
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    
    // Sidebar Controls
    const [chatOpen, setChatOpen]         = useState(false);
    const [sidebarTab, setSidebarTab]     = useState("chat"); // "chat" | "notes" | "tasks"
    
    // Live Chat & Notes & Tasks
    const [messages, setMessages]         = useState([]);
    const [chatInput, setChatInput]       = useState("");
    const [notes, setNotes]               = useState("");
    const [tasks, setTasks]               = useState([]);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskAssignee, setNewTaskAssignee] = useState("");

    // Meeting status and metrics
    const [participantCount, setParticipantCount] = useState(1);
    const [copied, setCopied]             = useState(false);
    const [status, setStatus]             = useState("Connecting…");

    // Recording & Transcription States
    const [isRecording, setIsRecording]   = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [liveSubtitle, setLiveSubtitle] = useState(null); // { username, text }

    // ── Fetch Initial Notes and Tasks ────────────────────────────────────────
    useEffect(() => {
        const fetchRoomData = async () => {
            try {
                const api = (await import("../api/api")).default;
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
    const createPeer = useCallback((targetId, initiator, stream) => {
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

        peer.on("signal", (signal) => {
            socketRef.current?.emit("signal", { to: targetId, signal });
        });

        peer.on("stream", (remoteStream) => {
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

        peer.on("error", (err) => console.warn("Peer error:", err));

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
                    socketRef.current.emit("join-room", {
                        roomId,
                        username: user?.username || "Guest",
                    });
                });

                // 3. Existing users in room → initiate peers
                socketRef.current.on("existing-users", (userIds) => {
                    if (!mounted) return;
                    userIds.forEach((uid) => {
                        const peer = createPeer(uid, true, localStreamRef.current);
                        peersRef.current[uid] = peer;
                    });
                });

                // 4. New user joined
                socketRef.current.on("user-joined", ({ socketId, username }) => {
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
                socketRef.current.on("signal", ({ from, signal }) => {
                    if (!mounted) return;
                    let peer = peersRef.current[from];
                    if (!peer) {
                        peer = createPeer(from, false, localStreamRef.current);
                        peersRef.current[from] = peer;
                    }
                    try { peer.signal(signal); } catch {}
                });

                // 6. User left
                socketRef.current.on("user-left", ({ socketId }) => {
                    if (!mounted) return;
                    if (peersRef.current[socketId]) {
                        peersRef.current[socketId].destroy();
                        delete peersRef.current[socketId];
                    }
                    setRemoteStreams((prev) => prev.filter((r) => r.id !== socketId));
                    setParticipantCount((n) => Math.max(1, n - 1));
                });

                // 7. Chat
                socketRef.current.on("chat-message", (msg) => {
                    if (!mounted) return;
                    setMessages((prev) => [...prev, msg]);
                });

                // 8. Notes Sync
                socketRef.current.on("notes-update", (updatedNotes) => {
                    if (!mounted) return;
                    setNotes(updatedNotes);
                });

                // 9. Transcription Sync
                socketRef.current.on("transcript-chunk", (chunk) => {
                    if (!mounted) return;
                    setLiveSubtitle(chunk);
                });

                // 10. Tasks Sync
                socketRef.current.on("task-created", (createdTask) => {
                    if (!mounted) return;
                    setTasks((prev) => [...prev, createdTask]);
                });

                socketRef.current.on("task-updated", (updatedTask) => {
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
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setIsMuted(!track.enabled);
        }
    };

    const toggleCam = () => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setIsCamOff(!track.enabled);
        }
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
                            (s) => s.track?.kind === "video"
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
                            (s) => s.track?.kind === "video"
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
                        const api = (await import("../api/api")).default;
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

    const handleNotesChange = (e) => {
        const val = e.target.value;
        setNotes(val);
        socketRef.current?.emit("notes-edit", { roomId, notes: val });
    };

    // ── Collaborative Tasks Logic ────────────────────────────────────────────

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            const api = (await import("../api/api")).default;
            const { data: createdTask } = await api.post(`/meetings/${roomId}/tasks`, {
                title: newTaskTitle.trim(),
                assignee: newTaskAssignee || "Unassigned",
                status: "pending"
            });

            setTasks((prev) => [...prev, createdTask]);
            socketRef.current?.emit("task-created", { roomId, task: createdTask });
            setNewTaskTitle("");
            setNewTaskAssignee("");
        } catch (err) {
            console.error("Failed to create task:", err);
        }
    };

    const handleToggleTask = async (task) => {
        const newStatus = task.status === "completed" ? "pending" : "completed";
        try {
            const api = (await import("../api/api")).default;
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
            const api = (await import("../api/api")).default;
            await api.post(`/meetings/${roomId}/end`);
            
            leaveMeeting();
        } catch (err) {
            console.error("Failed to end meeting:", err);
            alert("Error ending meeting.");
        }
    };

    const sendMessage = (e) => {
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
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatTime = (iso) =>
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
                    <span className="room-logo">📡</span>
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
                        💬
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
                                            placeholder="Type a message…"
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
                        <span className="ctrl-icon">{isMuted ? "🔇" : "🎤"}</span>
                        <span className="ctrl-label">{isMuted ? "Unmute" : "Mute"}</span>
                    </button>

                    <button
                        id="ctrl-cam"
                        className={`ctrl-btn ${isCamOff ? "ctrl-btn-off" : "ctrl-btn-on"}`}
                        onClick={toggleCam}
                        title={isCamOff ? "Turn on camera" : "Turn off camera"}
                    >
                        <span className="ctrl-icon">{isCamOff ? "📷" : "📸"}</span>
                        <span className="ctrl-label">{isCamOff ? "Start Cam" : "Stop Cam"}</span>
                    </button>

                    <button
                        id="ctrl-screen"
                        className={`ctrl-btn ${isSharingScreen ? "ctrl-btn-active" : "ctrl-btn-on"}`}
                        onClick={toggleScreenShare}
                        title="Share screen"
                    >
                        <span className="ctrl-icon">🖥️</span>
                        <span className="ctrl-label">{isSharingScreen ? "Stop Share" : "Share"}</span>
                    </button>

                    {/* Live Transcription Button */}
                    <button
                        id="ctrl-transcript"
                        className={`ctrl-btn ${isTranscribing ? "ctrl-btn-active" : "ctrl-btn-on"}`}
                        onClick={toggleTranscription}
                        title="Toggle live transcription subtitles"
                    >
                        <span className="ctrl-icon">💬</span>
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
                        <span className="ctrl-icon" style={{ color: isRecording ? "var(--red)" : "inherit" }}>⏺️</span>
                        <span className="ctrl-label">{isRecording ? "Stop Rec" : "Record"}</span>
                    </button>

                    <button
                        id="ctrl-chat"
                        className={`ctrl-btn ${chatOpen ? "ctrl-btn-active" : "ctrl-btn-on"}`}
                        onClick={() => setChatOpen(!chatOpen)}
                        title="Collaboration"
                    >
                        <span className="ctrl-icon">👥</span>
                        <span className="ctrl-label">Collaborate</span>
                    </button>

                    <button
                        id="ctrl-leave"
                        className="ctrl-btn ctrl-btn-leave"
                        onClick={leaveMeeting}
                        title="Leave meeting"
                    >
                        <span className="ctrl-icon">📞</span>
                        <span className="ctrl-label">Leave</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Remote Video tile ────────────────────────────────────────────────────────
function RemoteVideo({ stream, username }) {
    const videoRef = useRef(null);

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