# ========================================================
# --- TASK 4.1: Stage 1 - The Builder                  ---
# ========================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Install all dependencies (using ci for faster, reproducible builds)
RUN npm install

COPY . .

# Build the React frontend (Outputs to /app/dist)
RUN npm run build

# Bundle the Express backend using esbuild
RUN npx esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=dist-server/server.js

# Bundle the migration script using esbuild
RUN npx esbuild scripts/migrate.ts --bundle --platform=node --format=esm --packages=external --outfile=dist-server/migrate.js


# ========================================================
# --- TASK 4.1 & 4.2: Stage 2 - The Runner (Production)---
# ========================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Install curl for the Docker container healthcheck (Task 4.2)
RUN apk add --no-cache curl

COPY package*.json ./

# Install only production dependencies for a smaller, secure image
RUN npm install --omit=dev

# Copy the bundled server and scripts from the builder stage
COPY --from=builder /app/dist-server ./dist-server

# Copy the frontend 'dist' INSIDE 'dist-server' so the backend can serve it
COPY --from=builder /app/dist ./dist-server/dist

# Copy migrations INSIDE 'dist-server' so the backend can run the SQL files
COPY migrations ./dist-server/migrations

# ---> FIX: Copy the required Protobuf schema into the production container
COPY --from=builder /app/MarketDataFeed.proto ./

# Expose port 3000 to match server.ts
EXPOSE 3000

# Start ONLY the server
CMD ["node", "dist-server/server.js"]