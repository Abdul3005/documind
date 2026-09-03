# DocuMind V2 — AI-Powered Local Document Assistant

DocuMind V2 is a portfolio-grade full-stack MERN application (MongoDB, Express, React, Node.js) featuring local privacy-first OCR text extraction, ONNX vector embeddings, and Ollama LLM question answering with retrieval-augmented generation (RAG). It enables users to upload PDF contracts or image receipts, automatically extract text (with Tesseract OCR fallback for scanned documents), generate AI summaries, and ask grounded questions in real time.

---

## 🌟 Key Features

- **Multi-Format Document Upload & Security**: Supports PDF files, PNG, and JPG images with strict 50MB file size validation, maximum 3000 PDF page limit validation, magic-byte binary header signature verification, and request-level upload budgets (180s).
- **Dual-Engine OCR Text Extraction & Fault Isolation**:
  - **Text PDFs**: Extracted synchronously via `pdf-parse` with page-count pre-validation.
  - **Scanned PDFs / Images**: Automatic fallback to `tesseract.js` OCR image recognition with per-page timeouts (30s), batch worker management, and memory cleanup when document text layers are insufficient (<50 characters).
- **Local ONNX Vector Embeddings**: Uses `@xenova/transformers` with `Xenova/bge-base-en-v1.5` to generate 768-dimensional normalized floating-point vectors processed in safe configurable batches (16 chunks/batch).
- **Privacy-First Local RAG & LLM Generation**: Grounded question-answering powered locally by Ollama (`qwen2.5:1.5b`) with context-bounded prompts (`<<<CONTEXT>>>`), 60s AbortSignal timeout protection, and refusal handling to prevent hallucination.
- **Automated AI Document Summarization**: Bounded prompt construction for large documents with sample sampling and map-reduce chunk summarization to ensure LLM context is never overloaded.
- **JWT Authentication & User Ownership Isolation**: Complete user authentication via JWT tokens and bcrypt password hashing, enforcing strict database isolation so users can only access their own documents, messages, and vector embeddings.
- **API Rate Limiting**: Built-in sliding-window rate limiting protecting authentication (`/api/auth`, 10 req / 15 min) and document upload (`/api/documents/upload`, 10 req / 15 min) endpoints.
- **Modern Glassmorphism UI**: Built with React 18, Vite, Tailwind CSS, Lucide icons, and React Markdown.
- **Automated CI/CD**: GitHub Actions workflow validating backend test execution, frontend test execution, and frontend production build on every push and pull request.

---

## 🏗️ Tech Stack & Architecture

- **Frontend**: React 18, Vite, Tailwind CSS, Axios, Lucide React, React Markdown.
- **Backend**: Node.js, Express.js, Multer (file upload), `pdf-parse`, `pdf-lib`, `tesseract.js`, `express-rate-limit`.
- **Database**: MongoDB Atlas via Mongoose (enforces user-isolated Document, Message, and Vector Chunk schemas).
- **AI Services**:
  - **Embeddings**: Local ONNX model `Xenova/bge-base-en-v1.5` (768 dimensions).
  - **LLM Generation**: Local Ollama daemon (`qwen2.5:1.5b` model at `http://localhost:11434`).
- **Testing & CI/CD**: Vitest (43 passing backend tests & 8 passing frontend tests = 51 total tests), GitHub Actions CI.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18+ (v20 LTS recommended)
- **MongoDB Atlas**: Database connection string
- **Ollama**: Installed locally on host machine (`https://ollama.com`)

---

### Environment Setup

1. **Backend Environment**:
   Create `backend/.env`:
   ```env
   PORT=5000
   CORS_ORIGIN=http://localhost:5173
   MONGODB_URI=your_mongodb_connection_string_here
   JWT_SECRET=your_jwt_secret_key_32_chars_minimum_spec
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=qwen2.5:1.5b
   ```

2. **Frontend Environment**:
   Create `frontend/.env` (optional):
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```

3. **Ollama Setup**:
   Pull the lightweight 1.5B local model before starting:
   ```bash
   ollama pull qwen2.5:1.5b
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

## 🧪 Testing & CI/CD

- **Automated Backend Tests**:
  ```bash
  cd backend
  npm test
  ```
  *Executes 43 passing Vitest tests covering Auth, Document Ownership Isolation, OCR Fallback, 50MB & 3000 PDF page limits, zlib stream inflation, RAG retrieval pipelines, and edge cases.*

- **Automated Frontend Tests**:
  ```bash
  cd frontend
  npm test
  ```
  *Executes 8 passing Vitest tests covering Login/Register, ChatMessage, ConfirmModal, Dashboard OCR, and Empty/Error state UI components.*

- **Frontend Production Build**:
  ```bash
  cd frontend
  npm run build
  ```
  *Compiles production dist assets with zero errors.*

- **Continuous Integration**:
  Automated GitHub Actions workflow (`.github/workflows/ci.yml`) runs backend tests, frontend tests, and frontend production builds on all pushes and pull requests.

---

## 📡 API Reference

| Method | Endpoint | Description | Rate Limit |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health check returning API status | Unlimited |
| `POST` | `/api/auth/register` | Register new user account & return JWT | 10 req / 15 min |
| `POST` | `/api/auth/login` | Authenticate user & return JWT token | 10 req / 15 min |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Protected |
| `POST` | `/api/documents/upload` | Upload PDF/image (max 50MB, max 3000 pages) & run OCR/embeddings | 10 req / 15 min |
| `GET` | `/api/documents` | List user-owned documents | Protected |
| `GET` | `/api/documents/:id` | Fetch specific document details & text | Protected |
| `DELETE` | `/api/documents/:id` | Delete document & cascade delete chat history | Protected |
| `POST` | `/api/documents/:id/messages` | Submit grounded question via RAG vector search | Protected |
| `GET` | `/api/documents/:id/messages` | Fetch conversation history for document | Protected |
| `POST` | `/api/documents/:id/summarize` | Generate AI summary of document text | Protected |

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for details.
