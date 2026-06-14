import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import db from "./config/db.js";
import profileRoutes from "./routes/profileRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import Sentry from "./instrument.js";
import { register, httpRequestsTotal, httpRequestDuration } from "./metrics.js";

dotenv.config();

db();

const app = express();

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
});

app.use(
    cors({
        origin: [
            process.env.CLIENT_URL,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ].filter(Boolean),
        credentials: true,
    })
);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use("/api", apiLimiter);
app.use("/uploads", express.static("uploads"));

app.use((req, res, next) => {
    if (req.path === "/metrics" || req.path === "/health") return next();

    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const route = req.route?.path || req.path;
        const labels = {
            method: req.method,
            route: route.replace(/\d+/g, ":id"),
            status: String(res.statusCode),
        };
        httpRequestsTotal.inc(labels);
        const durationNs = Number(process.hrtime.bigint() - start);
        httpRequestDuration.observe(labels, durationNs / 1e9);
    });
    next();
});

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (_req, res) => {
    res.json({ message: "IntellMeet API Running ✓" });
});

if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
}

app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err.message);
    res.status(err.status || 500).json({
        message: process.env.NODE_ENV === "production"
            ? "Internal Server Error"
            : err.message || "Internal Server Error",
    });
});

export default app;
