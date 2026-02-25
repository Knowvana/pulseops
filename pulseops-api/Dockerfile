# ============================================================================
# Dockerfile — PulseOps API
#
# Single-stage Node.js container for Kubernetes deployment.
# Runs as non-root user for security.
# ============================================================================
FROM node:20-alpine

RUN addgroup -S pulseops && adduser -S pulseops -G pulseops

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --silent

COPY . .

RUN chown -R pulseops:pulseops /app
USER pulseops

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health/liveness || exit 1

CMD ["node", "src/server.js"]
