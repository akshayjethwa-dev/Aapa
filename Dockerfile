# Build stage - compile TypeScript and build Vite frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm install

COPY . .

# Build the React frontend (Outputs to /app/dist)
RUN npm run build

# Bundle the Express backend using esbuild
RUN npx esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=dist-server/server.js

# Bundle the migration script using esbuild
RUN npx esbuild scripts/migrate.ts --bundle --platform=node --format=esm --packages=external --outfile=dist-server/migrate.js

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the bundled server and scripts
COPY --from=builder /app/dist-server ./dist-server

# Copy the frontend 'dist' INSIDE 'dist-server' so the backend can find it
COPY --from=builder /app/dist ./dist-server/dist

# Copy migrations INSIDE 'dist-server' so the backend can run the SQL files
COPY migrations ./dist-server/migrations

# Expose port 3000 to match server.ts
EXPOSE 3000

# Start ONLY the server
CMD ["node", "dist-server/server.js"]