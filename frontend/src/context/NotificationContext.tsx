import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";
import io, { type Socket } from "socket.io-client";
import api from "../api/api";
import { useAuth } from "./AuthContext";
import type { Notification } from "../types";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

interface NotificationContextValue {
    notifications: Notification[];
    unreadCount: number;
    fetchNotifications: () => Promise<void>;
    markRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const userId = user?.id || user?._id;
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!userId) return;
        try {
            const { data } = await api.get("/notifications");
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        } catch (err) {
            console.error("Failed to load notifications:", err);
        }
    }, [userId]);

    const markRead = useCallback(async (id: string) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications((prev) =>
                prev.map((n) => (n._id === id ? { ...n, read: true } : n))
            );
            setUnreadCount((c) => Math.max(0, c - 1));
        } catch (err) {
            console.error("Failed to mark notification read:", err);
        }
    }, []);

    const markAllRead = useCallback(async () => {
        try {
            await api.put("/notifications/read-all");
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("Failed to mark all read:", err);
        }
    }, []);

    useEffect(() => {
        if (!userId) return;

        fetchNotifications();

        const socket: Socket = io(SOCKET_URL, { transports: ["websocket"] });
        socket.emit("join-user", userId);

        socket.on("notification", (notification: Notification) => {
            setNotifications((prev) => [notification, ...prev]);
            setUnreadCount((c) => c + 1);
        });

        return () => {
            socket.disconnect();
        };
    }, [userId, fetchNotifications]);

    return (
        <NotificationContext.Provider
            value={{ notifications, unreadCount, fetchNotifications, markRead, markAllRead }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
    return ctx;
};
