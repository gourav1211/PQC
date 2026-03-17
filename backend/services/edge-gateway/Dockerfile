# H2A-PQC Edge Gateway
# Intelligent gateway for PQC verification and LLAS aggregation
# ==============================================================

FROM node:20-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Environment variables
ENV NODE_ENV=production
ENV PORT=4000
ENV WS_PORT=4001
ENV MODE=h2a
ENV AGGREGATION_BATCH_SIZE=50
ENV AGGREGATION_TIMEOUT_MS=5000
ENV LOG_LEVEL=info

# Expose ports
EXPOSE 4000 4001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Run the gateway
CMD ["node", "src/server.js"]
