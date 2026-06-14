# IntellMeet Security & Privacy

## Authentication

- **JWT access tokens** (short-lived) + **HTTP-only refresh cookies** for session renewal
- Passwords hashed with **bcrypt**
- Auth endpoints protected by **rate limiting** (50 req / 15 min)
- Global API rate limit: **500 req / 15 min** per IP

## OWASP Top 10 Mitigations

| Risk | Mitigation |
|------|------------|
| A01 Broken Access Control | JWT middleware on protected routes; user-scoped notifications |
| A02 Cryptographic Failures | bcrypt passwords; secrets via env / K8s Secrets / AWS Secrets Manager |
| A03 Injection | Mongoose ODM parameterized queries; JSON body size limits |
| A04 Insecure Design | Optional auth for guest meetings; role-based team invites |
| A05 Security Misconfiguration | Helmet headers; non-root Docker users; prod error sanitization |
| A06 Vulnerable Components | `npm audit` in CI pipeline |
| A07 Auth Failures | Rate-limited login; refresh token rotation |
| A08 Data Integrity | HTTPS enforced in production ingress / cloud platforms |
| A09 Logging & Monitoring | Sentry error tracking; Prometheus metrics; Grafana dashboards |
| A10 SSRF | No user-controlled outbound URL fetching |

## WebRTC & Encryption

- **WebRTC media** uses DTLS-SRTP between peers (browser-native encryption)
- Signaling relayed via Socket.io over TLS in production
- **Optional E2EE**: Insertable Streams / SFrame can be added for true end-to-end encryption beyond transport-layer DTLS

## Secrets Management

- Never commit `.env` files
- Docker Compose: `${VAR}` from host environment
- Kubernetes / Helm: `Secret` resources
- Render / Vercel: platform secret stores
- AWS: Secrets Manager + IAM roles

## Security Scanning

```bash
# Local OWASP ZAP baseline
./security/zap-baseline.sh http://localhost:5173

# CI runs ZAP automatically on push to main
```

## Privacy

- Meeting transcripts stored in MongoDB; accessible to meeting participants
- Sentry configured with `sendDefaultPii: false`
- Recordings stored locally or via configured media backend
- Users can delete meetings and associated data
