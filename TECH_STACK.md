# PageChat — Tech Stack & Setup Guide

PageChat is a Chrome (Manifest V3) extension + Python backend that lets you chat with any web page using RAG (Retrieval-Augmented Generation). It extracts page content (including Markdown pipe tables), indexes it into a local vector store, and streams answers grounded in the page.

---

## 1. Architecture Overview

```
┌─────────────────────┐         ┌──────────────────────────┐
│  Chrome Extension   │  HTTP   │   FastAPI Backend        │
│  (MV3, React)       │ ──────► │   (Python 3.13)          │
│                     │         │                          │
│  • extractor.js     │  /ingest│  • LangGraph agent       │
│    (DOM → Markdown) │  /chat  │  • ChromaDB vector store │
│  • Side panel UI    │  /page  │  • FastEmbed embeddings  │
│  • SSE streaming    │ /history│  • Groq LLM (streaming)  │
└─────────────────────┘         └──────────────────────────┘
```

**Request flow:**
1. Extension injects `extractor.js` into the active tab and extracts page content as Markdown (with pipe-table support).
2. Content is sent to `POST /ingest` → chunked (section-aware, table row-splitting) → embedded → stored in ChromaDB + SQLite.
3. User question goes to `POST /chat` → LangGraph pipeline (condense → retrieve/load_full → generate) → Groq LLM → tokens streamed back as SSE events.
4. Conversation state is persisted via a LangGraph checkpointer so `/history` works.

---

## 2. Tech Stack

### Backend (`D:\we\backend`)

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.13.0 | Runtime (isolated venv at `D:\we\web_extension`) |
| FastAPI | 0.142.2 | Web framework / REST API |
| Uvicorn | 0.54.0 | ASGI server (with hot-reload) |
| Starlette | 1.7.0 | ASGI toolkit (CORS, responses) |
| Pydantic + pydantic-settings | 2.13.5 / 2.15.0 | Request/response validation, env config |
| LangChain (core/community/text-splitters) | 1.4.3 / 0.4.2 / 1.1.2 | Document model, FastEmbed wrapper, chunking |
| LangGraph | 1.2.12 | Agent orchestration (state graph: condense → retrieve → generate) |
| langgraph-checkpoint | 4.2.0 | Conversation state persistence (MemorySaver) |
| LangChain-Groq | 1.1.3 | Groq LLM client (`openai/gpt-oss-120b`, streaming) |
| ChromaDB + langchain-chroma | 1.5.9 / 1.1.0 | Persistent vector store (cosine similarity, HNSW) |
| FastEmbed | 0.8.1 | Local embeddings (`BAAI/bge-small-en-v1.5`, ONNX, no API needed) |
| slowapi | 0.1.10 | Rate limiting |
| aiosqlite | 0.22.1 | Async SQLite (page metadata store) |
| pytest + pytest-asyncio | 9.1.1 / 1.4.0 | Testing |
| ruff | 0.16.9 | Linting |
| httpx | 0.28.1 | Test client / HTTP |

### Frontend / Extension (`D:\we\extension`)

| Technology | Version | Purpose |
|---|---|---|
| TypeScript | 5.6.3 | Type-safe JS |
| React + react-dom | 19.0.0 | Side panel UI |
| Vite + @vitejs/plugin-react | 5.4.11 / 4.3.4 | Build tool & dev server |
| Vitest + jsdom | 2.1.9 / 25.0.0 | Unit testing |
| @mozilla/readability | 0.5.0 | DOM → clean article parsing |
| turndown + turndown-plugin-gfm | 7.2.0 / 1.0.2 | HTML → Markdown (incl. GFM tables) |
| react-markdown + remark-gfm | 10.1.0 / 4.0.1 | Rendering Markdown answers (tables, links) |
| WXT | 0.20.27 | Extension framework types/scaffold (`wxt/utils/define-background`) |
| @types/chrome | 0.0.270 | Chrome API typings |

### Storage layout (created automatically)

| Path | Contents |
|---|---|
| `DATA_DIR/app.db` (default `./data/app.db`) | SQLite: pages table (page_id, url, title, markdown, content_hash, mode, timestamps) |
| `DATA_DIR/chroma/` | ChromaDB persistent collection `pages` (embedded chunks) |

---

## 3. Dependencies You Need

### Prerequisites

1. **Python 3.13** — for the backend. The project already has an isolated virtual environment at `D:\we\web_extension` with all Python dependencies pre-installed. You do **not** need to install anything manually unless you rebuild it.
2. **Node.js (v18+)** — for building/developing the Chrome extension.
3. **Google Chrome** — to load and run the extension.
4. **Groq API key** — free from https://console.groq.com/keys. Required for LLM answers.

### Key Python dependencies explained

- **fastapi / uvicorn** — the REST API and server hosting all endpoints (`/ingest`, `/chat`, `/history`, `/page`, `/health`).
- **langgraph** — builds the agent state machine: `condense` (rephrase follow-ups into standalone questions) → `retrieve` (vector search + table expansion) or `load_full` (whole page) → `generate` (LLM answer).
- **langchain-groq** — talks to Groq's inference API; model configured via `LLM_MODEL` env var (currently `openai/gpt-oss-120b`; the old default `llama-3.3-70b-versatile` was decommissioned by Groq).
- **chromadb + langchain-chroma** — local persistent vector database. Chunks are embedded once at ingest and searched by cosine similarity at query time.
- **fastembed** — generates embeddings **locally** on CPU via ONNX (model `BAAI/bge-small-en-v1.5` downloads automatically on first use — no API key needed). Alternative: OpenAI embeddings (set `EMBEDDINGS_PROVIDER=openai` + `OPENAI_API_KEY`).
- **aiosqlite** — async SQLite storage for page metadata and dedup (content-hash caching on re-ingest).
- **slowapi** — API rate limiting per client IP.
- **pydantic-settings** — reads configuration from environment / `backend\.env` file.

### Key frontend dependencies explained

- **@mozilla/readability + turndown** — the extractor pipeline: parse the live DOM into a clean article, convert HTML (including GFM pipe tables) to Markdown before sending to the backend.
- **react-markdown + remark-gfm** — renders the assistant's Markdown answers (tables, bold, code) in the side panel.
- **react 19 + vite** — the side panel app and its build/dev tooling.
- **vitest + jsdom** — unit tests for URL normalization and table extraction.

### Python dependencies (full list — already installed in `D:\we\web_extension`)

```
anthropic 1.11.0          chromadb 1.5.9            fastembed 0.8.1
fastapi 0.142.2           groq 0.37.1               httpx 0.28.1
langchain 1.4.3           langchain-anthropic 1.7.5 langchain-chroma 1.1.0
langchain-community 0.4.2 langchain-core 1.6.6     langchain-groq 1.1.3
langchain-text-splitters 1.1.2                     langgraph 1.2.12
langgraph-checkpoint 4.2.0                         numpy 2.5.3
onnxruntime 1.30.0        pydantic 2.13.5           pydantic-settings 2.15.0
pytest 9.1.1              pytest-asyncio 1.4.0      python-dotenv 1.2.4
ruff 0.16.9               slowapi 0.1.10            SQLAlchemy 2.1.1
starlette 1.7.0           tokenizers 0.23.2         uvicorn 0.54.0
aiohttp 3.14.3            aiosqlite 0.22.1          orjson 3.12.0
```

(To rebuild the venv from scratch: `python -m venv D:\we\web_extension` then `D:\we\web_extension\Scripts\python.exe -m pip install fastapi uvicorn[standard] langchain langchain-community langchain-groq langgraph chromadb langchain-chroma fastembed aiosqlite slowapi pydantic-settings pytest pytest-asyncio httpx ruff`)

### Node dependencies (already in `D:\we\extension\node_modules`)

Install with: `cd extension && npm install` (uses `package-lock.json`).

---

## 4. Configuration (`backend\.env`)

```ini
GROQ_API_KEY=gsk_...                      # Required — Groq API key
LLM_MODEL=openai/gpt-oss-120b             # Main answer model
CONDENSE_MODEL=openai/gpt-oss-120b        # Follow-up rephrasing model
EMBEDDINGS_PROVIDER=local                 # local | openai
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5    # Embedding model (auto-downloads)
OPENAI_API_KEY=                           # Only if EMBEDDINGS_PROVIDER=openai
DATA_DIR=./data                           # Where app.db + chroma/ live
FULL_CONTEXT_MAX_TOKENS=10000             # Pages ≤ this use whole-page mode
MAX_HISTORY_TOKENS=3000
MAX_MARKDOWN_CHARS=300000                 # Ingest size limit
ALLOWED_ORIGINS=http://localhost,chrome-extension://*
```

---

## 5. Commands to Run the Project

### 1. Start the backend (from `D:\we\backend`)

```powershell
# Using the isolated virtualenv (recommended):
.\web_extension\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Or activate the venv first:
D:\we\web_extension\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --port 8000
```

Verify: open http://localhost:8000/health → `{"status": "ok", "version": "0.1.0"}`

### 2. Build the Chrome extension (from `D:\we\extension`)

```powershell
npm install        # only needed once / after dependency changes
npm run build      # builds to D:\we\extension\dist
```

### 3. Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select `D:\we\extension\dist`
4. (Optional) Pin PageChat to the toolbar via the puzzle-piece menu

### 4. Use it

1. Open any web page (e.g., a blog article)
2. Click the **PageChat icon** — the side panel opens, shows the page title, and auto-extracts/indexes the content (status bar shows progress)
3. Type a question and press **Enter** (or click Send) — answers stream in with citation markers
4. **New Chat** starts a fresh thread; **Clear Data** deletes the page's index from the backend

### 5. Development / testing commands

```powershell
# Extension typecheck + unit tests (from D:\we\extension):
npm run compile
npm run test

# Backend tests + lint (from D:\we\backend):
D:\we\web_extension\Scripts\python.exe -m pytest tests -v
D:\we\web_extension\Scripts\python.exe -m ruff check . --fix

# Docker alternative (hosted backend):
docker compose up backend
```

### API quick reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/ingest` | Index page content (header: `X-Install-Id`) |
| POST | `/chat` | Stream chat answer as SSE (header: `X-Install-Id`) |
| GET | `/history` | Fetch conversation history (header: `X-Install-Id`) |
| DELETE | `/page` | Delete page index (header: `X-Install-Id`) |

All endpoints except `/health` require a valid UUID `X-Install-Id` header (generated automatically by the extension).

---

## 6. Privacy Notice

PageChat processes web page content to generate accurate answers. Extracted content is sent to your backend instance and passed to the configured LLM provider (Groq). No page data is sold or used for ad targeting. Banking/email domains are blocked by the extension's denylist.
