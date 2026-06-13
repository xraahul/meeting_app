import { createContext, useContext, useState, useCallback } from "react";
import api from "../api/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem("user");
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const [accessToken, setAccessToken] = useState(() =>
        localStorage.getItem("accessToken") || null
    );

    // ─── Signup ──────────────────────────────────────────────────────────────
    const signup = useCallback(async (username, password) => {
        const { data } = await api.post("/auth/signup", {
            username,
            password,
        });
        return data;
    }, []);

    // ─── Login ───────────────────────────────────────────────────────────────
    const login = useCallback(async (username, password) => {
        const { data } = await api.post("/auth/login", { username, password });

        setUser(data.user);
        setAccessToken(data.accessToken);
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("user", JSON.stringify(data.user));

        return data;
    }, []);

    // ─── Google Login ────────────────────────────────────────────────────────
    const googleLogin = useCallback(async (email, username, avatar) => {
        const { data } = await api.post("/auth/google-login", { email, username, avatar });

        setUser(data.user);
        setAccessToken(data.accessToken);
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("user", JSON.stringify(data.user));

        return data;
    }, []);

    // ─── Logout ──────────────────────────────────────────────────────────────
    const logout = useCallback(async () => {
        try {
            await api.post("/auth/logout");
        } catch {
            // ignore errors on logout
        } finally {
            setUser(null);
            setAccessToken(null);
            localStorage.removeItem("accessToken");
            localStorage.removeItem("user");
        }
    }, []);

    const value = { user, accessToken, login, logout, signup, googleLogin, isLoggedIn: !!user };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
};
