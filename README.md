# IntellMeet 📡

AI-powered enterprise meeting and collaboration platform — real-time video (WebRTC), live chat, screen sharing, AI transcription & summaries, Kanban workspaces, and real-time notifications.

## Features

| Area | Capabilities |
|------|-------------|
| **Core** | React 19, TypeScript, Tailwind CSS, WebRTC video, Socket.io chat, screen share |
| **AI** | OpenAI Whisper transcription, GPT/Gemini meeting summaries, action-item extraction |
| **Collaboration** | Kanban board, in-meeting tasks, @mention notifications |
| **Ops** | Docker multi-stage builds, Kubernetes + Helm, GitHub Actions CI/CD |
| **Observability** | Prometheus metrics, Grafana dashboards, Sentry error tracking |
| **Security** | JWT + refresh tokens, Helmet, rate limiting, OWASP ZAP in CI |

## Architecture

```
Browser (React/TS) ──WebRTC──► Peers
        │ Socket.io / REST
        ▼
   Express API ──► MongoDB (meetings, users, tasks, notifications)
        │           Redis (cache)
        ├──► OpenAI (Whisper + GPT)
        ├──► Cloudinary (avatars)
        └──► Sentry (errors)
```

**Event-driven design**: Socket.io relays WebRTC signals, chat, notes, transcripts, task updates, and notifications in real time.

## Quick Start (Local)

```bash
# 1. Infrastructure
docker compose up -d

# 2. Environment
cp server/.env.example server/.env
cp frontend/.env.example frontend/.env
# Edit secrets (JWT, OpenAI, Cloudinary)

# 3. Dev mode
cd server && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**

### Full stack via Docker

```bash
docker compose up -d --build
# Frontend: http://localhost:5173  (nginx proxies /api and /socket.io)
# API health: http://localhost:5000/health
```

### Monitoring stack

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3000  (admin / admin)
```

## Environment Variables

See `server/.env.example` and `frontend/.env.example`.

| Variable | Required | Purpose |
|----------|----------|---------|
| `JWT_ACCESS_SECRET` | Yes | Access token signing |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing |
| `MONGO_URI` | Yes | MongoDB connection |
| `REDIS_URL` | Yes | Redis cache |
| `CLIENT_URL` | Yes | CORS origin |
| `OPENAI_API_KEY` | No | Whisper + GPT summaries |
| `SENTRY_DSN` | No | Error tracking |

## Testing

```bash
# Smoke tests (server must be running)
cd server && npm run test:smoke

# Load testing (requires Apache JMeter)
jmeter -n -t load-tests/intellmeet-load.jmx -Jhost=localhost -Jport=5000 -l results.jtl

# Security scan (requires Docker)
bash security/zap-baseline.sh http://localhost:5173
```

## CI/CD Pipeline

GitHub Actions (`.github/workflows/ci-cd.yml`):

1. **Lint & Build** — ESLint, TypeScript build, npm audit
2. **Docker Build** — Multi-stage server + frontend images
3. **Integration Tests** — Docker Compose + smoke tests
4. **Security Scan** — OWASP ZAP baseline (main branch)
5. **Publish** — Push images to GHCR
6. **Deploy** — Optional Render deploy hook

## Kubernetes & Helm

```bash
# Raw manifests
kubectl apply -f k8s/

# Helm (recommended)
helm upgrade --install intellmeet ./helm/intellmeet \
  --namespace intellmeet --create-namespace \
  --set secrets.jwtAccessSecret=YOUR_SECRET \
  --set ingress.host=meet.example.com
```

Includes HPA (2–8 server replicas), ingress with WebSocket support, and Prometheus scrape annotations.

## Cloud Deployment

| Platform | Config | Notes |
|----------|--------|-------|
| **Render** | `deploy/render.yaml` | Web service + MongoDB + Redis |
| **Vercel + Render** | `deploy/vercel.json` | Static frontend + API proxy |
| **AWS** | `deploy/AWS.md` | ECS Fargate or EKS + Helm |

Set all secrets in the platform's secret manager — never in source control.

## PDF Export & Reports

From **Dashboard → Meeting History → Open Details**:

- **Export JSON** — full meeting report (summary, tasks, transcript)
- **Print / Save PDF** — browser print-to-PDF for shareable reports

## Demo Video

Record a walkthrough covering:

1. Sign up / login → create meeting → join room
2. WebRTC video, chat with `@mention`, screen share
3. Live captions + recording → Whisper transcript in history
4. End meeting → AI summary + action items on Kanban
5. Notification bell + Grafana dashboard (optional)

Suggested tools: OBS Studio, Loom, or Windows Game Bar.

## Challenges & Learnings

| Challenge | Solution |
|-----------|----------|
| WebRTC NAT traversal | STUN servers + Socket.io signaling relay |
| Real-time state sync | Event-driven Socket.io channels (room, team, user) |
| AI latency on long meetings | Whisper post-recording + incremental live captions |
| Circular deps (Socket + controllers) | Shared `config/socket.js` registry |
| TypeScript migration at scale | Shared types + incremental strict typing |

## Industry Best Practices Applied

- **Multi-stage Docker builds** — minimal production images, non-root users
- **12-factor config** — environment-based secrets
- **CI/CD gates** — lint → build → test → scan → deploy
- **Observability** — `/health`, `/metrics`, Sentry, Grafana
- **Defense in depth** — Helmet, CORS, rate limits, OWASP ZAP

## Security & Privacy

See [SECURITY.md](./SECURITY.md) for JWT details, OWASP Top 10 mitigations, WebRTC encryption notes, and secrets management.

## Project Structure

```
meet/
├── frontend/          React 19 + TypeScript + Tailwind
├── server/            Express + Socket.io + AI services
├── helm/intellmeet/   Helm chart
├── k8s/               Kubernetes manifests
├── monitoring/        Prometheus + Grafana config
├── load-tests/        JMeter plans
├── security/          OWASP ZAP scripts
├── deploy/            Vercel, Render, AWS guides
└── .github/workflows/ CI/CD pipeline
```

## License

ISC
