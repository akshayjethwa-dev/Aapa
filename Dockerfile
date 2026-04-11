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
# This automatically resolves all local file paths without needing .js extensions!
RUN npx esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=dist-server/server.js

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the bundled server
COPY --from=builder /app/dist-server ./dist-server

# Copy the frontend 'dist' INSIDE 'dist-server' so the backend can find it
COPY --from=builder /app/dist ./dist-server/dist

# Copy migrations INSIDE 'dist-server' so the backend can run the SQL files
COPY migrations ./dist-server/migrations

# Expose port 3000 to match server.ts
EXPOSE 3000

# Start the server
CMD ["node", "dist-server/server.js"]