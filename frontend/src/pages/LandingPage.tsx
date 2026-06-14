import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import "./LandingPage.css";

const features = [
    {
        icon: "🎥",
        title: "Crystal Clear Video",
        desc: "HD video calls powered by WebRTC — no plugins, no downloads. Works right in your browser.",
    },
    {
        icon: "🔒",
        title: "Secure & Private",
        desc: "End-to-end encrypted peer-to-peer connections. Your conversations stay between you.",
    },
    {
        icon: "⚡",
        title: "Instant Meetings",
        desc: "Create a room in seconds. Share the link. Done. No scheduling, no hassle.",
    },
    {
        icon: "💬",
        title: "In-Meeting Chat",
        desc: "Share links, notes, and messages with built-in chat — all without leaving the room.",
    },
    {
        icon: "🖥️",
        title: "Screen Sharing",
        desc: "Present your screen with one click. Perfect for demos, code reviews, and presentations.",
    },
    {
        icon: "👥",
        title: "Multi-Participant",
        desc: "Invite your whole team. Everyone can join, speak, and collaborate seamlessly.",
    },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const [joinCode, setJoinCode] = useState("");
    const [starting, setStarting] = useState(false);

    const handleInstantMeeting = async () => {
        setStarting(true);
        try {
            const { data } = await api.post("/meetings", { title: "Instant Meeting" });
            navigate(`/room/${data.meetingId}`);
        } catch (error) {
            alert("Failed to create instant meeting.");
        } finally {
            setStarting(false);
        }
    };

    const handleJoinMeeting = () => {
        if (joinCode.trim()) {
            navigate(`/room/${joinCode.trim()}`);
        }
    };

    return (
        <div className="landing">

            {/* ── Navbar ── */}
            <nav className="landing-nav">
                <div className="nav-logo">
                    <span className="logo-icon">📡</span>
                    <span className="logo-text">IntellMeet</span>
                </div>
                <div className="nav-links">
                    <Link to="/login" className="btn btn-secondary">Sign In</Link>
                    <Link to="/signup" className="btn btn-primary">Get Started</Link>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="hero">
                <div className="hero-bg">
                    <div className="hero-orb hero-orb-1" />
                    <div className="hero-orb hero-orb-2" />
                    <div className="hero-orb hero-orb-3" />
                </div>

                <div className="hero-content fade-up">
                    <div className="badge badge-purple" style={{ marginBottom: "24px" }}>
                        ✨ Free forever — no credit card needed
                    </div>

                    <h1 className="hero-title">
                        Video meetings that
                        <br />
                        <span className="gradient-text">just work</span>
                    </h1>

                    <p className="hero-subtitle">
                        Connect face-to-face with anyone, anywhere. Secure, instant,
                        and beautiful — powered by WebRTC.
                    </p>

                    <div className="hero-cta" style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start", width: "100%", maxWidth: "420px" }}>
                        <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                            <button onClick={handleInstantMeeting} className="btn btn-primary btn-lg" style={{ flex: 1, whiteSpace: "nowrap" }} disabled={starting}>
                                {starting ? <span className="spinner" /> : "⚡ Start Instant Meeting"}
                            </button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Enter meeting code..."
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                style={{ flex: 1, height: "48px" }}
                            />
                            <button onClick={handleJoinMeeting} className="btn btn-secondary btn-lg" disabled={!joinCode.trim()}>
                                Join
                            </button>
                        </div>
                        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                            No account required. <Link to="/signup" style={{ color: "var(--primary)" }}>Create an account</Link> for advanced features.
                        </p>
                    </div>

                    <div className="hero-stats">
                        <div className="stat">
                            <span className="stat-value">HD</span>
                            <span className="stat-label">Video quality</span>
                        </div>
                        <div className="stat-divider" />
                        <div className="stat">
                            <span className="stat-value">0ms</span>
                            <span className="stat-label">Setup time</span>
                        </div>
                        <div className="stat-divider" />
                        <div className="stat">
                            <span className="stat-value">E2E</span>
                            <span className="stat-label">Encrypted</span>
                        </div>
                    </div>
                </div>

                {/* Floating mock UI */}
                <div className="hero-visual fade-up" style={{ animationDelay: "0.2s" }}>
                    <div className="mock-room">
                        <div className="mock-header">
                            <div className="mock-dot red" />
                            <div className="mock-dot yellow" />
                            <div className="mock-dot green" />
                            <span className="mock-title">Meeting Room · 3 participants</span>
                        </div>
                        <div className="mock-videos">
                            <div className="mock-video mock-video-main">
                                <div className="mock-avatar">👩‍💼</div>
                                <div className="mock-name">Sarah K.</div>
                                <div className="mock-speaking-ring" />
                            </div>
                            <div className="mock-video-grid">
                                <div className="mock-video mock-video-sm">
                                    <div className="mock-avatar">👨‍💻</div>
                                    <div className="mock-name">Alex M.</div>
                                </div>
                                <div className="mock-video mock-video-sm">
                                    <div className="mock-avatar">🧑‍🎨</div>
                                    <div className="mock-name">You</div>
                                </div>
                            </div>
                        </div>
                        <div className="mock-controls">
                            <div className="mock-ctrl active">🎤</div>
                            <div className="mock-ctrl active">📷</div>
                            <div className="mock-ctrl">🖥️</div>
                            <div className="mock-ctrl">💬</div>
                            <div className="mock-ctrl danger">📞</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Features ── */}
            <section className="features">
                <div className="features-header">
                    <h2>Everything you need to meet</h2>
                    <p>No downloads. No friction. Just great meetings.</p>
                </div>
                <div className="features-grid">
                    {features.map((f, i) => (
                        <div
                            key={i}
                            className="feature-card glass-card fade-up"
                            style={{ animationDelay: `${i * 0.07}s` }}
                        >
                            <div className="feature-icon">{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA Banner ── */}
            <section className="cta-banner">
                <div className="cta-orb" />
                <h2>Ready to meet?</h2>
                <p>Create your free account and start your first meeting in 30 seconds.</p>
                <Link to="/signup" id="cta-banner-btn" className="btn btn-primary btn-lg">
                    Create free account →
                </Link>
            </section>

            {/* ── Footer ── */}
            <footer className="landing-footer">
                <span className="logo-text" style={{ fontSize: "14px" }}>📡 IntellMeet</span>
                <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                    Built with WebRTC · Secure · Free
                </span>
            </footer>
        </div>
    );
}
