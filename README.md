# IntellMeet 📡

IntellMeet is an AI-powered enterprise meeting and collaboration platform developed using the MERN stack. It enhances communication and productivity for modern remote and hybrid teams by providing real-time video conferencing, live chat, screen sharing, AI-generated meeting summaries, and collaborative team workspaces.

## Features

- **Frictionless Authentication**: Username/password accounts, or join as an anonymous guest.
- **Real-Time Video & Chat**: Powered by WebRTC and Socket.io.
- **AI Meeting Summaries**: Automated transcript analysis to extract action items.
- **Project Board**: Kanban-style task management for team coordination.
- **Cloudinary Avatar Uploads**: Personalize your profile.
- **High Performance**: Redis caching for rapid meeting load times and Express Rate Limiting for security.

## Tech Stack

- **Frontend**: React, Vite, React Router, Socket.io-client
- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.io, WebRTC
- **Caching**: Redis
- **Media**: Cloudinary (Avatars), Multer

## Getting Started

### Prerequisites

- Node.js (v16+)
- Docker & Docker Compose (for running Redis and MongoDB locally)
- Cloudinary Account
- OpenAI API Key (for AI summaries)

### Installation

1. **Clone the repository**
2. **Start Local Services (MongoDB & Redis)**
   ```bash
   docker-compose up -d
   ```
3. **Setup Environment Variables**
   Create a `.env` file in the `server` directory:
   ```env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/intellmeet
   JWT_ACCESS_SECRET=your_jwt_secret
   REDIS_URL=redis://127.0.0.1:6379
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   OPENAI_API_KEY=your_openai_key
   ```
   Create a `.env` file in the `frontend` directory:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```

4. **Install Dependencies**
   ```bash
   cd server && npm install
   cd ../frontend && npm install
   ```

5. **Start the Application**
   ```bash
   # Terminal 1 (Backend)
   cd server
   npm start

   # Terminal 2 (Frontend)
   cd frontend
   npm run dev
   ```

6. Open `http://localhost:5173` in your browser.

## Week 1 Checkpoint

This repository has completed the Week 1 roadmap, including the MERN boilerplate, WebRTC/Socket.io signaling, Authentication (JWT), Redis caching, and Cloudinary media uploads.
