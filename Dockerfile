# Build stage - compile TypeScript and build Vite frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Changed from npm ci to npm install to fix the lockfile sync error
RUN npm install

COPY . .

RUN npm run build
RUN npx tsc --outDir dist-server server.ts

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./

# Changed from npm ci to npm install to fix the lockfile sync error
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY migrations ./migrations

# Expose port 3000 to match server.ts
EXPOSE 3000

CMD ["node", "dist-server/server.js"]