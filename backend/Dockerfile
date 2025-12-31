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

# Expose port
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Start server
CMD ["node", "dist/index.js"]

