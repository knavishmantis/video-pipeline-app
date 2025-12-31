# Build stage
FROM node:18-alpine AS builder

# Create the project root structure
WORKDIR /workspace

# Copy shared types first (needed for imports)
COPY shared ./shared

# Copy backend package files
COPY backend/package*.json ./backend/
WORKDIR /workspace/backend
RUN npm ci

# Copy backend source
WORKDIR /workspace
COPY backend/ ./backend/

# Build TypeScript (from backend directory to match tsconfig)
WORKDIR /workspace/backend
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /workspace/backend/dist ./dist

# Verify the structure
RUN echo "=== Dist folder structure ===" && \
    ls -la dist/ && \
    echo "=== Looking for index.js ===" && \
    find dist -name "index.js" -type f && \
    echo "=== Contents of dist/src (if exists) ===" && \
    ls -la dist/src/ 2>/dev/null || echo "dist/src does not exist"

# Expose port
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Start server - find index.js dynamically
CMD ["sh", "-c", "INDEX_FILE=$(find dist -name 'index.js' -type f | head -1); if [ -z \"$INDEX_FILE\" ]; then echo 'ERROR: index.js not found in dist/'; find dist -type f; exit 1; else echo \"Starting server with: $INDEX_FILE\"; node \"$INDEX_FILE\"; fi"]

