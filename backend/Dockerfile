# Build stage
FROM node:20-alpine AS builder

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
FROM node:20-alpine

# Install ffmpeg (for H.264 transcoding) and yt-dlp (for video downloads).
# Alpine ships a musl-compatible yt-dlp in the community repo. Previously we
# pulled yt-dlp_linux from GitHub, which is a glibc PyInstaller bundle — it
# would land on disk but spawn(ENOENT) on Alpine because the glibc interpreter
# isn't present. Using apk guarantees a working binary + keeps it upgradable.
RUN apk add --no-cache ffmpeg yt-dlp && \
    yt-dlp --version && \
    ln -sf $(which yt-dlp) /usr/local/bin/yt-dlp

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /workspace/backend/dist ./dist

# Copy script grading criteria file (needed at runtime)
COPY --from=builder /workspace/backend/script-grading-criteria.md ./script-grading-criteria.md

# Copy research reports (backlog.json needed for /api/research/ideas)
COPY research-reports ./research-reports

# Expose port
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Start server - use the main index.js (not db/index.js or routes/index.js)
CMD ["sh", "-c", "INDEX_FILE=$(find dist -path '*/src/index.js' -not -path '*/db/*' -not -path '*/routes/*' | head -1); if [ -z \"$INDEX_FILE\" ]; then echo 'ERROR: index.js not found'; find dist -name 'index.js' -type f; exit 1; else echo \"Starting server with: $INDEX_FILE\"; node \"$INDEX_FILE\"; fi"]

