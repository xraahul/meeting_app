import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import api from "../api/api";
import type { User } from "../types";

interface AuthContextValue {
    user: User | null;
    accessToken: string | null;
    login: (username: string, password: string) => Promise<{ user: User; accessToken: string }>;
    logout: () => Promise<void>;
    signup: (username: string, password: string) => Promise<unknown>;
    googleLogin: (email: string, username: string, avatar: string) => Promise<{ user: User; accessToken: string }>;
    isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const stored = localStorage.getItem("user");
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const [accessToken, setAccessToken] = useState<string | null>(() =>
        localStorage.getItem("accessToken") || null
    );

    const signup = useCallback(async (username: string, password: string) => {
        const { data } = await api.post("/auth/signup", { username, password });
        return data;
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        const { data } = await api.post("/auth/login", { username, password });

        setUser(data.user);
        setAccessToken(data.accessToken);
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("user", JSON.stringify(data.user));

        return data;
    }, []);

    const googleLogin = useCallback(async (email: string, username: string, avatar: string) => {
        const { data } = await api.post("/auth/google-login", { email, username, avatar });

        setUser(data.user);
        setAccessToken(data.accessToken);
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("user", JSON.stringify(data.user));

        return data;
    }, []);

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

    const value: AuthContextValue = {
        user,
        accessToken,
        login,
        logout,
        signup,
        googleLogin,
        isLoggedIn: !!user,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
};
