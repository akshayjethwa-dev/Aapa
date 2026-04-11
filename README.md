<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7cb2f4cc-558a-4439-80bd-e017a2fd297c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deployment & Docker 🐳

This application is fully containerized and production-ready.

### Local Development with Docker
To spin up the application along with a local PostgreSQL database, run:
\`\`\`bash
docker-compose up --build
\`\`\`
The application will be accessible at `http://localhost:3000`.

### Production Deployment
To build the standalone Docker image for deployment to any VPS, Render, or Railway:
\`\`\`bash
docker build -t aapa-capital .
\`\`\`
Run the built image:
\`\`\`bash
docker run -p 3000:3000 --env-file .env aapa-capital
\`\`\`