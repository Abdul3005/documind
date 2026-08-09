# DocuMind — AI-Powered Document Assistant

DocuMind is a production-ready, full-stack MERN application (MongoDB, Express, React, Node.js) with OCR text extraction and LLM integration. It allows users to upload PDF contracts or image receipts, extract text via OCR, generate structured AI summaries, and ask grounded questions in real time.

### 🌐 Live Deployment Links
- **Frontend App**: [https://documind-one-sigma.vercel.app](https://documind-one-sigma.vercel.app)
- **Backend API**: [https://documind-backend-pbbq.onrender.com](https://documind-backend-pbbq.onrender.com)


---

## 🌟 Key Features

- **Multi-Format Document Upload**: Supports PDF files, PNG, and JPG images with strict 10MB limit enforcement.
- **Dual-Engine OCR Text Extraction**:
  - **PDFs**: Parsed using `pdf-parse` for text extraction.
  - **Images**: OCR powered by `tesseract.js`.
- **Grounded LLM Question Answering**: Provider-agnostic AI engine (Google Gemini API REST endpoint & OpenAI-compatible endpoints) grounded strictly in document content to prevent hallucination.
- **Automated AI Document Summarization**: Generates bulleted summaries highlighting key takeaways, dates, and compensation details.
- **Modern Glassmorphism UI**: Built with React 18, Vite, Tailwind CSS, Lucide icons, and React Markdown.
- **Resilient Error Handling**: Centralized error middleware returning standard JSON responses (`HTTP 413` for oversized files, `HTTP 400` for invalid types, `HTTP 422` for corrupted extraction).

---

## 🏗️ Tech Stack & Architecture

- **Frontend**: React 18, Vite, Tailwind CSS, Axios, Lucide React, React Markdown.
- **Backend**: Node.js, Express.js, Multer (file upload), pdf-parse, Tesseract.js.
- **Database**: MongoDB Atlas via Mongoose.
- **AI Services**: Google Gemini REST API (`gemini-flash-latest`), with mock development fallback mode.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- MongoDB Atlas database connection string
- Google Gemini API Key (or OpenAI-compatible key)

---

### Environment Setup

1. **Backend Environment**:
   Copy `.env.example` in `backend/` to `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```

   Fill in your environment variables:
   ```env
   PORT=5000
   CORS_ORIGIN=http://localhost:5173
   MONGODB_URI=your_mongodb_connection_string_here
   LLM_API_KEY=your_gemini_api_key_here
   LLM_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
   LLM_MODEL_NAME=gemini-flash-latest
   ```

2. **Frontend Environment**:
   Create `frontend/.env` (optional):
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```

---

### Installation & Running Locally

1. **Install Backend Dependencies & Start Server**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   *The backend will run on `http://localhost:5000`.*

2. **Install Frontend Dependencies & Start App**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *The frontend application will launch on `http://localhost:5173`.*

---

## 📡 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check endpoint returning server & database status |
| `POST` | `/api/documents/upload` | Upload PDF or image file (max 10MB) and run text extraction |
| `GET` | `/api/documents` | List all uploaded documents with status and metadata |
| `GET` | `/api/documents/:id` | Fetch specific document details and extracted text |
| `DELETE` | `/api/documents/:id` | Delete document record and chat history |
| `POST` | `/api/documents/:id/messages` | Submit question grounded in document content |
| `GET` | `/api/documents/:id/messages` | Fetch conversation history for document |
| `POST` | `/api/documents/:id/summarize` | Generate AI summary of document text |

---

## 🚢 Deployment Guide

### Frontend Deployment (Vercel)
1. Push code to GitHub repository.
2. Import project into Vercel and set root directory to `frontend`.
3. Build command: `npm run build`, Output directory: `dist`.
4. Add environment variable: `VITE_API_BASE_URL` pointing to live backend URL.

### Backend Deployment (Render / Fly.io)
1. Import repository into Render as a Web Service with root directory `backend`.
2. Environment: `Node`, Build Command: `npm install`, Start Command: `npm start`.
3. Add environment variables: `MONGODB_URI`, `LLM_API_KEY`, `LLM_API_BASE_URL`, `LLM_MODEL_NAME`.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for details.
