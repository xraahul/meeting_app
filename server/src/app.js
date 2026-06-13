import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import db from "./config/db.js";
import profileRoutes from "./routes/profileRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

// Connect to database
db();

const app = express();

// ─── Security & Parsing Middleware (MUST be before routes) ────────────────────
app.use(
    cors({
        origin: [
            process.env.CLIENT_URL,
            "http://localhost:5173",
            "http://127.0.0.1:5173"
        ].filter(Boolean),
        credentials: true,
    })
);

app.use(helmet({
    crossOriginResourcePolicy: false // Allow static files to be requested across origins
}));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

// ─── Prometheus Custom Metrics Middleware ────────────────────────────────────
let requestCount = 0;
let requestDurationSum = 0;
let errorCount = 0;

app.use((req, res, next) => {
    if (req.path === "/metrics") return next();
    requestCount++;
    const start = Date.now();
    res.on("finish", () => {
        const duration = (Date.now() - start) / 1000;
        requestDurationSum += duration;
        if (res.statusCode >= 400) {
            errorCount++;
        }
    });
    next();
});

// Metrics scraping endpoint
app.get("/metrics", (req, res) => {
    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(`# HELP http_requests_total Total number of HTTP requests.
# TYPE http_requests_total counter
http_requests_total ${requestCount}

# HELP http_request_duration_seconds_sum Total response latency.
# TYPE http_request_duration_seconds_sum counter
http_request_duration_seconds_sum ${requestDurationSum}

# HELP http_requests_failed_total Total failed HTTP requests.
# TYPE http_requests_failed_total counter
http_requests_failed_total ${errorCount}
`);
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/meetings", meetingRoutes);

app.get("/", (req, res) => {
    res.json({ message: "IntellMeet API Running ✓" });
});

// ─── Sentry Error Handler Stub ───────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error("Sentry Captured Exception:", err.message);
    if (process.env.SENTRY_DSN) {
        // Here you would hook real Sentry SDK client.captureException(err)
    }
    res.status(500).json({ message: err.message || "Internal Server Error" });
});

export default app;