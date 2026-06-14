#!/usr/bin/env node
/**
 * CI smoke tests — run against a live server (default http://localhost:5000)
 */
import axios from "axios";

const API_ROOT = process.env.SMOKE_BASE_URL || "http://localhost:5000";
const API = `${API_ROOT}/api`;
const failures = [];

const assert = (name, condition, detail = "") => {
    if (condition) {
        console.log(`  ✓ ${name}`);
    } else {
        console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
        failures.push(name);
    }
};

const run = async () => {
    console.log(`\nIntellMeet smoke tests → ${API_ROOT}\n`);

    try {
        const health = await axios.get(`${API_ROOT}/health`);
        assert("Health endpoint", health.status === 200 && health.data.status === "ok");
    } catch (e) {
        assert("Health endpoint", false, e.message);
    }

    let token;
    let meetingId;

    try {
        const login = await axios.post(`${API}/auth/google-login`, {
            email: `smoke-${Date.now()}@intellmeet.test`,
            username: `smoke_user_${Date.now()}`,
            avatar: "https://example.com/avatar.png",
        });
        token = login.data.accessToken;
        assert("Auth (google-login)", !!token);
    } catch (e) {
        assert("Auth (google-login)", false, e.response?.data?.message || e.message);
    }

    if (token) {
        const headers = { Authorization: `Bearer ${token}` };

        try {
            const meeting = await axios.post(
                `${API}/meetings`,
                { title: "CI Smoke Test Meeting" },
                { headers }
            );
            meetingId = meeting.data.meetingId;
            assert("Create meeting", !!meetingId);
        } catch (e) {
            assert("Create meeting", false, e.response?.data?.message || e.message);
        }

        if (meetingId) {
            try {
                const notes = await axios.post(
                    `${API}/meetings/${meetingId}/notes`,
                    { notes: "Smoke test note" },
                    { headers }
                );
                assert("Save notes", notes.status === 200);
            } catch (e) {
                assert("Save notes", false, e.response?.data?.message || e.message);
            }

            try {
                const end = await axios.post(`${API}/meetings/${meetingId}/end`, {}, { headers });
                assert("End meeting + AI summary", end.data.meeting?.status === "ended");
            } catch (e) {
                assert("End meeting + AI summary", false, e.response?.data?.message || e.message);
            }
        }

        try {
            const notifRes = await axios.get(`${API}/notifications`, { headers });
            assert("Notifications API", notifRes.status === 200);
        } catch (e) {
            assert("Notifications API", false, e.response?.data?.message || e.message);
        }
    }

    try {
        const metrics = await axios.get(`${API_ROOT}/metrics`);
        assert("Prometheus metrics", metrics.status === 200 && String(metrics.data).includes("http_requests_total"));
    } catch (e) {
        assert("Prometheus metrics", false, e.message);
    }

    console.log("");
    if (failures.length) {
        console.error(`FAILED: ${failures.length} test(s)\n`);
        process.exit(1);
    }
    console.log("All smoke tests passed.\n");
};

run();
