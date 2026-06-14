# AWS Deployment Guide

## Option A: ECS Fargate (recommended for full stack)

1. Push images to ECR:
   ```bash
   aws ecr create-repository --repository-name intellmeet-server
   aws ecr create-repository --repository-name intellmeet-frontend
   docker tag intellmeet-server:latest $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/intellmeet-server:latest
   docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/intellmeet-server:latest
   ```

2. Store secrets in **AWS Secrets Manager**:
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - `OPENAI_API_KEY`, `CLOUDINARY_*`, `SENTRY_DSN`

3. Use **Amazon DocumentDB** or **MongoDB Atlas** for `MONGO_URI`.
4. Use **ElastiCache Redis** for `REDIS_URL`.
5. Deploy via **ECS task definitions** referencing the Helm chart values or use **EKS + Helm**:
   ```bash
   helm upgrade --install intellmeet ./helm/intellmeet \
     --namespace intellmeet --create-namespace \
     --set secrets.jwtAccessSecret=$JWT_ACCESS_SECRET \
     --set env.clientUrl=https://meet.yourdomain.com
   ```

## Option B: EKS + Helm

```bash
kubectl create namespace intellmeet
helm upgrade --install intellmeet ./helm/intellmeet -f helm/intellmeet/values-prod.yaml
```

## Environment variables (all platforms)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | MongoDB connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_ACCESS_SECRET` | Yes | Access token signing secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret |
| `CLIENT_URL` | Yes | Frontend origin for CORS |
| `OPENAI_API_KEY` | No | Whisper + GPT summaries |
| `SENTRY_DSN` | No | Error tracking |
| `CLOUDINARY_*` | No | Avatar uploads |

## Vercel + Render (hybrid)

- **Frontend**: Deploy `frontend/` to Vercel; set `deploy/vercel.json` API proxy to Render backend URL.
- **Backend**: Deploy `server/` to Render using `deploy/render.yaml`.
- Set `CLIENT_URL` on Render to your Vercel domain.
