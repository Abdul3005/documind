# DocuMind — Project Build Log & Engineering Report

**Project Name:** DocuMind — AI-Powered Document Assistant  
**Author / Lead Engineer:** Abdul Rehman  
**Tech Stack:** MERN (MongoDB Atlas, Express.js, React 18, Node.js) + OCR (PDF-Parse & Tesseract.js) + LLM (Google Gemini API REST)  
**Date Completed:** August 9, 2026  

---

## 1. Project Overview & Architecture

DocuMind is an end-to-end AI document processing and intelligence platform built to enable seamless document uploading, automated text extraction, grounded question-answering, and bulleted AI summarization.

### Core Architectural Components:
1. **Backend Server (`backend/server.js`, `backend/src/app.js`)**:
   - Built on Node.js and Express.js using ES Modules (`import/export`).
   - Implements strict layered architecture (`routes` -> `controllers` -> `services` -> `models`).
   - Centralized error handling middleware (`errorHandler.js`) returning standardized JSON error objects and specific HTTP status codes (`400` for invalid format/missing fields, `413` for oversized files >10MB, `422` for extraction errors, `404` for missing resources).

2. **Database Layer (`backend/src/config/db.js`, `backend/src/models/`)**:
   - Connected to MongoDB Atlas cluster `documind`.
   - **`Document` Model**: Stores filename, fileType (`pdf` | `image`), extracted text content, processing status (`processing` | `ready` | `failed`), and creation timestamps.
   - **`Message` Model**: Stores conversation history linked via `documentId`, tracking `role` (`user` | `assistant`), content text, and timestamps. Indexed by `documentId` and `createdAt`.

3. **Dual-Engine OCR Pipeline (`backend/src/services/ocr.service.js`)**:
   - **PDF Extraction**: Utilizes `pdf-parse` for text extraction from PDF documents.
   - **Image Extraction**: Utilizes `tesseract.js` worker for OCR text recognition from PNG and JPG images.
   - **Disk Lifecycle**: Uploaded files are temporarily held in `backend/uploads/` with status `'processing'`, and are strictly purged from disk *after* extraction completes.

4. **Provider-Agnostic AI Service (`backend/src/services/ai.service.js`)**:
   - Dynamically loads `LLM_API_KEY`, `LLM_API_BASE_URL`, and `LLM_MODEL_NAME` (`gemini-flash-latest`).
   - Supports both Google Gemini REST API endpoints (`generateContent`) and OpenAI-compatible Chat Completions endpoints.
   - Constructs grounded prompts enforcing non-hallucination rules (answers must be based strictly on document context; explicitly declines out-of-document queries).
   - Enforces a 24,000 character context truncation safety budget (~6,000–8,000 tokens).

5. **Frontend UI Shell (`frontend/src/`)**:
   - React 18 SPA built with Vite and Tailwind CSS featuring modern glassmorphism panels, dark slate aesthetics, and custom scrollbars.
   - Component architecture: `Navbar`, `UploadDropzone`, `DocumentPreviewPanel`, `ChatWindow`, `ChatMessage`, `ChatInput`, `LoadingSpinner`, `ErrorBanner`, `EmptyState`.
   - Custom Hooks: `useDocuments` for library state and uploads; `useChat` for workspace messages, live Q&A streaming, and AI summary generation.

---

## 2. Phase-by-Phase Development Log

| Phase | Description | Key Achievements |
| :--- | :--- | :--- |
| **Phase 1: Setup** | Project scaffolding | Initialized React Vite frontend and Express backend folder structure matching `MASTER_PLAN.md`. Initial Git commit created. |
| **Phase 2: Backend Foundation** | Core server & middleware | Implemented `server.js`, `app.js`, health check route (`/api/health`), CORS, and centralized `errorHandler.js`. |
| **Phase 3: Database Integration** | MongoDB Atlas setup | Created Mongoose connection (`db.js`) and defined `Document` & `Message` schemas. Verified live MongoDB Atlas connectivity. |
| **Phase 4: Document Upload** | Multer upload pipeline | Configured Multer storage middleware with 10MB limit and PDF/PNG/JPG MIME validation. Built `POST /api/documents/upload`. |
| **Phase 5: OCR / Text Extraction** | OCR service implementation | Built `ocr.service.js` combining `pdf-parse` and `tesseract.js`. Implemented async extraction lifecycle (`processing` -> `ready` / `failed`) and post-extraction disk file purging. |
| **Phase 6: LLM Integration** | Grounded AI Service | Implemented `ai.service.js` and `chat.controller.js` for `POST /api/documents/:id/messages` and `POST /api/documents/:id/summarize`. Verified live Gemini REST API answers and anti-hallucination grounding. |
| **Phase 7: React UI Shell** | Frontend UI components | Created glassmorphism components (`Navbar`, `UploadDropzone`, `DocumentPreviewPanel`, `ChatWindow`, `ChatMessage`, `ChatInput`, `Dashboard`, `DocumentWorkspace`). |
| **Phase 8: API Integration** | Frontend-Backend wiring | Built `services/api.js` (Axios) and `useDocuments`/`useChat` hooks. Wired live health checks, file upload, message streaming, and summary generation. |
| **Phase 9: Testing & Polish** | Validation & edge cases | Tested file limits (`HTTP 413`), corrupted PDFs (`HTTP 422`), empty questions (`HTTP 400`), non-existent IDs (`HTTP 404`), and LLM error resilience. Cleaned up ad-hoc scripts. |
| **Phase 10: Deployment Setup** | Production readiness | Created `frontend/vercel.json`, `backend/render.yaml`, and root `README.md`. |

---

## 3. AI Tooling & Prompting Log

Development of DocuMind was conducted in continuous pair programming with **Antigravity** (Google DeepMind team):

1. **Prompt Strategy**:
   - `MASTER_PLAN.md` was provided as the single source of truth for architecture, file hierarchy, schemas, and endpoints.
   - Instructions were requested phase-by-phase, enforcing strict verification before proceeding to subsequent phases.

2. **Automated Verification**:
   - Terminal verification scripts and automated Puppeteer browser sessions were utilized to test backend endpoints, database persistence, and frontend UI states.
   - Real API keys were validated against live Google Gemini REST endpoints (`gemini-flash-latest`).

3. **Key Debugging Highlights**:
   - **Tesseract Worker Path**: Resolved Node ES Module buffer/worker initialization by converting file paths to Uint8Array.
   - **Multer Status Code**: Aligned file size limit errors from HTTP 500/400 to HTTP 413 Payload Too Large per specification.
   - **Gemini Model Name Alignment**: Identified model deprecations and configured `gemini-flash-latest` as the optimal active model for `v1beta` REST endpoints.

---

## 4. Test & Validation Results Summary

- **MongoDB Atlas Connection**: Verified live against cluster `documind`.
- **Upload & OCR Processing**: Verified text extraction for PDF offer letters (314 characters) and PNG invoice images.
- **Live Gemini Grounding**: Verified accurate extraction of specific facts (e.g. `$140,000 USD base salary`), correct decline for out-of-document questions (e.g. employee ID), and bulleted summary generation.
- **Edge Cases**: Verified HTTP 413 for 11MB files, HTTP 400 for `.txt`/`.docx`, HTTP 422 for corrupted PDFs, and HTTP 404 for invalid IDs.

---

## 5. Security & Production Compliance

- **Secrets Handling**: Sensitive credentials (`MONGODB_URI`, `LLM_API_KEY`) are isolated in `backend/.env` (excluded from git).
- **Environment Example**: `backend/.env.example` contains only placeholder key strings.
- **Render Config**: `backend/render.yaml` sets `sync: false` for secrets, ensuring keys are configured securely via dashboard environment variables.
- **Repository Hygiene**: Ad-hoc test scripts were purged, leaving a clean, standard project directory structure.

---

## 6. V2 Engineering & Improvement Log

| Phase | Description | Key Achievements & Engineering Decisions |
| :--- | :--- | :--- |
| **V2 Phase 0** | Baseline Tagging & Branching | Tagged current working submission commit `c7f0180` as `v1-submission` to preserve initial 8.0 baseline. Created and checked out `v2-improvements` branch. Zero application code modified. |
| **V2 Phase 1** | User Authentication System | Implemented `User` Mongoose model with `bcryptjs` password hashing pre-save hook and `matchPassword` method. Built `auth.service.js`, `auth.controller.js`, `auth.routes.js`, and `auth.middleware.js` (`protect`). Mounted `/api/auth` (register, login, me). Created 10 integration tests (`backend/tests/auth.test.js`) with Vitest, Supertest, and `mongodb-memory-server` covering user registration, password non-plaintext validation, duplicate rejection, credential verification, JWT issuance, and protected route access (10/10 tests passed). |
| **V2 Phase 2** | Authorization & Ownership Isolation | Added `userId` indexed schema references to `Document` and `Message` models. Applied `protect` middleware to `/api/documents` and `/api/documents/:id/messages` routes. Converted all service & controller queries from `findById` to `findOne({ _id: id, userId })`, returning `404 Not Found` for unowned documents to prevent ID enumeration. Implemented cascade deletion of `Message` records on `Document` deletion. Created 9 integration tests in `backend/tests/documents.test.js` validating multi-tenant isolation, cross-user read/write/chat/delete rejection, and cascade message deletion (19/19 total backend tests passed). |
| **V2 Phase 3** | Scanned PDF & OCR Fallback | Added `extractionMethod` (`text` | `ocr`) enum field to `Document` model. Refactored `ocr.service.js` into a 2-stage text extraction pipeline: attempts fast direct text extraction via `pdf-parse`, evaluates extracted length against a 50-character threshold, and automatically triggers Tesseract OCR fallback (`pdf-lib` stream extraction + `tesseract.js`) for scanned PDFs lacking a text layer. Added PDF magic byte validation (`%PDF-`) and graceful error handling for unreadable files. Created 4 integration tests in `backend/tests/ocr.test.js` (23/23 total backend tests passed). |
| **V2 Phase 4** | RAG Architecture & Vector Search | Created `chunking.service.js` (~800 characters target chunk size, ~150 characters overlap), `embedding.service.js` (Gemini `text-embedding-004` 768d vector model with local hash vector fallback), `retrieval.service.js` (MongoDB Atlas `$vectorSearch` with pure in-memory Cosine Similarity fallback, Top-K=3 ranking, and strict `userId` ownership query scoping). Updated `Document` schema with `chunks` array. Integrated chunking + embeddings into document ingestion pipeline. Refactored `ai.service.js` and `chat.controller.js` to build grounded prompts bounded by explicit `<<<CONTEXT>>>` delimiters and return source citation metadata (`sources: [{ chunkIndex, similarity }]`). Created 11 automated integration tests in `backend/tests/rag.test.js` (34/34 total backend tests passed). |

