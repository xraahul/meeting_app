import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import io, { type Socket } from "socket.io-client";
import api from "../api/api";
import NotificationBell from "../components/NotificationBell";
import type { Meeting, Task, Analytics, TeamMember, Invitation, Toast } from "../types";
import "./Dashboard.css";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";

type DashboardView = "meetings" | "history" | "board" | "analytics" | "team";

export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const socketRef = useRef<Socket | null>(null);

    const [currentView, setCurrentView] = useState<DashboardView>("meetings");

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [toast, setToast] = useState<Toast | null>(null);
    const [joinInput, setJoinInput] = useState("");

    const [historySearch, setHistorySearch] = useState("");
    const [selectedPastMeeting, setSelectedPastMeeting] = useState<Meeting | null>(null);
    const [pastMeetingTasks, setPastMeetingTasks] = useState<Task[]>([]);
    const [loadingPastTasks, setLoadingPastTasks] = useState(false);

    const [boardTasks, setBoardTasks] = useState<Task[]>([]);
    const [loadingBoard, setLoadingBoard] = useState(true);
    const [newBoardTaskTitle, setNewBoardTaskTitle] = useState("");
    const [newBoardTaskAssignee, setNewBoardTaskAssignee] = useState("");

    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);

    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("Member");
    const [inviteTeamName, setInviteTeamName] = useState(user?.team || "");
    const [inviting, setInviting] = useState(false);

    // ── Fetch active meetings ────────────────────────────────────────────────
    const fetchMeetings = useCallback(async () => {
        try {
            const { data } = await api.get("/meetings");
            setMeetings(data);
        } catch {
            showToast("Failed to load meetings", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Fetch Kanban board tasks ─────────────────────────────────────────────
    const fetchBoardTasks = useCallback(async () => {
        setLoadingBoard(true);
        try {
            const { data } = await api.get("/meetings/dashboard/team-tasks");
            setBoardTasks(data);
        } catch {
            showToast("Failed to load project board tasks", "error");
        } finally {
            setLoadingBoard(false);
        }
    }, []);

    // ── Fetch Analytics reports ──────────────────────────────────────────────
    const fetchAnalytics = useCallback(async () => {
        setLoadingAnalytics(true);
        try {
            const { data } = await api.get("/meetings/dashboard/analytics");
            setAnalytics(data);
        } catch {
            showToast("Failed to load analytics report", "error");
        } finally {
            setLoadingAnalytics(false);
        }
    }, []);

    // ── Fetch Team and Invitations roster ────────────────────────────────────
    const fetchTeamData = useCallback(async () => {
        if (!user) return;
        try {
            if (user.team) {
                const { data: members } = await api.get("/auth/team");
                setTeamMembers(members);
            } else {
                setTeamMembers([]);
            }
            const { data: invites } = await api.get("/auth/invitations");
            setPendingInvites(invites);
        } catch (err) {
            console.error("Failed to load team data:", err);
        }
    }, [user]);

    // ── Primary load trigger ─────────────────────────────────────────────────
    useEffect(() => {
        fetchMeetings();
        fetchBoardTasks();
        fetchTeamData();
    }, [fetchMeetings, fetchBoardTasks, fetchTeamData]);

    // ── Listen for view change to trigger analytics load ────────────────────
    useEffect(() => {
        if (currentView === "analytics") {
            fetchAnalytics();
        }
    }, [currentView, fetchAnalytics]);

    // ── Establish Real-Time Sockets for Kanban board sync ────────────────────
    useEffect(() => {
        if (user?.team) {
            socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });
            socketRef.current.emit("join-team", user.team);

            // Listen to team updates
            socketRef.current.on("task-board-update", (_data: { team?: string }) => {
                fetchBoardTasks();
                if (currentView === "analytics") {
                    fetchAnalytics();
                }
            });
        }

        return () => {
            socketRef.current?.disconnect();
        };
    }, [user, currentView, fetchBoardTasks, fetchAnalytics]);

    // ── Toast helper ────────────────────────────────────────────────────────
    const showToast = (msg: string, type: Toast["type"] = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ── Create meeting ──────────────────────────────────────────────────────
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;

        setCreating(true);
        try {
            const { data } = await api.post("/meetings", { title: newTitle.trim() });
            setMeetings((prev) => [data, ...prev]);
            setNewTitle("");
            setShowCreate(false);
            showToast(`Meeting "${data.title}" created!`);
        } catch {
            showToast("Failed to create meeting", "error");
        } finally {
            setCreating(false);
        }
    };

    // ── Delete meeting ──────────────────────────────────────────────────────
    const handleDelete = async (meetingId: string, title: string) => {
        if (!confirm(`Delete "${title}"?`)) return;
        try {
            await api.delete(`/meetings/${meetingId}`);
            setMeetings((prev) => prev.filter((m) => m.meetingId !== meetingId));
            showToast("Meeting deleted");
        } catch {
            showToast("Failed to delete meeting", "error");
        }
    };

    // ── Copy invite link ────────────────────────────────────────────────────
    const copyLink = (meetingId: string) => {
        const link = `${window.location.origin}/room/${meetingId}`;
        navigator.clipboard.writeText(link);
        setCopiedId(meetingId);
        showToast("Invite link copied!");
        setTimeout(() => setCopiedId(null), 2000);
    };

    // ── Join meeting (from card) ─────────────────────────────────────────────
    const handleJoin = (meetingId: string) => navigate(`/room/${meetingId}`);

    const handleJoinById = (e: React.FormEvent) => {
        e.preventDefault();
        const raw = joinInput.trim();
        if (!raw) return;

        let roomId = raw;
        try {
            const url = new URL(raw);
            const parts = url.pathname.split("/");
            const idx = parts.indexOf("room");
            if (idx !== -1 && parts[idx + 1]) {
                roomId = parts[idx + 1];
            }
        } catch {
            // bare ID
        }

        setJoinInput("");
        navigate(`/room/${roomId}`);
    };

    // ── Open Past Meeting Detail ────────────────────────────────────────────
    const openPastMeetingDetails = async (meeting: Meeting) => {
        setSelectedPastMeeting(meeting);
        setLoadingPastTasks(true);
        try {
            const { data } = await api.get(`/meetings/${meeting.meetingId}/tasks`);
            setPastMeetingTasks(data);
        } catch (err) {
            console.error("Failed to load tasks for past meeting:", err);
            setPastMeetingTasks([]);
        } finally {
            setLoadingPastTasks(false);
        }
    };

    // ── Toggle Task Status in Past Meeting Details ──────────────────────────
    const handleTogglePastTask = async (task: Task) => {
        const newStatus = task.status === "completed" ? "todo" : "completed";
        try {
            const { data: updatedTask } = await api.put(`/meetings/tasks/${task._id}`, {
                status: newStatus
            });
            setPastMeetingTasks((prev) =>
                prev.map((t) => t._id === task._id ? updatedTask : t)
            );
            // Also notify socket team
            socketRef.current?.emit("task-board-update", { team: user?.team });
            showToast("Action item status updated!");
        } catch (err) {
            console.error("Failed to toggle task:", err);
            showToast("Failed to update task", "error");
        }
    };

    // ── Kanban Board Task Submission ─────────────────────────────────────────
    const handleAddBoardTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBoardTaskTitle.trim()) return;

        try {
            const { data } = await api.post("/meetings/none/tasks", {
                title: newBoardTaskTitle.trim(),
                assignee: newBoardTaskAssignee || "Unassigned",
                status: "todo"
            });

            setBoardTasks((prev) => [...prev, data]);
            setNewBoardTaskTitle("");
            setNewBoardTaskAssignee("");
            
            // Sync with team sockets
            socketRef.current?.emit("task-board-update", { team: user?.team });
            showToast("Task created successfully!");
        } catch {
            showToast("Failed to create task", "error");
        }
    };

    // ── Move Kanban Task Status ──────────────────────────────────────────────
    const handleMoveBoardTask = async (task: Task, targetStatus: Task["status"]) => {
        try {
            const { data } = await api.put(`/meetings/tasks/${task._id}`, {
                status: targetStatus
            });
            setBoardTasks((prev) =>
                prev.map((t) => t._id === task._id ? data : t)
            );
            // Notify team sockets
            socketRef.current?.emit("task-board-update", { team: user?.team });
        } catch {
            showToast("Failed to move task status", "error");
        }
    };

    // ── Team Invitation Submission ──────────────────────────────────────────
    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !inviteTeamName.trim()) return;

        setInviting(true);
        try {
            await api.post("/auth/invite", {
                email: inviteEmail.trim(),
                team: inviteTeamName.trim(),
                role: inviteRole
            });
            showToast("Invitation sent successfully!");
            setInviteEmail("");
            fetchTeamData();
        } catch (err: unknown) {
            console.error("Invitation failed:", err);
            const message = err && typeof err === "object" && "response" in err
                ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
                : undefined;
            showToast(message || "Failed to send invitation.", "error");
        } finally {
            setInviting(false);
        }
    };

    // ── Accept Invitation ───────────────────────────────────────────────────
    const handleAcceptInvite = async (token: string) => {
        try {
            const { data } = await api.post("/auth/accept-invite", { token });
            showToast(data.message);
            localStorage.setItem("user", JSON.stringify(data.user));
            window.location.reload();
        } catch (err) {
            console.error("Failed to accept invite:", err);
            showToast("Failed to join team", "error");
        }
    };

    // ── Export Meeting Report (JSON) ────────────────────────────────────────
    const exportMeetingJSON = () => {
        if (!selectedPastMeeting) return;
        const report = {
            title: selectedPastMeeting.title,
            date: selectedPastMeeting.createdAt,
            endedAt: selectedPastMeeting.endedAt,
            notes: selectedPastMeeting.notes,
            summary: selectedPastMeeting.summary,
            tasks: pastMeetingTasks,
            transcript: selectedPastMeeting.transcript
        };

        const fileData = JSON.stringify(report, null, 2);
        const blob = new Blob([fileData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `intellmeet-report-${selectedPastMeeting.meetingId.slice(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ── Export Meeting Report (PDF/Print) ───────────────────────────────────
    const exportMeetingPDF = () => {
        window.print();
    };

    // ── Export Analytics to CSV ─────────────────────────────────────────────
    const exportAnalyticsCSV = () => {
        if (!analytics) return;
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Metric,Value\r\n";
        csvContent += `Total Meetings,${analytics.meetingsCount}\r\n`;
        csvContent += `Ended Meetings,${analytics.endedMeetingsCount}\r\n`;
        csvContent += `Active Meetings,${analytics.activeMeetingsCount}\r\n`;
        csvContent += `Action Items Extracted,${analytics.tasksCount}\r\n`;
        csvContent += `Completion Rate,${analytics.productivity?.completionRate}%\r\n`;
        csvContent += `Avg. Participants,${analytics.productivity?.avgParticipants}\r\n`;
        csvContent += `Transcribed Conversation Turns,${analytics.productivity?.transcriptTurns}\r\n`;
        csvContent += `Chat Messages,${analytics.productivity?.messagesSent}\r\n`;

        const encodedUri = encodeURI(csvContent);
        const a = document.createElement("a");
        a.setAttribute("href", encodedUri);
        a.setAttribute("download", "intellmeet-analytics-report.csv");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // ── Logout ──────────────────────────────────────────────────────────────
    const handleLogout = async () => {
        await logout();
        navigate("/");
    };

    // ── Avatar Upload ───────────────────────────────────────────────────────
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("avatar", file);
        showToast("Uploading avatar...", "info");
        try {
            const { data } = await api.post("/auth/avatar", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            showToast("Avatar updated successfully!");
            const updatedUser = { ...user, avatar: data.avatar };
            localStorage.setItem("user", JSON.stringify(updatedUser));
            window.location.reload(); 
        } catch {
            showToast("Failed to upload avatar", "error");
        }
    };

    const getInitials = (name?: string) =>
        name ? name.slice(0, 2).toUpperCase() : "??";

    const formatDate = (iso?: string) => {
        if (!iso) return "N/A";
        const d = new Date(iso);
        return d.toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
    };

    // Filter active and completed meetings
    const activeMeetings = meetings.filter((m) => m.status !== "ended");
    const pastMeetings = meetings.filter((m) => m.status === "ended");

    // Filter past meetings by history search
    const filteredPastMeetings = pastMeetings.filter((m) =>
        m.title.toLowerCase().includes(historySearch.toLowerCase())
    );

    // Filter team list for task assignment dropdown
    const assigneeList = [
        user?.username || "You",
        ...teamMembers.map((m) => m.username)
    ];

    return (
        <div className="dashboard">

            {/* ── Sidebar Navigation ── */}
            <aside className="sidebar">
                <div className="sidebar-logo flex items-center gap-2">
                    <img src="/logo.png" alt="IntellMeet Logo" style={{ height: '32px', borderRadius: '50%' }} />
                    <span>IntellMeet</span>
                    <div className="ml-auto">
                        <NotificationBell />
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div
                        className={`sidebar-nav-item ${currentView === "meetings" ? "active" : ""}`}
                        onClick={() => setCurrentView("meetings")}
                    >
                        <span>📋</span> Active Meetings
                    </div>
                    <div
                        className={`sidebar-nav-item ${currentView === "history" ? "active" : ""}`}
                        onClick={() => setCurrentView("history")}
                    >
                        <span>⏳</span> Meeting History
                    </div>
                    <div
                        className={`sidebar-nav-item ${currentView === "board" ? "active" : ""}`}
                        onClick={() => setCurrentView("board")}
                    >
                        <span>📋</span> Project Board
                    </div>
                    <div
                        className={`sidebar-nav-item ${currentView === "analytics" ? "active" : ""}`}
                        onClick={() => setCurrentView("analytics")}
                    >
                        <span>📊</span> Productivity & Stats
                    </div>
                    <div
                        className={`sidebar-nav-item ${currentView === "team" ? "active" : ""}`}
                        onClick={() => setCurrentView("team")}
                    >
                        <span>👥</span> Team & Invites
                    </div>
                </nav>

                <div className="sidebar-user">
                    <label htmlFor="avatar-upload" className="user-avatar" style={{ cursor: "pointer", overflow: "hidden" }} title="Click to upload avatar">
                        {user?.avatar ? (
                            <img src={user.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                            getInitials(user?.username)
                        )}
                    </label>
                    <input 
                        type="file" 
                        id="avatar-upload" 
                        style={{ display: "none" }} 
                        accept="image/*"
                        onChange={handleAvatarUpload}
                    />
                    <div className="user-info">
                        <div className="user-name">{user?.username}</div>
                        <div className="user-email">{user?.email}</div>
                        {user?.team && (
                            <span style={{ fontSize: "10px", color: "var(--accent)", fontWeight: "600" }}>
                                🏢 {user.team} ({user.role})
                            </span>
                        )}
                    </div>
                    <button
                        id="logout-btn"
                        className="btn btn-icon logout-btn"
                        onClick={handleLogout}
                        title="Logout"
                    >
                        ↩
                    </button>
                </div>
            </aside>

            {/* ── Main Content Area ── */}
            <main className="dashboard-main">

                {/* Toast */}
                {toast && (
                    <div className={`toast ${toast.type === "error" ? "toast-error" : "toast-success"}`}>
                        {toast.type === "error" ? "❌" : "✅"} {toast.msg}
                    </div>
                )}

                {/* 1. VIEW: ACTIVE MEETINGS */}
                {currentView === "meetings" && (
                    <div className="active-meetings-container">
                        <div className="dash-header">
                            <div>
                                <h1 className="dash-title">
                                    Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"},{" "}
                                    <span className="gradient-text">{user?.username}</span> 👋
                                </h1>
                                <p className="dash-subtitle">
                                    {activeMeetings.length > 0
                                        ? `You have ${activeMeetings.length} active room${activeMeetings.length > 1 ? "s" : ""}`
                                        : "Create your first meeting to get started"}
                                </p>
                            </div>

                            <button
                                id="create-meeting-btn"
                                className="btn btn-primary btn-lg"
                                onClick={() => setShowCreate(true)}
                            >
                                + New Meeting
                            </button>
                        </div>

                        {/* Join Banner */}
                        <div className="join-banner glass-card">
                            <div className="join-banner-left">
                                <span className="join-banner-icon">🔗</span>
                                <div>
                                    <div className="join-banner-title">Join a Meeting</div>
                                    <div className="join-banner-sub">Paste a room link or enter a Meeting ID</div>
                                </div>
                            </div>
                            <form className="join-banner-form" onSubmit={handleJoinById}>
                                <input
                                    id="join-by-id-input"
                                    className="input-field"
                                    placeholder="Paste link or enter Meeting ID…"
                                    value={joinInput}
                                    onChange={(e) => setJoinInput(e.target.value)}
                                    autoComplete="off"
                                />
                                <button
                                    id="join-by-id-btn"
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={!joinInput.trim()}
                                >
                                    Join →
                                </button>
                            </form>
                        </div>

                        {/* Create Modal */}
                        {showCreate && (
                            <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                                <div className="modal-card glass-card" onClick={(e) => e.stopPropagation()}>
                                    <h3>Create a New Meeting</h3>
                                    <p style={{ marginTop: "8px", marginBottom: "20px", fontSize: "14px" }}>
                                        Give your meeting a title and share the link.
                                    </p>
                                    <form onSubmit={handleCreate}>
                                        <div className="input-group" style={{ marginBottom: "16px" }}>
                                            <label htmlFor="meeting-title">Meeting Title</label>
                                            <input
                                                id="meeting-title"
                                                className="input-field"
                                                placeholder="e.g. Weekly Standup"
                                                value={newTitle}
                                                onChange={(e) => setNewTitle(e.target.value)}
                                                required
                                                autoFocus
                                            />
                                        </div>
                                        <div className="modal-actions">
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => setShowCreate(false)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                id="create-meeting-submit"
                                                type="submit"
                                                className="btn btn-primary"
                                                disabled={creating}
                                            >
                                                {creating ? <span className="spinner" /> : "Create Meeting"}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Meetings List */}
                        {loading ? (
                            <div className="dash-loading">
                                <div className="spinner" style={{ width: "32px", height: "32px" }} />
                            </div>
                        ) : activeMeetings.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📅</div>
                                <h3>No active meetings yet</h3>
                                <p>Create your first meeting and invite your team.</p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowCreate(true)}
                                >
                                    + Create Meeting
                                </button>
                            </div>
                        ) : (
                            <div className="meetings-grid">
                                {activeMeetings.map((meeting) => (
                                    <div key={meeting.meetingId} className="meeting-card glass-card">
                                        <div className="meeting-card-header">
                                            <div className="meeting-status-dot" />
                                            <span className="badge badge-green">Ready</span>
                                        </div>

                                        <h3 className="meeting-title">{meeting.title}</h3>

                                        <div className="meeting-meta">
                                            <span>📅 {formatDate(meeting.createdAt)}</span>
                                            <span className="meeting-id-text">
                                                ID: {meeting.meetingId.slice(0, 8)}...
                                            </span>
                                        </div>

                                        <div className="meeting-actions">
                                            <button
                                                id={`join-${meeting.meetingId}`}
                                                className="btn btn-primary"
                                                style={{ flex: 1 }}
                                                onClick={() => handleJoin(meeting.meetingId)}
                                            >
                                                🎥 Join
                                            </button>

                                            <button
                                                id={`copy-${meeting.meetingId}`}
                                                className="btn btn-secondary btn-icon"
                                                onClick={() => copyLink(meeting.meetingId)}
                                                title="Copy invite link"
                                            >
                                                {copiedId === meeting.meetingId ? "✅" : "🔗"}
                                            </button>

                                            <button
                                                id={`delete-${meeting.meetingId}`}
                                                className="btn btn-danger btn-icon"
                                                onClick={() => handleDelete(meeting.meetingId, meeting.title)}
                                                title="Delete meeting"
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. VIEW: MEETING HISTORY */}
                {currentView === "history" && (
                    <div className="history-container">
                        <div className="dash-header">
                            <div>
                                <h1 className="dash-title">Past Meetings</h1>
                                <p className="dash-subtitle">View meeting notes, playback recordings, and AI action items.</p>
                            </div>
                        </div>

                        {/* Search History */}
                        <div className="search-bar-row">
                            <input
                                id="history-search"
                                className="input-field"
                                placeholder="Search by meeting title..."
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                            />
                        </div>

                        {/* History Grid */}
                        {loading ? (
                            <div className="dash-loading">
                                <div className="spinner" />
                            </div>
                        ) : filteredPastMeetings.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">⏳</div>
                                <h3>No completed meetings found</h3>
                                <p>Past meetings with generated AI summaries and recordings appear here.</p>
                            </div>
                        ) : (
                            <div className="history-grid">
                                {filteredPastMeetings.map((meeting) => (
                                    <div
                                        key={meeting.meetingId}
                                        className="history-card glass-card"
                                        onClick={() => openPastMeetingDetails(meeting)}
                                    >
                                        <div className="history-info">
                                            <span className="history-title">{meeting.title}</span>
                                            <span className="history-meta">
                                                📅 {formatDate(meeting.createdAt)} · Ended: {formatDate(meeting.endedAt)}
                                            </span>
                                        </div>
                                        <div className="history-actions">
                                            {meeting.recordingUrl && <span title="Recording Available">🎥</span>}
                                            {meeting.summary?.text && <span className="badge badge-purple">AI Summary</span>}
                                            <button className="btn btn-secondary">Open Details →</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Detailed History Modal */}
                        {selectedPastMeeting && (
                            <div className="modal-overlay" onClick={() => setSelectedPastMeeting(null)}>
                                <div className="modal-card glass-card history-modal-card" onClick={(e) => e.stopPropagation()}>
                                    
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
                                        <div>
                                            <h2 className="gradient-text" style={{ fontSize: "22px" }}>{selectedPastMeeting.title}</h2>
                                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                Held on {formatDate(selectedPastMeeting.createdAt)}
                                            </span>
                                        </div>
                                        <button
                                            className="btn btn-icon btn-secondary"
                                            onClick={() => setSelectedPastMeeting(null)}
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="modal-split-layout">
                                        
                                        {/* Left Side: Recording & Summary */}
                                        <div>
                                            {/* Recording Player */}
                                            {selectedPastMeeting.recordingUrl ? (
                                                <div className="video-player-container">
                                                    <video
                                                        controls
                                                        className="video-player"
                                                        src={selectedPastMeeting.recordingUrl}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="video-player-container" style={{ background: "rgba(255,255,255,0.01)", display: "flex", flexDirection: "column", gap: "6px" }}>
                                                    <span style={{ fontSize: "24px" }}>🎥</span>
                                                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No meeting recording saved.</span>
                                                </div>
                                            )}

                                            {/* AI Summary Text */}
                                            <div className="summary-section" style={{ marginTop: "16px" }}>
                                                <span className="summary-title">🤖 AI Summary</span>
                                                <p className="summary-text">
                                                    {selectedPastMeeting.summary?.text || "AI Summary not generated for this meeting."}
                                                </p>
                                            </div>

                                            {/* Key Points list */}
                                            {selectedPastMeeting.summary?.keyPoints && selectedPastMeeting.summary.keyPoints.length > 0 && (
                                                <div className="summary-section" style={{ marginTop: "16px" }}>
                                                    <span className="summary-title">💡 Key Discussion Topics</span>
                                                    <ul className="bullet-list">
                                                        {selectedPastMeeting.summary.keyPoints.map((pt, idx) => (
                                                            <li key={idx}>{pt}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Side: Tasks Checklist & Notes */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                            
                                            {/* Action Items */}
                                            <div style={{ background: "rgba(255,255,255,0.01)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                                                <span className="summary-title" style={{ display: "block", marginBottom: "12px" }}>
                                                    ✅ Action Items ({pastMeetingTasks.filter((t) => t.status === "completed").length}/{pastMeetingTasks.length})
                                                </span>

                                                {loadingPastTasks ? (
                                                    <div className="spinner" style={{ margin: "10px auto" }} />
                                                ) : pastMeetingTasks.length === 0 ? (
                                                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>No tasks extracted or created.</p>
                                                ) : (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                                                        {pastMeetingTasks.map((task) => (
                                                            <div key={task._id} className={`task-item ${task.status === "completed" ? "completed" : ""}`} style={{ padding: "8px" }}>
                                                                <input
                                                                    type="checkbox"
                                                                    className="task-checkbox"
                                                                    checked={task.status === "completed"}
                                                                    onChange={() => handleTogglePastTask(task)}
                                                                />
                                                                <div className="task-details">
                                                                    <span className="task-title-text" style={{ fontSize: "12px" }}>{task.title}</span>
                                                                    <span className="task-assignee-tag" style={{ fontSize: "10px" }}>👤 {task.assignee}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Shared Notes */}
                                            <div style={{ background: "rgba(255,255,255,0.01)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                                                <span className="summary-title" style={{ display: "block", marginBottom: "8px" }}>
                                                    📝 Meeting Shared Notes
                                                </span>
                                                <div style={{ fontSize: "13px", color: "var(--text-secondary)", whiteSpace: "pre-wrap", maxHeight: "150px", overflowY: "auto", background: "rgba(0,0,0,0.1)", padding: "8px", borderRadius: "4px" }}>
                                                    {selectedPastMeeting.notes || "No notes taken during this meeting."}
                                                </div>
                                            </div>

                                        </div>
                                    </div>

                                    {/* Action Buttons for Exporting */}
                                    <div className="modal-actions" style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                                        <button className="btn btn-secondary" onClick={exportMeetingJSON}>
                                            📥 Export JSON
                                        </button>
                                        <button className="btn btn-secondary" onClick={exportMeetingPDF}>
                                            🖨️ Print / Save PDF
                                        </button>
                                        <button className="btn btn-primary" onClick={() => setSelectedPastMeeting(null)}>
                                            Close
                                        </button>
                                    </div>

                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. VIEW: KANBAN PROJECT BOARD */}
                {currentView === "board" && (
                    <div className="history-container">
                        <div className="dash-header">
                            <div>
                                <h1 className="dash-title">Kanban Task Board</h1>
                                <p className="dash-subtitle">Track project progress, updates, and assignments in real-time.</p>
                            </div>
                        </div>

                        {/* Add Task bar */}
                        <form onSubmit={handleAddBoardTask} style={{ display: "flex", gap: "10px", padding: "16px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", marginBottom: "24px", flexWrap: "wrap" }}>
                            <input
                                id="kanban-new-title"
                                className="input-field"
                                style={{ flex: 2, minWidth: "200px" }}
                                placeholder="Write a new task title..."
                                value={newBoardTaskTitle}
                                onChange={(e) => setNewBoardTaskTitle(e.target.value)}
                                required
                            />
                            <select
                                id="kanban-new-assignee"
                                className="input-field"
                                style={{ flex: 1, minWidth: "150px", background: "var(--bg-input)" }}
                                value={newBoardTaskAssignee}
                                onChange={(e) => setNewBoardTaskAssignee(e.target.value)}
                            >
                                <option value="">Assign To...</option>
                                {assigneeList.map((name, idx) => (
                                    <option key={idx} value={name}>{name}</option>
                                ))}
                            </select>
                            <button type="submit" className="btn btn-primary">
                                + Add Task
                            </button>
                        </form>

                        {/* Kanban Columns */}
                        {loadingBoard ? (
                            <div className="dash-loading"><div className="spinner" /></div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                                
                                {/* Column: To Do */}
                                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px", minHeight: "450px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                                        <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            🔴 To Do
                                        </strong>
                                        <span className="badge badge-purple">{boardTasks.filter((t) => t.status === "todo" || t.status === "pending").length}</span>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                        {boardTasks
                                            .filter((t) => t.status === "todo" || t.status === "pending")
                                            .map((task) => (
                                                <div key={task._id} className="task-item" style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
                                                    <div className="task-details">
                                                        <span className="task-title-text">{task.title}</span>
                                                        <span className="task-assignee-tag">👤 {task.assignee}</span>
                                                    </div>
                                                    <button
                                                        className="btn btn-secondary btn-icon"
                                                        onClick={() => handleMoveBoardTask(task, "in_progress")}
                                                        title="Start task"
                                                        style={{ width: "26px", height: "26px", fontSize: "11px" }}
                                                    >
                                                        →
                                                    </button>
                                                </div>
                                            ))}
                                    </div>
                                </div>

                                {/* Column: In Progress */}
                                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px", minHeight: "450px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                                        <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            🟡 In Progress
                                        </strong>
                                        <span className="badge badge-purple">{boardTasks.filter((t) => t.status === "in_progress").length}</span>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                        {boardTasks
                                            .filter((t) => t.status === "in_progress")
                                            .map((task) => (
                                                <div key={task._id} className="task-item" style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
                                                    <div className="task-details">
                                                        <span className="task-title-text">{task.title}</span>
                                                        <span className="task-assignee-tag">👤 {task.assignee}</span>
                                                    </div>
                                                    <div style={{ display: "flex", gap: "4px" }}>
                                                        <button
                                                            className="btn btn-secondary btn-icon"
                                                            onClick={() => handleMoveBoardTask(task, "todo")}
                                                            title="Move to Todo"
                                                            style={{ width: "26px", height: "26px", fontSize: "11px" }}
                                                        >
                                                            ←
                                                        </button>
                                                        <button
                                                            className="btn btn-secondary btn-icon"
                                                            onClick={() => handleMoveBoardTask(task, "completed")}
                                                            title="Complete task"
                                                            style={{ width: "26px", height: "26px", fontSize: "11px" }}
                                                        >
                                                            ✓
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>

                                {/* Column: Done */}
                                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px", minHeight: "450px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                                        <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            🟢 Completed
                                        </strong>
                                        <span className="badge badge-green">{boardTasks.filter((t) => t.status === "completed").length}</span>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                        {boardTasks
                                            .filter((t) => t.status === "completed")
                                            .map((task) => (
                                                <div key={task._id} className="task-item completed" style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
                                                    <div className="task-details">
                                                        <span className="task-title-text">{task.title}</span>
                                                        <span className="task-assignee-tag">👤 {task.assignee}</span>
                                                    </div>
                                                    <button
                                                        className="btn btn-secondary btn-icon"
                                                        onClick={() => handleMoveBoardTask(task, "in_progress")}
                                                        title="Reopen task"
                                                        style={{ width: "26px", height: "26px", fontSize: "11px" }}
                                                    >
                                                        ←
                                                    </button>
                                                </div>
                                            ))}
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>
                )}

                {/* 4. VIEW: ANALYTICS & INSIGHTS */}
                {currentView === "analytics" && (
                    <div className="team-container">
                        <div className="dash-header">
                            <div>
                                <h1 className="dash-title">Workspace Analytics</h1>
                                <p className="dash-subtitle">Real-time productivity dashboard and engagement insights.</p>
                            </div>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button className="btn btn-secondary" onClick={exportAnalyticsCSV}>
                                    📥 Export CSV
                                </button>
                                <button className="btn btn-secondary" onClick={exportMeetingPDF}>
                                    🖨️ Print Report
                                </button>
                            </div>
                        </div>

                        {loadingAnalytics || !analytics ? (
                            <div className="dash-loading"><div className="spinner" /></div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                
                                {/* KPI Stats Cards Row */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                                    <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
                                        <span style={{ fontSize: "28px" }}>📹</span>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>Total Meetings</div>
                                        <div style={{ fontSize: "24px", fontWeight: "700", marginTop: "4px" }}>{analytics.meetingsCount}</div>
                                    </div>
                                    <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
                                        <span style={{ fontSize: "28px" }}>📋</span>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>Action Items</div>
                                        <div style={{ fontSize: "24px", fontWeight: "700", marginTop: "4px" }}>{analytics.tasksCount}</div>
                                    </div>
                                    <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
                                        <span style={{ fontSize: "28px" }}>📈</span>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>Task Completion Rate</div>
                                        <div style={{ fontSize: "24px", fontWeight: "700", marginTop: "4px", color: "var(--green)" }}>
                                            {analytics.productivity.completionRate}%
                                        </div>
                                    </div>
                                    <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
                                        <span style={{ fontSize: "28px" }}>💬</span>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>Collaborations / Chat</div>
                                        <div style={{ fontSize: "24px", fontWeight: "700", marginTop: "4px" }}>
                                            {analytics.productivity.messagesSent} msg
                                        </div>
                                    </div>
                                </div>

                                {/* Custom SVG Graphs Row */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "24px" }}>
                                    
                                    {/* SVG Line Graph: Meeting Frequency */}
                                    <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                        <h4>🎥 Meeting Frequency (Last 7 Days)</h4>
                                        <div style={{ width: "100%", height: "200px", position: "relative" }}>
                                            <svg viewBox="0 0 400 200" style={{ width: "100%", height: "100%" }}>
                                                {/* Grid Lines */}
                                                <line x1="40" y1="30" x2="380" y2="30" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4" />
                                                <line x1="40" y1="85" x2="380" y2="85" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4" />
                                                <line x1="40" y1="140" x2="380" y2="140" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4" />
                                                <line x1="40" y1="170" x2="380" y2="170" stroke="var(--border)" strokeWidth="1" />
                                                
                                                {/* Y Axis Labels */}
                                                <text x="15" y="35" fill="var(--text-muted)" fontSize="10">Max</text>
                                                <text x="15" y="90" fill="var(--text-muted)" fontSize="10">Med</text>
                                                <text x="15" y="174" fill="var(--text-muted)" fontSize="10">0</text>

                                                {/* Build Polyline points dynamically */}
                                                {(() => {
                                                    const maxVal = Math.max(...analytics.meetingFrequency.map(d => d.count), 2);
                                                    const points = analytics.meetingFrequency.map((day, idx) => {
                                                        const x = 50 + idx * 50;
                                                        const y = 170 - (day.count / maxVal) * 120;
                                                        return { x, y, day: day.date, count: day.count };
                                                    });
                                                    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(" ");

                                                    return (
                                                        <>
                                                            {/* Polyline area path */}
                                                            <polygon
                                                                points={`50,170 ${polylinePoints} 350,170`}
                                                                fill="rgba(108, 99, 255, 0.15)"
                                                            />
                                                            {/* Line */}
                                                            <polyline
                                                                fill="none"
                                                                stroke="var(--accent)"
                                                                strokeWidth="3"
                                                                points={polylinePoints}
                                                            />
                                                            {/* Dots & Labels */}
                                                            {points.map((p, idx) => (
                                                                <g key={idx}>
                                                                    <circle
                                                                        cx={p.x}
                                                                        cy={p.y}
                                                                        r="4"
                                                                        fill="var(--accent-2)"
                                                                        stroke="#fff"
                                                                        strokeWidth="1.5"
                                                                    />
                                                                    <text x={p.x - 12} y="190" fill="var(--text-muted)" fontSize="8">
                                                                        {p.day}
                                                                    </text>
                                                                    <text x={p.x - 5} y={p.y - 8} fill="#fff" fontSize="8" fontWeight="600">
                                                                        {p.count}
                                                                    </text>
                                                                </g>
                                                            ))}
                                                        </>
                                                    );
                                                })()}
                                            </svg>
                                        </div>
                                    </div>

                                    {/* SVG Donut Chart: Tasks Distribution */}
                                    <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                        <h4>📋 Action Items Status Breakdown</h4>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
                                            
                                            <div style={{ width: "160px", height: "160px" }}>
                                                <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%" }}>
                                                    {/* Background Circle */}
                                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                                                    
                                                    {/* Dynamically build donut segments */}
                                                    {(() => {
                                                        const t = analytics.tasksBreakdown;
                                                        const total = t.todo + t.in_progress + t.completed;
                                                        if (total === 0) {
                                                            return <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border)" strokeWidth="3" />;
                                                        }

                                                        const todoPct = (t.todo / total) * 100;
                                                        const ipPct = (t.in_progress / total) * 100;
                                                        const compPct = (t.completed / total) * 100;

                                                        // StrokeDasharrays
                                                        const compStroke = `${compPct} ${100 - compPct}`;
                                                        const ipStroke = `${ipPct} ${100 - ipPct}`;
                                                        const todoStroke = `${todoPct} ${100 - todoPct}`;

                                                        // Offset accumulations
                                                        const compOffset = 100;
                                                        const ipOffset = 100 - compPct;
                                                        const todoOffset = 100 - compPct - ipPct;

                                                        return (
                                                            <>
                                                                {/* Done (Green) */}
                                                                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--green)" strokeWidth="3" strokeDasharray={compStroke} strokeDashoffset={compOffset} />
                                                                {/* In Progress (Yellow) */}
                                                                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--yellow)" strokeWidth="3" strokeDasharray={ipStroke} strokeDashoffset={ipOffset} />
                                                                {/* Todo (Purple) */}
                                                                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray={todoStroke} strokeDashoffset={todoOffset} />
                                                                
                                                                {/* Center Text */}
                                                                <text x="18" y="20.5" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold">
                                                                    {total}
                                                                </text>
                                                            </>
                                                        );
                                                    })()}
                                                </svg>
                                            </div>

                                            {/* Legend */}
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--accent)" }} />
                                                    <span style={{ fontSize: "12px" }}>To Do ({analytics.tasksBreakdown.todo})</span>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--yellow)" }} />
                                                    <span style={{ fontSize: "12px" }}>In Progress ({analytics.tasksBreakdown.in_progress})</span>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--green)" }} />
                                                    <span style={{ fontSize: "12px" }}>Completed ({analytics.tasksBreakdown.completed})</span>
                                                </div>
                                            </div>

                                        </div>
                                    </div>

                                </div>

                                {/* Additional Insights metrics */}
                                <div className="glass-card" style={{ padding: "24px" }}>
                                    <h4 style={{ marginBottom: "16px" }}>📝 Meeting Engagement Summary</h4>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
                                        <div>
                                            <strong style={{ display: "block", color: "var(--text-muted)", fontSize: "12px" }}>Average Attendance</strong>
                                            <span style={{ fontSize: "20px", fontWeight: "600", marginTop: "4px", display: "block" }}>
                                                {analytics.productivity.avgParticipants} participants / meeting
                                            </span>
                                        </div>
                                        <div>
                                            <strong style={{ display: "block", color: "var(--text-muted)", fontSize: "12px" }}>Total Spoken Turns</strong>
                                            <span style={{ fontSize: "20px", fontWeight: "600", marginTop: "4px", display: "block" }}>
                                                {analytics.productivity.transcriptTurns} turns captured
                                            </span>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>
                )}

                {/* 5. VIEW: TEAM & INVITATIONS */}
                {currentView === "team" && (
                    <div className="team-container">
                        <div className="dash-header">
                            <div>
                                <h1 className="dash-title">Team Workspace</h1>
                                <p className="dash-subtitle">Invite colleagues and coordinate team roles for IntellMeet.</p>
                            </div>
                        </div>

                        {/* Join Pending Invites Banner */}
                        {pendingInvites.length > 0 && (
                            <div style={{ marginBottom: "24px" }}>
                                <h3 style={{ fontSize: "15px", marginBottom: "10px" }}>Pending Team Invitations</h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {pendingInvites.map((invite) => (
                                        <div key={invite._id} className="join-banner glass-card" style={{ padding: "12px 20px", marginBottom: 0 }}>
                                            <div>
                                                <strong>🏢 Join Team &quot;{invite.team}&quot;</strong> as <em>{invite.role}</em>
                                                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                    Invited by: {invite.invitedBy?.username} ({invite.invitedBy?.email})
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => handleAcceptInvite(invite.token)}
                                            >
                                                Accept & Join
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="team-layout">
                            
                            {/* Team Roster */}
                            <div className="team-list-card">
                                <h3>Team Directory ({teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""})</h3>
                                
                                {!user?.team ? (
                                    <div className="empty-state" style={{ height: "200px" }}>
                                        <div className="empty-icon" style={{ fontSize: "36px" }}>🏢</div>
                                        <p>You are not currently in a team workspace. Join a team or create one by sending an invitation.</p>
                                    </div>
                                ) : teamMembers.length === 0 ? (
                                    <div className="dash-loading"><div className="spinner" /></div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                        {teamMembers.map((member) => (
                                            <div key={member._id || member.email} className="team-member-item">
                                                <div className="member-avatar">
                                                    {getInitials(member.username)}
                                                </div>
                                                <div className="member-details">
                                                    <span className="member-name">{member.username}</span>
                                                    <span className="member-email">{member.email}</span>
                                                </div>
                                                <span className={`member-role-badge ${member.role.toLowerCase() === "admin" ? "admin" : ""}`}>
                                                    {member.role}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Invite Colleague form */}
                            <div className="glass-card form-card">
                                <h3>Invite Team Member</h3>
                                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px", marginBottom: "16px" }}>
                                    Send an invite to join your organization workspace.
                                </p>
                                <form onSubmit={handleSendInvite} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    <div className="input-group">
                                        <label htmlFor="invite-email">Colleague Email</label>
                                        <input
                                            id="invite-email"
                                            className="input-field"
                                            placeholder="colleague@example.com"
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label htmlFor="invite-team-name">Organization / Team Name</label>
                                        <input
                                            id="invite-team-name"
                                            className="input-field"
                                            placeholder="e.g. Acme Corp"
                                            value={inviteTeamName}
                                            onChange={(e) => setInviteTeamName(e.target.value)}
                                            required
                                            disabled={!!user?.team} // Lock if already in a team
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label htmlFor="invite-role">Workspace Role</label>
                                        <select
                                            id="invite-role"
                                            className="input-field"
                                            style={{ background: "var(--bg-input)" }}
                                            value={inviteRole}
                                            onChange={(e) => setInviteRole(e.target.value)}
                                        >
                                            <option value="Member">Member (standard access)</option>
                                            <option value="Admin">Admin (full privileges)</option>
                                        </select>
                                    </div>

                                    <button
                                        id="send-invite-btn"
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={inviting}
                                        style={{ marginTop: "10px" }}
                                    >
                                        {inviting ? "Sending..." : "Send Invitation"}
                                    </button>
                                </form>
                            </div>

                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
