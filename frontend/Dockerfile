# ─── Frontend Dockerfile (multi-stage) ────────────────────────────────────
# Stage 1: Build the Vite/React app
# Stage 2: Serve the static bundle with nginx
#
# VITE_API_URL is intentionally left empty so the app sends requests to /api/*
# and nginx (in stage 2) proxies them to the backend container.
# No code changes needed between dev (Vite proxy) and prod (nginx proxy).
# ───────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (cached layer — only re-runs when package-lock.json changes)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build


# ── Stage 2: Serve ─────────────────────────────────────────────────────────
FROM nginx:alpine

# Copy the built bundle
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace the default nginx config with our SPA + proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
