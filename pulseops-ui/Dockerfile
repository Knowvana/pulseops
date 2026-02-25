# ============================================================================
# Dockerfile — PulseOps UI
#
# Multi-stage build: Node for building, Nginx for serving.
# Produces a lightweight, stateless container for Kubernetes deployment.
# ============================================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --silent
COPY . .
RUN npm run build

# --- Stage 2: Serve ---
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
