import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

export default function LoginPage() {
    const { login, googleLogin } = useAuth();
    const navigate = useNavigate();

    const [form, setForm] = useState({ username: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setError("");
        setLoading(true);
        try {
            // Simulated Google OAuth2 details
            const email = `google.user-${Math.floor(Math.random() * 1000)}@intellmeet.com`;
            const username = "Google User";
            const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}-${Math.floor(Math.random() * 100)}`;
            await googleLogin(email, username, avatar);
            navigate("/dashboard");
        } catch (err) {
            setError(err.response?.data?.message || "Google Sign-In failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) =>
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await login(form.username, form.password);
            navigate("/dashboard");
        } catch (err) {
            setError(
                err.response?.data?.message || "Login failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">

                <Link to="/" className="auth-logo">
                    <span className="auth-logo-icon">📡</span>
                    <span className="auth-logo-text">IntellMeet</span>
                </Link>

                <h1 className="auth-heading">Welcome back</h1>
                <p className="auth-subheading">Sign in to your account to continue</p>

                {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>{error}</div>}

                <form className="auth-form" onSubmit={handleSubmit} noValidate>

                    <div className="input-group">
                        <label htmlFor="login-username">Username</label>
                        <input
                            id="login-username"
                            name="username"
                            type="text"
                            className="input-field"
                            placeholder="Enter your username"
                            value={form.username}
                            onChange={handleChange}
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="login-password">Password</label>
                        <input
                            id="login-password"
                            name="password"
                            type="password"
                            className="input-field"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={handleChange}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        id="login-submit"
                        type="submit"
                        className="btn btn-primary auth-submit"
                        disabled={loading}
                    >
                        {loading ? <span className="spinner" /> : "Sign in →"}
                    </button>
                </form>

                <div className="auth-divider" style={{ margin: "20px 0", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                    <span style={{ borderBottom: "1px solid var(--border)", flex: 1 }} />
                    <span style={{ padding: "0 10px" }}>or</span>
                    <span style={{ borderBottom: "1px solid var(--border)", flex: 1 }} />
                </div>

                <button
                    id="google-login-btn"
                    type="button"
                    className="btn btn-secondary auth-submit"
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}
                    onClick={handleGoogleLogin}
                    disabled={loading}
                >
                    🔑 Sign in with Google
                </button>

                <p className="auth-footer-text">
                    Don&apos;t have an account?{" "}
                    <Link to="/signup">Create one free</Link>
                </p>
            </div>
        </div>
    );
}
