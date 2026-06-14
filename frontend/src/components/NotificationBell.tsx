import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import type { Notification } from "../types";

const typeIcon: Record<Notification["type"], string> = {
    mention: "@",
    action_item: "✅",
    task_assigned: "📋",
};

export default function NotificationBell() {
    const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleClick = async (notification: Notification) => {
        if (!notification.read) {
            await markRead(notification._id);
        }
        setOpen(false);

        if (notification.metadata?.meetingId) {
            navigate(`/room/${notification.metadata.meetingId}`);
        } else if (notification.type === "task_assigned" || notification.type === "action_item") {
            navigate("/dashboard");
        }
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                className="btn btn-secondary btn-icon relative"
                onClick={() => setOpen(!open)}
                title="Notifications"
                aria-label="Notifications"
            >
                🔔
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-12 z-50 w-80 max-h-96 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] shadow-lg">
                    <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                        <span className="text-sm font-semibold">Notifications</span>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                className="text-xs text-[var(--accent)] hover:underline"
                                onClick={markAllRead}
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                            No notifications yet
                        </div>
                    ) : (
                        <ul className="divide-y divide-[var(--border)]">
                            {notifications.map((n) => (
                                <li key={n._id}>
                                    <button
                                        type="button"
                                        className={`w-full px-4 py-3 text-left transition hover:bg-[var(--bg-card-hover)] ${
                                            !n.read ? "bg-[var(--accent-light)]" : ""
                                        }`}
                                        onClick={() => handleClick(n)}
                                    >
                                        <div className="flex items-start gap-2">
                                            <span className="text-base">{typeIcon[n.type]}</span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium">{n.title}</div>
                                                <div className="mt-0.5 text-xs text-[var(--text-secondary)] line-clamp-2">
                                                    {n.message}
                                                </div>
                                                <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                                                    {new Date(n.createdAt).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
