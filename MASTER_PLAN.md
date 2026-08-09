# MASTER_PLAN.md — DocuMind

**AI-Powered Document Assistant | Digitalsofts Assignment (AI-L1-01, Productivity Domain)**
**Author:** Abdul Rehman | BS Software Engineering, FAST-NUCES
**Stack:** MERN + LLM + OCR
**Status:** Planning complete — implementation not yet started

---

## 1. Project Overview

### Project Name
**DocuMind** — an AI-powered document assistant.

(Alternative names considered: DocuChat, PaperMind, ScanTalk. "DocuMind" was chosen because it reads as a product name, not a class assignment, and it works equally well on a resume, a GitHub repo, and a live demo landing page.)

### Problem Being Solved
People frequently receive PDFs and scanned documents (contracts, notes, invoices, research papers, forms) and need quick answers from them without reading the whole document. Manually searching a long document for a specific fact is slow and error-prone. DocuMind lets a user upload a document once and then "talk to it" — asking direct questions and getting grounded answers pulled from the document's actual content.

### Target Users
- Students reviewing lecture notes, papers, or scanned handouts
- Professionals reviewing contracts, reports, or invoices
- Anyone who wants a fast Q&A layer over a static document, without needing to read it end-to-end

### Main Value Proposition
Upload a document → ask questions in plain English → get answers grounded in that specific document, with a clean chat interface, in under a minute.

### Why This Project Satisfies Digitalsofts' Assignment
The assignment asks for a small LLM-powered app with OCR/document handling, a clean UI, and a sensible project structure, buildable in 10–15 hours. DocuMind is exactly this scope — one document, one chat thread, one core loop (upload → extract → ask → answer) — built with a production-style stack instead of a single-file Streamlit script.

### Why This Project Demonstrates Web Development Skills
Because the assignment explicitly allows "any equivalent" stack, DocuMind intentionally uses React + Express + MongoDB instead of Streamlit. This turns a generic "AI script" assignment into a real full-stack web application: REST APIs, a database layer, file upload handling, frontend state management, and a deployed client/server split — which is precisely what a Web Development internship evaluates, while still meeting every letter of the original brief.

---

## 2. Assignment Requirements Mapping

| Digitalsofts Requirement | DocuMind Implementation |
|---|---|
| LLM-powered app | Express backend calls a configurable LLM API to answer questions grounded in extracted document text |
| OCR / document handling | PDF text extraction (native text layer) + image OCR (Tesseract) via a dedicated backend service |
| Simple, clean UI | React + Vite + Tailwind single-page app: upload screen, document preview, chat interface |
| Sensible project structure | Clearly separated `frontend/` and `backend/` with layered architecture (routes → controllers → services → models) |
| GitHub repository | Public repo, clean commit history, professional README, `.gitignore`, no committed secrets |
| Live URL | Frontend deployed on Vercel, backend deployed on Render (or Railway), MongoDB Atlas for the database |
| README | Full setup, tech stack, architecture, screenshots, live link (see Section 20) |
| Build Log | `BUILD_LOG.md` documenting decisions, problems, and honest AI-tool usage (see Section 21) |
| Demo video (3–5 min) | Scripted walkthrough covering upload → OCR → chat → answer, plus a short architecture explanation (see Section 22) |

Nothing from the assignment is left unaddressed.

---

## 3. Project Goals

### Primary Goals
- Produce a strong, deployable **Web Development / Full-Stack** portfolio piece
- Demonstrate REST API design, database modeling, and React architecture
- Demonstrate practical (not overbuilt) AI integration inside a normal web app

### Secondary Goals
- Show comfort with file upload handling and OCR/document processing
- Show ability to scope and finish a project on time (10–15 hours)
- Produce clean documentation a recruiter can skim in under 2 minutes

### Non-Goals
- Building a general-purpose RAG platform
- Multi-user accounts, teams, or permissions
- Supporting every possible file format
- Building a highly polished animated UI (competent > flashy)
- Perfect OCR accuracy on all document types

---

## 4. MVP Scope

### MUST HAVE

| Feature | Description | User Value | Technical Implementation | Priority |
|---|---|---|---|---|
| Document upload | Upload one PDF or image (jpg/png) | Entry point to the app | Multer middleware, file type/size validation | Must |
| Text extraction | Extract raw text from PDF or image | Makes document content usable by the LLM | `pdf-parse` for PDFs, Tesseract.js/OCR for images | Must |
| Document preview | Show extracted text (and filename/page count) | User can verify extraction worked | Simple scrollable text panel in React | Must |
| Chat Q&A | Ask questions about the uploaded document | Core value proposition | Backend injects extracted text as context into LLM prompt | Must |
| Conversation display | Chat-style message thread | Familiar, intuitive UX | React state + MongoDB persistence per document | Must |
| Error/loading states | Upload errors, OCR failures, LLM errors, loading spinners | App feels production-grade, not a fragile demo | Centralized error handling middleware + React UI states | Must |

### SHOULD HAVE

| Feature | Description | User Value | Technical Implementation | Priority |
|---|---|---|---|---|
| Document summary | One-click "Summarize this document" | Quick overview before Q&A | Separate LLM call with a summarization prompt | Should |
| Multiple documents list | See past uploaded documents | Return to earlier sessions | MongoDB `Document` collection + simple list view | Should |
| Copy/answer formatting | Render LLM answers with basic markdown (lists, bold) | Cleaner reading experience | `react-markdown` on the frontend | Should |

### OPTIONAL / ONLY IF TIME REMAINS

| Feature | Description | Priority |
|---|---|---|
| Delete document | Remove a document and its chat history | Optional |
| Dark mode | Tailwind dark variant toggle | Optional |
| Download conversation as text | Export Q&A thread | Optional |

---

## 5. User Flow

```
Landing / Dashboard
   │
   ▼
Upload Document (drag & drop or file picker: PDF/JPG/PNG)
   │
   ▼
Processing (loading state: "Extracting text...")
   │
   ▼
OCR / Text Extraction (backend: pdf-parse or Tesseract)
   │
   ├── Success → Document Preview (extracted text shown)
   │                 │
   │                 ▼
   │        Ask a Question (chat input)
   │                 │
   │                 ▼
   │        Backend builds prompt (document context + question)
   │                 │
   │                 ▼
   │        LLM generates grounded answer
   │                 │
   │                 ▼
   │        Answer displayed in chat thread
   │                 │
   │                 ▼
   │        Continue conversation (loop) / Summarize (optional)
   │
   └── Failure → Error state ("Couldn't read this file — try another format")
                  → Option to re-upload
```

### Error & Loading States
- **Uploading:** spinner + "Uploading document..."
- **Extracting:** spinner + "Reading your document..."
- **Extraction failed:** clear error message + retry/re-upload button (e.g., corrupted file, unsupported format, scanned doc unreadable)
- **Asking a question:** typing/"thinking" indicator in the chat thread
- **LLM error:** inline error bubble in chat ("Something went wrong generating a response — try again") without losing the conversation
- **Empty state:** dashboard with no documents yet shows a friendly prompt to upload the first one

---

## 6. UI/UX Plan

### Pages/Screens
1. **Dashboard** — list of previously uploaded documents + "Upload New Document" button (empty state if none)
2. **Document Workspace** — split view: document preview panel (left) + chat panel (right); stacks vertically on mobile

### Components
- `UploadDropzone` — drag/drop + click-to-browse, shows file validation errors
- `DocumentCard` — dashboard list item (filename, upload date, status)
- `DocumentPreviewPanel` — scrollable extracted text, filename header
- `ChatWindow` — message list (user vs assistant bubbles)
- `ChatInput` — text input + send button, disabled while awaiting response
- `SummaryButton` — triggers summarization, shows result in a panel/modal
- `LoadingSpinner`, `ErrorBanner`, `EmptyState` — shared feedback components

### Navigation
Minimal — two logical views (Dashboard, Workspace) reached via document selection/upload. No auth, so no login/logout nav needed. A simple top bar with the app name/logo is enough.

### Layout
Clean two-column workspace layout on desktop (document left, chat right); single-column stacked layout on mobile, with a tab or toggle to switch between "Document" and "Chat" views.

### Responsive Behavior
Tailwind breakpoints (`sm`, `md`, `lg`) drive the switch from two-column to stacked/tabbed layout. Chat input stays pinned to the bottom of the viewport on mobile.

### States to Design For
- **Loading:** spinners on upload, extraction, and LLM response
- **Empty:** no documents yet; no messages yet
- **Error:** upload rejected, extraction failed, LLM call failed
- **Success:** extraction complete, answer received

No heavy animation library is used — simple CSS transitions (fade/slide) via Tailwind are sufficient. The UI should look like a competent junior/mid-level developer's clean, real product, not a design showcase.

---

## 7. Frontend Architecture

### Folder Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── upload/
│   │   │   └── UploadDropzone.jsx
│   │   ├── document/
│   │   │   ├── DocumentCard.jsx
│   │   │   └── DocumentPreviewPanel.jsx
│   │   ├── chat/
│   │   │   ├── ChatWindow.jsx
│   │   │   ├── ChatMessage.jsx
│   │   │   └── ChatInput.jsx
│   │   └── shared/
│   │       ├── LoadingSpinner.jsx
│   │       ├── ErrorBanner.jsx
│   │       └── EmptyState.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   └── DocumentWorkspace.jsx
│   ├── hooks/
│   │   ├── useDocuments.js
│   │   └── useChat.js
│   ├── services/
│   │   └── api.js          # Axios instance + all API calls
│   ├── utils/
│   │   ├── formatDate.js
│   │   └── fileValidation.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── vite.config.js
└── package.json
```

### State Management Approach
No Redux/Zustand — unnecessary at this scale. Local component state + two custom hooks (`useDocuments`, `useChat`) that wrap Axios calls and expose `{ data, loading, error }`. This is the honest, appropriately-scoped choice for a small app and is easy to explain in an interview.

### Services/API Layer
All HTTP calls centralized in `services/api.js` (Axios instance with base URL from env). Components never call `fetch`/`axios` directly — they go through hooks → services. This is called out explicitly because it's a strong, easy-to-explain architectural decision.

### Environment Variables
`VITE_API_BASE_URL` — backend API URL, different for local dev vs production.

### Error/Loading Handling
Each hook returns loading/error state; components render `LoadingSpinner`/`ErrorBanner` conditionally. No silent failures — every failed request surfaces a visible message.

---

## 8. Backend Architecture

### Folder Structure
```
backend/
├── src/
│   ├── routes/
│   │   ├── document.routes.js
│   │   └── chat.routes.js
│   ├── controllers/
│   │   ├── document.controller.js
│   │   └── chat.controller.js
│   ├── services/
│   │   ├── ocr.service.js       # PDF + image text extraction
│   │   ├── ai.service.js        # LLM API calls (Q&A + summary)
│   │   └── document.service.js  # business logic around documents
│   ├── models/
│   │   ├── Document.js
│   │   └── Message.js
│   ├── middleware/
│   │   ├── upload.middleware.js   # Multer config
│   │   ├── errorHandler.js
│   │   └── validateRequest.js
│   ├── config/
│   │   └── db.js
│   ├── utils/
│   │   └── asyncHandler.js
│   └── app.js
├── uploads/               # temp storage (gitignored)
├── .env.example
├── server.js
└── package.json
```

### Why This Architecture
Layered separation (routes → controllers → services → models) keeps each file focused and is a pattern any Node.js interviewer immediately recognizes. Services isolate OCR and AI logic so either can be swapped (e.g., different LLM provider, different OCR engine) without touching controllers.

### Error Handling
Centralized `errorHandler.js` middleware; controllers wrap async logic in an `asyncHandler` utility to avoid repetitive try/catch blocks and unhandled promise rejections.

### Validation
Basic request validation middleware (file presence, message body not empty, valid MongoDB ObjectIds).

### File Upload Handling
Multer stores uploads temporarily on disk (or memory buffer for small files), enforcing MIME type whitelist (`pdf`, `jpg`, `jpeg`, `png`) and a size limit (e.g., 10MB). File is deleted after successful text extraction to avoid storage bloat — only extracted text is persisted.

---

## 9. Database Design

Two collections only — intentionally minimal.

### `Document`
| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | auto | |
| `filename` | String | yes | original upload name |
| `fileType` | String | yes | `pdf` \| `image` |
| `extractedText` | String | yes | full OCR/extracted text |
| `status` | String | yes | `processing` \| `ready` \| `failed` |
| `summary` | String | no | populated only if summarize used |
| `createdAt` | Date | auto | |

### `Message`
| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | auto | |
| `documentId` | ObjectId (ref: Document) | yes | links chat to a document |
| `role` | String | yes | `user` \| `assistant` |
| `content` | String | yes | message text |
| `createdAt` | Date | auto | used for ordering |

**Relationship:** one `Document` → many `Message`s (referenced, not embedded, since a document's chat history can grow unbounded — embedding would risk hitting MongoDB's 16MB document limit on long conversations).

**Indexes:** index `Message.documentId` (and compound with `createdAt`) since every chat load queries by document and needs chronological order.

No `User` collection — there is no authentication in MVP scope (see Section 3, Non-Goals).

---

## 10. API Design

Base path: `/api`

### Document Endpoints

**`POST /api/documents/upload`**
- Purpose: upload a file, extract text, create a Document record
- Request: `multipart/form-data`, field `file`
- Response `201`: `{ id, filename, fileType, status, extractedText }`
- Errors: `400` unsupported file type / no file, `413` file too large, `422` extraction failed, `500` server error

**`GET /api/documents`**
- Purpose: list all uploaded documents (for dashboard)
- Response `200`: `[{ id, filename, fileType, status, createdAt }]`

**`GET /api/documents/:id`**
- Purpose: get a single document's details + extracted text
- Response `200`: `{ id, filename, fileType, status, extractedText, summary }`
- Errors: `404` not found

**`POST /api/documents/:id/summarize`** *(should-have)*
- Purpose: generate and store a summary for a document
- Response `200`: `{ summary }`
- Errors: `404` not found, `502` LLM call failed

**`DELETE /api/documents/:id`** *(optional)*
- Purpose: delete a document and its messages
- Response `204`
- Errors: `404` not found

### Chat Endpoints

**`POST /api/documents/:id/messages`**
- Purpose: send a user question, get an LLM-generated answer
- Request: `{ content: string }`
- Response `201`: `{ userMessage, assistantMessage }`
- Errors: `400` empty message, `404` document not found, `502` LLM call failed, `504` LLM timeout

**`GET /api/documents/:id/messages`**
- Purpose: fetch full conversation history for a document
- Response `200`: `[{ id, role, content, createdAt }]`
- Errors: `404` not found

---

## 11. AI Architecture

### Prompt Structure
System-style instruction + injected document context + conversation history + new question, sent as a single well-structured prompt (or system/user message pair, depending on provider):

```
You are a helpful assistant answering questions strictly based on the
document provided below. If the answer is not contained in the document,
say so clearly instead of guessing.

DOCUMENT:
"""
{extractedText}
"""

CONVERSATION SO FAR:
{last N messages, if any}

QUESTION:
{userQuestion}
```

### How Document Context Is Supplied
The full `extractedText` for the document is injected directly into the prompt (no vector database, no chunking/embedding pipeline — that would be over-engineering for a 10–15 hour, single-document assignment). If a document is unusually long, the backend truncates to a safe character/token budget (see below) rather than failing.

### How Questions Are Processed
1. Fetch the document's `extractedText` from MongoDB
2. Fetch the last few messages for lightweight conversational continuity
3. Build the prompt above
4. Call the LLM service
5. Store both the user message and the assistant's reply in `Message`

### Reducing Hallucination
- Explicit system instruction to answer **only** from the provided document
- Explicit instruction to say "not found in the document" rather than guessing
- No fabricated citations or page numbers are requested from the model

### Behavior When the Answer Isn't in the Document
The model is instructed to respond with a clear statement that the information isn't present, rather than inventing an answer. This is called out in the demo video as a deliberate design choice (grounded answers > confident hallucination).

### Token / Context Limitations
- Extracted text is truncated to a safe limit (e.g., ~6,000–8,000 tokens' worth of characters) before being inserted into the prompt, with a note appended if truncation occurred
- This keeps the project within "practical" scope, explicitly avoiding chunking/embedding/vector-search infrastructure (see Non-Goals)

### Error Handling
- LLM API timeout or failure → `502`/`504` returned to frontend, chat shows an inline error bubble, conversation state is not lost
- Rate limit errors surfaced with a friendly "please try again in a moment" message

### Environment Variable Configuration
```
LLM_API_KEY=
LLM_API_BASE_URL=
LLM_MODEL_NAME=
```
`ai.service.js` reads these and exposes provider-agnostic functions (`generateAnswer()`, `generateSummary()`), so swapping providers later means changing env vars and one adapter file — not the rest of the app.

---

## 12. OCR / Document Processing

### Supported File Types
PDF (`.pdf`), JPG/JPEG, PNG. This covers the vast majority of real-world "document" uploads within a realistic time budget.

### PDF Processing
Use `pdf-parse` (Node) to extract the native text layer directly — fast, no OCR needed for text-based PDFs, which covers most real-world cases (reports, exported documents, etc.).

### Image OCR
Use Tesseract-based OCR (`tesseract.js` on the backend, or a lightweight OCR API if `tesseract.js` proves too slow/heavy) to extract text from JPG/PNG uploads.

### Text Extraction Flow
1. File uploaded via Multer → temp storage
2. `ocr.service.js` detects type (`pdf` vs `image`) from MIME type
3. Runs the appropriate extractor
4. Extracted text saved to `Document.extractedText`, status set to `ready`
5. Temp file deleted

### Where Processing Occurs
Entirely on the backend (Node/Express), synchronously within the upload request for MVP scope (acceptable given small file sizes and 10–15 hour budget). No background job queue — explicitly avoided as unnecessary complexity for this scope.

### Failure Handling
- Corrupted/unreadable file → `Document.status = 'failed'`, `422` returned with a clear message
- Scanned PDF with no text layer → falls back to treating it as an image and running OCR on rendered pages (stretch goal; if time-constrained, document this as a known limitation instead)

### File-Size Limitations
Max upload size: **10 MB**, enforced both in Multer config (`limits`) and in the frontend dropzone validation (fail fast with a clear message before even hitting the network).

---

## 13. Security and Privacy

- All secrets (`LLM_API_KEY`, `MONGODB_URI`) live in `.env`, never committed — `.env.example` provided instead
- API keys never sent to or referenced by the frontend; all LLM calls happen server-side only
- File type validated by MIME type **and** extension (not trusted from filename alone)
- File size capped at 10MB, enforced server-side (not just client-side)
- Basic input validation on chat messages (non-empty, reasonable max length) to avoid abuse
- Basic prompt-injection awareness: the system instruction explicitly frames the document text as *data to reference*, not as instructions to follow, and the app doesn't execute or eval anything the LLM returns
- No sensitive data (API keys, full prompts) written to server logs — only high-level events (e.g., "document uploaded", "LLM call failed") are logged
- CORS restricted to the deployed frontend origin in production
- No authentication in MVP — explicitly documented as a known limitation/non-goal, not a security oversight

This is intentionally practical, not enterprise-grade — appropriate for the project's scope.

---

## 14. Complete Folder Structure

```
documind/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── middleware/
│   │   ├── config/
│   │   ├── utils/
│   │   └── app.js
│   ├── uploads/            # gitignored
│   ├── .env.example
│   ├── server.js
│   └── package.json
├── docs/
│   └── screenshots/
├── README.md
├── BUILD_LOG.md
├── .gitignore
└── MASTER_PLAN.md
```

---

## 15. Development Roadmap

| Phase | Objective | Tasks | Expected Output | Dependencies | Est. Time |
|---|---|---|---|---|---|
| 1. Project Setup | Scaffold repo | Init Git repo, create `frontend`/`backend` folders, Vite React app, Express app, `.gitignore`, `.env.example` | Runnable empty apps on both sides | None | 0.5h |
| 2. Backend Foundation | Base Express server | `app.js`/`server.js`, base middleware, error handler, health-check route | `GET /api/health` returns 200 | Phase 1 | 0.5h |
| 3. Database | Connect MongoDB | Set up Atlas cluster, `config/db.js`, define `Document` and `Message` models | Models importable, connection confirmed | Phase 2 | 1h |
| 4. Document Upload | Upload endpoint | Multer config, `POST /api/documents/upload`, save Document record | File uploads successfully, record created | Phase 3 | 1.5h |
| 5. OCR/Extraction | Text extraction | `ocr.service.js` (pdf-parse + Tesseract), wire into upload flow | `extractedText` populated correctly | Phase 4 | 2.5h |
| 6. LLM Integration | AI Q&A + summary | `ai.service.js`, prompt builder, `POST /api/documents/:id/messages`, summarize endpoint | Backend returns grounded answers | Phase 5 | 2h |
| 7. React UI Shell | Core screens | Dashboard, Workspace page, shared components, Tailwind setup | Static UI navigable, no live data yet | Phase 1 | 1.5h |
| 8. Frontend/Backend Integration | Wire it together | `services/api.js`, `useDocuments`, `useChat`, connect upload/chat flows | Fully working end-to-end app locally | Phases 6, 7 | 2h |
| 9. Testing & Polish | Validate + fix | Manual test matrix (Section 17), fix bugs, loading/error states polish | Stable app, no obvious breakage | Phase 8 | 1.5h |
| 10. Deployment | Ship it | Deploy backend (Render), frontend (Vercel), MongoDB Atlas, set env vars, verify CORS | Public live URL working | Phase 9 | 1h |
| 11. Documentation | README + Build Log | Write `README.md`, `BUILD_LOG.md`, take screenshots | Recruiter-ready docs | Phase 10 | 1h |
| 12. Demo Video | Record demo | Script, record, edit lightly, upload | 3–5 min demo video | Phase 11 | 0.5h |

**Total estimated time: ~15.5 hours** (top of the assignment's 10–15h range — realistic and defensible; Section 26 covers what to cut first if time runs short).

---

## 16. Detailed Task Checklist

**Setup**
- [ ] Initialize Git repository
- [ ] Create `frontend/` (Vite + React + Tailwind)
- [ ] Create `backend/` (Express)
- [ ] Add root `.gitignore`
- [ ] Add `.env.example` in both frontend and backend

**Backend**
- [ ] Configure Express app + base middleware
- [ ] Connect MongoDB Atlas
- [ ] Create `Document` model
- [ ] Create `Message` model
- [ ] Implement Multer upload middleware
- [ ] Implement `POST /api/documents/upload`
- [ ] Implement `ocr.service.js` (PDF + image)
- [ ] Implement `ai.service.js` (Q&A + summary)
- [ ] Implement `POST /api/documents/:id/messages`
- [ ] Implement `GET /api/documents`, `GET /api/documents/:id`, `GET /api/documents/:id/messages`
- [ ] Implement `POST /api/documents/:id/summarize`
- [ ] Centralized error handler middleware
- [ ] Input validation middleware

**Frontend**
- [ ] Build `Dashboard` page
- [ ] Build `DocumentWorkspace` page
- [ ] Build `UploadDropzone` component
- [ ] Build `DocumentPreviewPanel` component
- [ ] Build `ChatWindow` + `ChatMessage` + `ChatInput`
- [ ] Build shared `LoadingSpinner`, `ErrorBanner`, `EmptyState`
- [ ] Implement `services/api.js`
- [ ] Implement `useDocuments` and `useChat` hooks
- [ ] Wire upload flow end-to-end
- [ ] Wire chat flow end-to-end
- [ ] Responsive layout pass (mobile/desktop)

**Testing**
- [ ] Test PDF upload + extraction
- [ ] Test image upload + OCR
- [ ] Test invalid file type rejection
- [ ] Test oversized file rejection
- [ ] Test chat Q&A with in-document question
- [ ] Test chat Q&A with out-of-document question (should say "not found")
- [ ] Test LLM error handling (simulate failure)
- [ ] Test empty states (no documents, no messages)

**Deployment**
- [ ] Deploy backend to Render/Railway
- [ ] Deploy frontend to Vercel
- [ ] Set all production env vars
- [ ] Verify CORS between deployed frontend/backend
- [ ] Smoke-test the live URL end-to-end

**Documentation**
- [ ] Write `README.md`
- [ ] Write `BUILD_LOG.md`
- [ ] Take/add screenshots to `docs/screenshots/`
- [ ] Record and upload demo video
- [ ] Final repo cleanup pass

---

## 17. Testing Strategy

Given the limited time budget, testing is **manual and targeted**, not automated test-suite-heavy — this is the right, defensible call for a 10–15 hour project and should be stated as such in the Build Log.

- **Upload testing:** valid PDF, valid image, invalid file type (e.g., `.docx`), oversized file, corrupted file
- **OCR testing:** text-based PDF, scanned/image-only PDF (if supported), clear image, blurry/low-quality image
- **LLM testing:** question answerable from document, question NOT answerable from document (verify honest "not found" response), empty message rejected, simulated API failure (wrong key) to confirm graceful error handling
- **API testing:** manually verified via Postman/Thunder Client for every endpoint in Section 10, including error status codes
- **Frontend testing:** manual click-through of every state in Section 6 (loading, empty, error, success) on both desktop and mobile widths
- **End-to-end testing:** full user journey (Section 5) run start to finish at least 3 times with different documents before recording the demo

If time allows, 2–3 lightweight backend unit tests (e.g., prompt-builder function, file-type validator) can be added as a visible signal of testing discipline — marked as "should have," not required.

---

## 18. Deployment Plan

| Layer | Platform | Notes |
|---|---|---|
| Frontend (React/Vite) | **Vercel** | Auto-deploys from GitHub, set `VITE_API_BASE_URL` to the deployed backend URL |
| Backend (Express) | **Render** (free web service) | Set all backend env vars in Render dashboard; enable CORS for the Vercel domain |
| Database | **MongoDB Atlas** (free tier) | Whitelist Render's outbound IP (or allow all for simplicity, documented as a known trade-off) |

**Environment Variables (Production)**
- Backend: `MONGODB_URI`, `LLM_API_KEY`, `LLM_API_BASE_URL`, `LLM_MODEL_NAME`, `PORT`, `CORS_ORIGIN`
- Frontend: `VITE_API_BASE_URL`

The final deliverable is one public frontend URL (Vercel) that fully talks to the live backend — this is the single link shared with Digitalsofts.

---

## 19. Git/GitHub Strategy

- **Repo name:** `documind` (lowercase, hyphen-free, clean)
- **Branch strategy:** `main` as the stable branch; optionally a `dev` branch during active building, merged via PR at milestones — kept simple, no full GitFlow
- **Commit strategy:** small, frequent, meaningful commits per feature/phase (e.g., `feat: add document upload endpoint`, `fix: handle OCR failure on corrupted PDF`) — never one giant "final commit"
- **`.gitignore`:** `node_modules/`, `.env`, `uploads/`, build artifacts
- **Environment variable protection:** only `.env.example` committed, real `.env` files never pushed
- **README:** present at root with everything in Section 20
- **Screenshots:** stored in `docs/screenshots/`, referenced in README
- **Final cleanup pass:** remove dead code, unused dependencies, console.logs, and confirm the repo looks intentional top to bottom before sharing the link

A clean, readable commit history is itself a signal to a hiring manager — this is called out explicitly in Section 23.

---

## 20. README.md Plan

```
# DocuMind — AI-Powered Document Assistant

## Description
2–3 sentence pitch (problem + what it does)

## Live Demo
🔗 [Live App](URL) | 🔗 [Demo Video](URL)

## Features
- Bullet list of MUST/SHOULD HAVE features actually shipped

## Screenshots
Dashboard, upload flow, chat interface

## Tech Stack
Frontend: React, Vite, Tailwind, Axios
Backend: Node.js, Express, MongoDB, Mongoose
AI: [LLM provider], configurable via env
OCR: pdf-parse, Tesseract

## Architecture
Short diagram/description of frontend ↔ backend ↔ DB ↔ LLM/OCR

## Getting Started (Local Setup)
Clone, install (frontend + backend), env var setup, run instructions

## Environment Variables
Table of required env vars for frontend and backend

## API Overview
Short table of main endpoints (link to full API docs if any)

## AI Usage Disclosure
Short, honest note that AI coding tools were used during development,
with a pointer to BUILD_LOG.md for full details

## Future Improvements
Bullet list from Section 27

## Author
Abdul Rehman — BS Software Engineering, FAST-NUCES
```

---

## 21. BUILD_LOG.md Plan

The Build Log must be **honest**, not a marketing document. Structure:

1. **What I Built** — one-paragraph summary of DocuMind and its core loop
2. **Why This Architecture** — why MERN over Streamlit, why layered backend, why no vector DB/auth (scope discipline)
3. **Development Process** — roughly chronological: setup → backend → OCR → AI → frontend → integration → deployment
4. **Technical Decisions** — key call-outs: single-context-injection instead of RAG, no auth, truncation strategy for long documents, provider-agnostic AI service
5. **Problems Encountered & How I Solved Them** — real issues (e.g., OCR accuracy on scanned files, CORS between Vercel/Render, LLM prompt tuning to reduce hallucination)
6. **AI Tools Used** — name the tools honestly (e.g., Claude for architecture/planning, an AI coding agent for implementation assistance)
7. **How AI Assisted Me** — be specific: architecture planning, boilerplate generation, debugging help
8. **What I Personally Reviewed/Tested/Modified** — explicitly state what was manually verified, tested, and adjusted — this is the credibility section
9. **Lessons Learned** — 2–3 genuine takeaways
10. **Future Improvements** — pointer to Section 27

This section explicitly does **not** ask for a claim that everything was written manually — Digitalsofts asked for an honest account of AI usage, and honesty here is a positive signal, not a negative one.

---

## 22. Demo Video Plan (3–5 minutes)

**0:00–0:20 — Intro**
"Hi, I'm Abdul Rehman. This is DocuMind, an AI-powered document assistant I built for the Digitalsofts assignment using the MERN stack with LLM and OCR integration."

**0:20–0:50 — Problem & Concept**
Briefly state the problem (reading long documents is slow) and the solution (upload → ask → get grounded answers).

**0:50–1:30 — Live Upload Demo**
Show the live URL, upload a real PDF, show the loading state, then the extracted text preview.

**1:30–2:30 — Chat Demo**
Ask 2–3 real questions: one clearly answerable from the document, one deliberately NOT in the document (to show the "not found in document" grounding behavior).

**2:30–3:00 — Summary Feature (if shipped)**
Click "Summarize" and show the result.

**3:00–3:45 — Quick Architecture Explanation**
Screen-share the folder structure briefly: "Frontend is React/Vite/Tailwind, backend is Express with a layered architecture — routes, controllers, services, models. OCR is handled by pdf-parse and Tesseract, and the LLM is called server-side only, so API keys are never exposed to the client."

**3:45–4:15 — AI Integration Note**
"The LLM is instructed to only answer from the document content, which you just saw when it correctly said an answer wasn't present — that grounding was a deliberate design choice to avoid hallucination."

**4:15–4:30 — Closing**
"Thanks for watching — the code is on GitHub, the README covers setup and architecture in more detail, and the Build Log documents my process and AI tool usage honestly. I'm excited about the possibility of contributing to Digitalsofts as a Web Development intern."

---

## 23. Portfolio / Recruiter Perspective

**What will impress them**
- A real deployed full-stack app instead of the "safe" Streamlit option — shows initiative and stack range
- Clean layered backend architecture (routes/controllers/services/models)
- Sensible, scoped AI integration rather than an over-engineered RAG system
- Honest Build Log — signals maturity and self-awareness, which is rare and valued

**What may look weak (and how it's mitigated)**
- No authentication → explicitly framed as an intentional scope decision, not an oversight (Section 3, Section 27)
- Simple context-injection instead of vector search → framed as a deliberate, practical trade-off for the assignment's scope (Section 11)
- Manual testing only → framed as time-appropriate prioritization (Section 17)

**What should be visible in the GitHub repo**
Clean commit history, clear README, no committed secrets, sensible folder structure, no dead/commented-out code.

**What should be visible in the live demo**
Fast load, no console errors, graceful handling of a bad file upload, a working end-to-end Q&A exchange.

**How this demonstrates each skill area**
- **Frontend:** component architecture, hooks, responsive Tailwind layout, API integration layer
- **Backend:** REST API design, MongoDB schema design, file upload handling, middleware/error-handling patterns
- **API integration:** clean Axios service layer, proper HTTP status codes, error propagation frontend↔backend
- **AI integration:** practical prompt engineering, hallucination mitigation, provider-agnostic service design

**Mistakes that could hurt evaluation**
Committed `.env`/API keys, broken live URL, no error handling shown in the demo, README that doesn't explain setup, an unscoped/unfinished feature left visibly broken.

---

## 24. Web Development Internship Positioning

The project must read as **"a full-stack web developer who can integrate AI,"** not **"an AI project with a UI bolted on."** Implementation choices that reinforce this:

- MERN stack chosen deliberately over the suggested FastAPI/Streamlit, and this choice is explained in the README/Build Log
- The AI service is one clearly-isolated service module among several (upload, OCR, database, chat) — not the entire app
- Emphasis in the README/demo on REST API design, database schema, and component architecture — AI integration is presented as one well-executed feature, not the headline
- Clean, realistic UI built with standard, in-demand tools (React, Tailwind) rather than a low-code AI app builder
- The Build Log explicitly separates "web development work" from "AI-tool-assisted work," making the developer's own contribution and understanding legible

---

## 25. Definition of Done

- [ ] **Functional:** upload → extract → preview → chat → answer loop works end-to-end without crashing
- [ ] **UI:** all states in Section 6 (loading, empty, error, success) implemented and visibly correct
- [ ] **Backend:** all MUST-HAVE endpoints from Section 10 implemented, validated, and error-handled
- [ ] **AI:** grounded Q&A works; model correctly declines to answer when info isn't in the document
- [ ] **OCR:** both PDF and image uploads successfully extract text in normal cases
- [ ] **Testing:** full manual test matrix (Section 17) completed at least once with no critical bugs
- [ ] **Deployment:** live URL loads and functions correctly for a first-time visitor with no local setup
- [ ] **GitHub:** clean structure, no secrets committed, meaningful commit history
- [ ] **README:** complete per Section 20, including live link and screenshots
- [ ] **Build Log:** complete and honest per Section 21
- [ ] **Demo video:** 3–5 minutes, covers upload, chat, and a brief architecture explanation

---

## 26. Risks and Contingency Plans

| Risk | Fallback |
|---|---|
| OCR library too slow/inaccurate (`tesseract.js`) | Fall back to a lightweight hosted OCR API, or scope image OCR down to "best effort" and document the limitation clearly |
| Scanned PDFs with no text layer | Document as a known limitation in README rather than building a PDF-to-image-to-OCR pipeline under time pressure |
| LLM API rate limits/costs during testing | Use a cheap/fast model for development, cache repeated test prompts locally, switch models via env var only |
| Deployment CORS issues (Vercel ↔ Render) | Explicitly configure `CORS_ORIGIN` env var on the backend; test cross-origin calls early, not at the end |
| MongoDB Atlas connection issues | Verify IP whitelist and connection string early in Phase 3, before building dependent features |
| File processing errors (corrupted uploads) | Wrap extraction in try/catch, set `Document.status = 'failed'`, surface a clear frontend error — never let the request hang |
| Running out of time before deployment | Cut OPTIONAL features first (Section 4), then SHOULD-HAVE features, but never cut deployment, README, Build Log, or demo video — those are non-negotiable deliverables |

The project scope is deliberately conservative so that, even if 1–2 stretch features are cut, every assignment deliverable still ships on time.

---

## 27. Future Improvements

(Explicitly NOT built now — mentioned in README as forward-looking, to show awareness without scope creep.)

- User authentication and per-user document libraries
- Vector database + proper RAG for large/multi-document search
- Support for more file formats (.docx, .txt, .csv)
- Streaming LLM responses (token-by-token)
- Multi-document conversations (ask across several documents at once)
- Usage analytics dashboard
- Background job queue for large-file OCR processing

---

## 28. Final Recommended Stack

- **Frontend:** React + Vite + Tailwind CSS + Axios
- **Backend:** Node.js + Express.js
- **Database:** MongoDB Atlas + Mongoose
- **File Upload:** Multer
- **PDF Extraction:** `pdf-parse`
- **Image OCR:** `tesseract.js`
- **LLM:** Any provider configured via `LLM_API_KEY` / `LLM_API_BASE_URL` / `LLM_MODEL_NAME` env vars, called only from the backend
- **Frontend Deployment:** Vercel
- **Backend Deployment:** Render
- **No** authentication, vector database, microservices, or job queues in v1.

This is the single, final stack — no alternatives left open.

---

# AI CODING ASSISTANT INSTRUCTIONS

A future AI coding assistant (e.g., an agentic coding tool) implementing this project from this file must follow these rules:

1. **This file is the single source of truth.** Do not deviate from the architecture, stack, folder structure, database schema, or API design defined above without explicit confirmation from the project owner.
2. **Implement one phase at a time**, in the order defined in Section 15. Do not jump ahead to later phases before earlier ones are complete and working.
3. **Do not skip any MUST HAVE task** from Section 16's checklist. SHOULD HAVE and OPTIONAL items may be deferred or skipped only if time is genuinely constrained, and this should be flagged to the project owner, not decided silently.
4. **Do not introduce new technologies, libraries, or architectural patterns** not already specified in this plan (e.g., no adding a vector database, no adding Redux, no adding authentication, no switching frameworks) without first asking the project owner.
5. **Ask before changing any major architectural decision** — including database schema changes, API contract changes, or folder structure changes.
6. **Keep all code beginner-readable.** Favor clear, well-named functions and straightforward logic over clever abstractions. This code should be explainable line-by-line by the project owner in an interview.
7. **Explain important implementation decisions** as comments or accompanying notes when a non-obvious choice is made (e.g., why text is truncated at a certain length, why a particular error is handled a specific way).
8. **Test each phase before moving to the next one.** Do not stack unverified code on top of unverified code.
9. **Never hardcode or expose secrets/API keys** in source code, commits, or client-side code. All secrets must come from environment variables and be excluded via `.gitignore`.
10. **Stay within the original scope.** Do not silently add features beyond Section 4's MVP scope, even if they seem like natural extensions — propose them as "Future Improvements" (Section 27) instead.
11. If any requirement in this document is ambiguous or seems to conflict with another section, **pause and ask the project owner for clarification** rather than making an assumption.
