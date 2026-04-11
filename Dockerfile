# Build stage - compile TypeScript and build Vite frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm install

COPY . .

# Build the React frontend
RUN npm run build

# Compile the Express server with modern Node/ESM flags
RUN npx tsc server.ts --outDir dist-server --target es2022 --module es2022 --moduleResolution node --esModuleInterop --skipLibCheck

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy built assets from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY migrations ./migrations

# Expose port 3000 to match server.ts
EXPOSE 3000

# Start the server
CMD ["node", "dist-server/server.js"]