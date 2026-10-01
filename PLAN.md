# PageChat: RAG Chrome Extension, Full Build Plan

> **Audience:** an agentic IDE / coding agent. Build this project end to end by following this document in order.
> **Rule 0:** Where this plan and your assumptions disagree, follow this plan. Where this plan is silent, choose the simplest option and record the decision in `docs/DECISIONS.md`.

---

## 1. Project Summary

### 1.1 Problem statement
Reading long web pages (blogs, docs, research articles, pricing pages) is slow. People want to ask questions about the page they are looking at, and get accurate answers grounded in that page, including content inside **tables**. Copy-pasting a page into a chatbot is tedious, loses structure, and has no memory per page.

### 1.2 Solution
**PageChat** is a Chrome (Manifest V3) extension. When the user clicks the extension icon on any web page, a **side panel** opens with a chat UI. The extension extracts the readable content of the page (converted to Markdown, tables preserved), sends it to a Python backend that indexes it, and then the user can chat about the page. Answers are streamed, grounded in the page, cite their sources, and the **whole conversation is remembered per page**.

### 1.3 Core behaviours (acceptance criteria for the whole project)
1. Click icon → side panel opens → page is extracted and indexed automatically (status shown in UI).
2. Page is **indexed once**. Subsequent questions on the same page never re-extract or re-embed. Re-opening the panel on an unchanged page returns `cached` instantly.
3. If the page content changed (different content hash), it is re-indexed.
4. Every question receives: the new question + full conversation history (trimmed/summarised to a token budget) + relevant page content.
5. Tables are extracted as Markdown pipe tables, chunked without splitting rows, with header repeated, and retrieved as whole tables when any part matches.
6. Short pages (≤ ~10k tokens) skip retrieval and put the full page in the prompt (more accurate, cheaper to build). Long pages use RAG.
7. Answers stream token by token, followed by source references.
8. Conversation history is restored when the panel is reopened on the same page.
9. User can start a "New chat" for the same page and can delete a page's data.

### 1.4 Non-goals (do NOT build in v1)
Login/accounts, payments, Firefox/Safari support, PDF/YouTube ingestion, image/OCR table extraction, cross-page memory, an Express/Node server (explicitly not used), multi-tenant admin dashboards.

---

## 2. System Architecture

```
┌───────────────────────── Chrome Extension (MV3) ─────────────────────────┐
│  Service worker (background.ts): opens side panel on icon click          │
│  Content script (extractor.ts): Readability → HTML → Markdown (+tables)  │
│  Side panel (React + Tailwind): chat UI, streaming, history, sources     │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS: JSON + Server-Sent Events (SSE over POST)
                                │ header: X-Install-Id
                    ┌───────────▼────────────┐
                    │  FastAPI (Python 3.12) │  rate limiting, validation, CORS
                    │  ├─ /ingest            │  chunk + embed + store
                    │  ├─ /chat              │  LangGraph agent (SSE stream)
                    │  ├─ /history           │  restore conversation
                    │  ├─ /page (DELETE)     │  privacy delete
                    │  └─ /health            │
                    └───────┬─────────┬──────┘
                            │         │
              ┌─────────────▼──┐  ┌───▼─────────────────────────┐
              │ Chroma (disk)  │  │ SQLite files (disk)         │
              │ page chunks    │  │ app.db: pages table         │
              │ + embeddings   │  │ checkpoints.db: chat memory │
              └────────────────┘  └─────────────────────────────┘
                            │
                  External: LLM API (Anthropic). Embeddings run locally (fastembed).
```

### 2.1 Key design decisions (fixed)
| Decision | Choice | Reason |
|---|---|---|
| Browser UI | Chrome `sidePanel` API, not injected Shadow DOM | Simpler, no CSS leakage, no page CSP issues |
| Network calls | Made **from the side panel** (an extension page) with `fetch` + stream reader | Extension pages with `host_permissions` bypass CORS; no port plumbing needed |
| SSE | Parse manually from `fetch` response body | `EventSource` does not support POST |
| Backend | Python FastAPI only. **No Express.** | One backend, fewer moving parts |
| Page text | Readability **HTML output** → Turndown (GFM) → Markdown | Keeps tables and headings |
| Isolation | Every page record is scoped to `install_id` | Pages the user sees while logged in (paywalled, private) must never be queryable by other users |
| Embeddings | Local `BAAI/bge-small-en-v1.5` via `fastembed` (default); OpenAI optional via env | No second paid API key; Anthropic has no embeddings API |
| LLM | Anthropic via `langchain-anthropic`, model from env | Configurable |
| Vector DB | Chroma persistent client (disk) | Zero setup |
| Memory | LangGraph `AsyncSqliteSaver` | Persistent per-thread history |

### 2.2 Identity and keys
- `install_id`: random UUID v4 generated by the extension on first run, stored in `chrome.storage.local`. Sent as header `X-Install-Id` on every request.
- `url_norm`: URL with fragment removed and tracking params (`utm_*`, `fbclid`, `gclid`, `ref`) stripped, lowercase host, trailing slash trimmed.
- `page_id = sha256(install_id + "|" + url_norm)` (hex). Used as Chroma metadata filter and `pages` primary key.
- `content_hash = sha256(markdown_text)`. Used to decide re-index.
- `thread_id = f"{install_id}:{page_id}:{chat_version}"`; `chat_version` is an integer starting at `1`, stored client-side per page, incremented by "New chat".

---

## 3. End-to-End Runtime Flow

1. **Icon click** → `background.ts` calls `chrome.sidePanel.open({ tabId })` (side panel is set via `setPanelBehavior({ openPanelOnActionClick: true })`).
2. Side panel mounts, reads/creates `install_id`, gets the active tab.
3. Side panel runs `chrome.scripting.executeScript({ target:{tabId}, files:[extractor] })`, then `chrome.tabs.sendMessage(tabId, {type:"EXTRACT"})`. The content script returns `{ url, title, markdown, tableStats }`.
4. Side panel computes `url_norm`, `content_hash`, and calls **`POST /ingest`** with `{ url, title, markdown, content_hash }`.
   - Backend: if `pages` row exists with same `content_hash` → `{status:"cached"}`.
   - If row exists with different hash → delete old chunks, re-index → `{status:"reindexed"}`.
   - Else chunk (table-aware), embed, store, save full markdown in `pages` → `{status:"indexed"}`.
5. Side panel calls **`GET /history`** and renders previous messages for this thread (if any).
6. User sends a message → **`POST /chat`** with `{ page_id, thread_id, message }` (no page text). Backend runs the LangGraph and streams SSE events: `token`, `sources`, `done`, `error`.
7. UI appends tokens live, then renders source chips.
8. Navigating to another URL (tab `onUpdated` / `history state` change) → side panel detects URL change and repeats steps 3–5 for the new page.

---

## 4. Tech Stack and Dependencies

### 4.1 Version policy (important)
"Most stable" = the **latest stable release of the pinned major version** below. Do not use alpha/beta/rc/canary builds.
Before installing, the agent MUST verify the current latest stable of each package and record the exact versions chosen in `docs/VERSIONS.md`:
- npm: `npm view <pkg> version` and `npm view <pkg> dist-tags`
- pip: `pip index versions <pkg>`
Then **pin exact versions** (`package.json` with exact versions, `package-lock.json` committed; `requirements.txt` generated from a working venv via `pip freeze`, plus a hand-written `requirements.in` listing top-level packages).
LangChain/LangGraph packages must all be on the **1.x** line. If a package's pinned major below no longer exists as stable, choose the latest stable and note it. Check the official docs of the installed versions before writing code; do not rely on memory of older (0.1/0.2/0.3) LangChain import paths.

### 4.2 Extension (TypeScript)
| Tool | Target | Role |
|---|---|---|
| Node.js | 22 LTS | Build tooling only (not a runtime) |
| npm | bundled with Node | Package manager |
| TypeScript | 5.x | Language |
| WXT | 0.20.x | Extension framework (manifest generation, HMR, build) |
| `@wxt-dev/module-react` | matching WXT | React integration for WXT |
| React / React DOM | 19.x | Side panel UI |
| Tailwind CSS | 4.x | Styling |
| `@tailwindcss/vite` | same as Tailwind | Tailwind 4 Vite plugin (no `tailwind.config.js` needed; use `@import "tailwindcss";`) |
| `@mozilla/readability` | latest 0.x stable | Main-content extraction |
| `turndown` | 7.x | HTML → Markdown |
| `turndown-plugin-gfm` | 1.x | GFM tables, strikethrough |
| `react-markdown` | 10.x | Render assistant Markdown |
| `remark-gfm` | 4.x | Table rendering in chat |
| `@types/chrome`, `@types/turndown` | latest | Types |
| `vitest` + `jsdom` | latest stable | Unit tests for extraction helpers |

### 4.3 Backend (Python)
| Package | Target | Role |
|---|---|---|
| Python | 3.12 | Runtime |
| `fastapi` | 0.11x+ stable | Web framework |
| `uvicorn[standard]` | latest stable | ASGI server |
| `pydantic` | 2.x | Request/response models |
| `pydantic-settings` | 2.x | Env config |
| `langchain` | 1.x | Core LangChain |
| `langchain-core` | 1.x | Messages, documents, `trim_messages` |
| `langchain-anthropic` | 1.x | Claude chat model |
| `langchain-text-splitters` | 1.x | Prose splitting |
| `langchain-chroma` | 1.x | Chroma vector store wrapper |
| `chromadb` | 1.x | Vector DB (persistent client) |
| `langchain-community` | latest stable | `FastEmbedEmbeddings` |
| `fastembed` | latest stable | Local embeddings (ONNX, no PyTorch) |
| `langgraph` | 1.x | Agent graph, state, streaming |
| `langgraph-checkpoint-sqlite` | latest stable | `AsyncSqliteSaver` persistence |
| `aiosqlite` | latest stable | Async SQLite (pages table and checkpointer) |
| `slowapi` | latest stable | Rate limiting |
| `python-dotenv` | latest stable | `.env` loading (dev) |
| Dev: `pytest`, `pytest-asyncio`, `httpx`, `ruff` | latest stable | Tests and lint |

Optional (only if `EMBEDDINGS_PROVIDER=openai`): `langchain-openai` 1.x.

### 4.4 Infrastructure
| Item | Choice |
|---|---|
| Containerisation | Docker (`python:3.12-slim`), `docker-compose.yml` for local |
| Hosting (v1) | Render / Railway / Fly.io with a **persistent volume** mounted at `/data` |
| Distribution | Chrome Web Store (one-time developer fee) |

---

## 5. Backend APIs (5 endpoints)

All requests require header `X-Install-Id: <uuid4>` (validate UUID format → else `400`). Base path `/`. JSON unless stated. Rate limits per `X-Install-Id` (fallback to IP): `/ingest` 20/min, `/chat` 30/min, others 60/min. Max body size 2 MB; max `markdown` length 300,000 chars (else `413`).

### 5.1 `GET /health`
- **Role:** uptime check for the host. No auth header required.
- **Response 200:** `{ "status": "ok", "version": "<app version>" }`

### 5.2 `POST /ingest`
- **Role:** index a page once; cache-aware.
- **Request:**
```json
{ "url": "https://...", "title": "Page title", "markdown": "...full markdown...", "content_hash": "sha256hex" }
```
- **Logic:**
  1. Compute `url_norm`, `page_id`.
  2. Look up `pages` row. If `content_hash` equal → return cached.
  3. If row exists but hash differs → delete Chroma chunks where `page_id` matches, then continue.
  4. Run table-aware chunking (see 7.4), embed, add to Chroma with ids `{page_id}-{i}`.
  5. Upsert `pages` row (stores full markdown for the short-page mode).
- **Response 200:** `{ "page_id": "...", "status": "indexed" | "cached" | "reindexed", "chunks": 42, "tables": 3, "mode": "full" | "rag", "token_estimate": 8123 }`
- `mode = "full"` if `token_estimate <= FULL_CONTEXT_MAX_TOKENS` (default 10000), else `"rag"`. In `full` mode chunks may still be stored (cheap) so the page works if the threshold changes.
- Errors: `400` empty markdown (< 200 chars → `{"error":"page_too_short"}`), `413`, `429`, `500`.

### 5.3 `POST /chat` (SSE stream)
- **Role:** answer a question using the LangGraph agent with page context and full conversation memory.
- **Request:** `{ "page_id": "...", "thread_id": "...", "message": "..." }` (message max 4000 chars; `thread_id` must start with `{install_id}:{page_id}:`, else `403`).
- **Response:** `Content-Type: text/event-stream`. Events (each `data: <json>\n\n`):
  - `{"type":"token","text":"..."}` repeated
  - `{"type":"sources","items":[{"id":1,"snippet":"first 200 chars","section":"heading","kind":"text|table"}]}`
  - `{"type":"done"}`
  - `{"type":"error","message":"..."}` on failure (then close)
- Headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
- Errors before streaming: `404` `{"error":"page_not_indexed"}` if no `pages` row (client should call `/ingest` again), `429`.

### 5.4 `GET /history?thread_id=...`
- **Role:** restore conversation when the panel reopens.
- **Response 200:** `{ "messages": [ {"role":"user"|"assistant","content":"..."} ], "summary": "..." | null }`
- Empty thread → `{ "messages": [], "summary": null }`. Validate `thread_id` ownership like `/chat`.

### 5.5 `DELETE /page?page_id=...`
- **Role:** privacy: delete a page's chunks, `pages` row, and all checkpoints for threads of that page (`thread_id` prefix `{install_id}:{page_id}:`).
- **Response 200:** `{ "deleted": true }`.

**External APIs called by the backend: 1** (Anthropic LLM). Embeddings are local (0 external calls) unless OpenAI is enabled.

---

## 6. LangGraph Agent Design

### 6.1 State
```python
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]  # full conversation (auto-append)
    summary: str                 # rolling summary of old turns ("" if none)
    page_id: str
    standalone_q: str
    mode: str                    # "full" | "rag"
    context: list[Document]      # THIS turn only; never persisted into messages
    full_text: str               # only in full mode
```
Persist only `messages` and `summary` meaningfully; `context`/`full_text` are overwritten every turn.

### 6.2 Graph
```
START → condense → route ─┬─(full)→ load_full ─┐
                          └─(rag) → retrieve ──┤
                                               ▼
                                           generate → summarize_if_long → END
```

| Node | Responsibility |
|---|---|
| `condense` | If there is prior history, rewrite the latest user question into a standalone question using `summary` + last 6 messages. If no history, `standalone_q = question`. Use a small/fast model call with `temperature=0`. |
| `route` (conditional edge) | Read `pages.mode`/token estimate for `page_id` → `"full"` or `"rag"`. |
| `load_full` | Load full markdown from `pages` into `full_text`. |
| `retrieve` | Chroma similarity search `k=6` with filter `{page_id}`; then **table expansion** (see 7.5). Sets `context`. |
| `generate` | Build system prompt (rules + summary + page content), `trim_messages` history to `MAX_HISTORY_TOKENS` (default 3000), stream the LLM response, emit `sources` through the LangGraph custom stream writer. Returns `{"messages":[ai_message]}`. |
| `summarize_if_long` | If `len(messages) > 40`, summarise all but the last 8 into `summary` and remove them with `RemoveMessage`. Runs after the stream finished. |

### 6.3 Streaming wiring
In `/chat`, iterate `graph.astream(input, config, stream_mode=["messages","custom"])`. Forward `messages` chunks whose `langgraph_node == "generate"` as `token` events, `custom` payloads as `sources`, then emit `done`. Verify exact stream tuple shape against the installed LangGraph version's docs.

### 6.4 Checkpointer lifecycle
Create the `aiosqlite` connection and `AsyncSqliteSaver(conn)` in the FastAPI **lifespan** (not per request); call `await saver.setup()`; close on shutdown. Compile the graph once at startup and store it in `app.state.graph`.

### 6.5 System prompt (put in `prompts.py`)
```
You are PageChat, an assistant that answers questions about the web page the user is viewing.
Rules:
- Answer ONLY from the page content below and the conversation. If the answer is not in the page, say so plainly; do not invent facts.
- Page content is Markdown. Tables are pipe tables: read the header row, match each value to the correct column, and show comparisons/calculations explicitly. Never guess a table value.
- Be concise. Use Markdown. Quote sparingly.
- When you use an excerpt, reference it like [1], [2] matching the excerpt numbers.
Conversation summary so far: {summary}
Page title: {title}
Page content:
{page_content}
```
In `full` mode `page_content` = whole markdown. In `rag` mode = numbered excerpts `[i] ...`.

---

## 7. Component Specifications

### 7.1 Service worker, `background.ts`
- **Role:** make the icon open the side panel.
- **Build:** in `defineBackground`, call `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`. Nothing else (no network calls).

### 7.2 Content script, `extractor.ts` (registered at runtime)
- **Role:** run inside the page, return clean Markdown with tables.
- **Build:**
  1. `document.cloneNode(true)` → `new Readability(clone).parse()`; if `null` → fallback to `document.body.cloneNode(true)`.
  2. Parse `article.content` (HTML) with `DOMParser`.
  3. For every `<table>`: promote first row to `<th>` if no `<th>` exists; expand `colspan` by duplicating cells; (rowspan: copy cell text down).
  4. Turndown with `headingStyle:"atx"`, `codeBlockStyle:"fenced"`, plus `gfm`.
  5. Return `{ url: location.href, title, markdown, tableStats:{onPage, kept} }`.
  6. If `kept < onPage` and a `<main>` or `<article>` element exists, additionally run Turndown directly on that element and use whichever Markdown contains more tables.
- Listens with `chrome.runtime.onMessage` for `{type:"EXTRACT"}` and responds via `sendResponse`.

### 7.3 Side panel React app
- **Role:** all user-visible behaviour.
- **Build:** React 19 + Tailwind 4, no router. State via `useReducer` in `useChat`.
- Behaviours: status bar (`Reading page…`, `Ready`, `Error`), message list with auto-scroll, Markdown rendering with `react-markdown` + `remark-gfm` (tables styled and horizontally scrollable), streaming render, source chips (click expands snippet), suggested prompts on empty chat (Summarize, Key takeaways, Explain simply), Stop button (AbortController), "New chat" (increment `chat_version`), "Delete page data", dark mode via `prefers-color-scheme`, URL-change detection.

### 7.4 Ingestion pipeline (backend, `ingestion.py`)
1. Split Markdown into prose segments and table segments using regex on consecutive lines starting with `|`.
2. Track the latest heading and the last 300 characters of prose preceding each table.
3. **Prose:** `RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=120)` → docs with metadata `{page_id, type:"text", section}`.
4. **Tables:** keep whole if ≤ 1500 chars. Otherwise split by rows, repeating the 2-line header (header + separator) in every chunk. Each table chunk's `page_content` is prefixed with `Table from section '<heading>'. Preceding text: <context>`. Metadata `{page_id, type:"table", table_id:"{page_id}-t{n}", section}`.
5. Embed and add to Chroma with ids `{page_id}-{i}`.

### 7.5 Retrieval with table expansion (`retrieval.py`)
- `similarity_search(q, k=6, filter={"page_id": page_id})`.
- For each distinct `table_id` among hits, fetch all chunks with that `table_id` (Chroma `get(where=...)`), append those not already present. Skip expansion for tables with more than 30 chunks. Hard cap total context at ~12 chunks.

### 7.6 Token estimate
`token_estimate = len(markdown) // 4` (no tokenizer dependency).

### 7.7 Storage layer
- `app.db` (SQLite, async): table `pages(page_id TEXT PK, install_id TEXT, url TEXT, title TEXT, content_hash TEXT, markdown TEXT, token_estimate INT, mode TEXT, created_at TEXT, last_accessed TEXT)`. Index on `install_id`.
- Chroma persistent client at `${DATA_DIR}/chroma`, collection `pages`, cosine distance.
- LangGraph checkpoints at `${DATA_DIR}/checkpoints.db`.
- **Cleanup job** (asyncio background task, every 6 h): delete pages (rows, chunks, checkpoints) with `last_accessed` older than `PAGE_TTL_DAYS` (default 30).

### 7.8 Security and abuse controls
- No LLM keys in the extension. Keys live only in backend env.
- UUID validation on `X-Install-Id`; ownership checks on `page_id`/`thread_id` (the `page_id` must be recomputable from install_id and a stored page row with matching `install_id`).
- slowapi rate limits; size caps; CORS `allow_origins=["chrome-extension://<EXTENSION_ID>"]` (env), plus `http://localhost` in dev.
- Deny-list in the side panel: do not extract on `chrome://`, `chrome-extension://`, `file://` (unless allowed), `mail.google.com`, `outlook.live.com`, and common banking patterns; show "PageChat is disabled on this site".
- Never log page content or messages; log only ids, sizes, timings.
- Privacy copy required in README and store listing: page text is sent to the backend and to the LLM provider.

---

## 8. Files to Create

### 8.1 Repository layout
```
pagechat/
├── README.md
├── PLAN.md                      # this document
├── docs/
│   ├── DECISIONS.md
│   └── VERSIONS.md
├── docker-compose.yml
├── .gitignore
├── extension/
│   ├── package.json
│   ├── tsconfig.json
│   ├── wxt.config.ts
│   ├── vitest.config.ts
│   ├── .env.example
│   ├── assets/tailwind.css
│   ├── entrypoints/
│   │   ├── background.ts
│   │   ├── extractor.content.ts
│   │   └── sidepanel/
│   │       ├── index.html
│   │       ├── main.tsx
│   │       └── App.tsx
│   ├── src/
│   │   ├── components/
│   │   │   ├── StatusBar.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── SourceChips.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── SuggestedPrompts.tsx
│   │   ├── hooks/
│   │   │   ├── useChat.ts
│   │   │   └── usePage.ts
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── sse.ts
│   │   │   ├── identity.ts
│   │   │   ├── url.ts
│   │   │   ├── hash.ts
│   │   │   ├── denylist.ts
│   │   │   └── types.ts
│   │   └── extract/
│   │       ├── tables.ts
│   │       └── toMarkdown.ts
│   └── tests/
│       ├── tables.test.ts
│       ├── url.test.ts
│       └── sse.test.ts
└── backend/
    ├── requirements.in
    ├── requirements.txt
    ├── Dockerfile
    ├── .env.example
    ├── pytest.ini
    ├── app/
    │   ├── __init__.py
    │   ├── main.py
    │   ├── config.py
    │   ├── deps.py
    │   ├── models.py
    │   ├── routes/
    │   │   ├── __init__.py
    │   │   ├── health.py
    │   │   ├── ingest.py
    │   │   ├── chat.py
    │   │   ├── history.py
    │   │   └── pages.py
    │   ├── core/
    │   │   ├── ids.py
    │   │   ├── ingestion.py
    │   │   ├── retrieval.py
    │   │   ├── vectorstore.py
    │   │   ├── embeddings.py
    │   │   ├── llm.py
    │   │   ├── db.py
    │   │   └── cleanup.py
    │   └── agent/
    │       ├── state.py
    │       ├── prompts.py
    │       ├── nodes.py
    │       └── graph.py
    └── tests/
        ├── test_ids.py
        ├── test_ingestion.py
        ├── test_retrieval.py
        ├── test_api.py
        └── fixtures/sample_page.md
```

### 8.2 Extension files: role and how to build

| File | Role | How to build |
|---|---|---|
| `package.json` | Deps and scripts (`dev`, `build`, `zip`, `test`) | `npm create wxt@latest` with the React template, then add deps from 4.2 with exact versions |
| `wxt.config.ts` | Manifest and build config | `modules:['@wxt-dev/module-react']`; `vite: () => ({ plugins:[tailwindcss()] })`; manifest: `name`, `version`, `permissions:["activeTab","scripting","sidePanel","storage","tabs"]`, `host_permissions:[VITE_API_BASE_URL pattern]`, `action:{default_title:"Chat with this page"}`, `side_panel.default_path:"sidepanel.html"` |
| `.env.example` | `VITE_API_BASE_URL=http://localhost:8000` | Read via `import.meta.env` |
| `assets/tailwind.css` | Tailwind entry | `@import "tailwindcss";` plus small prose/table styles for Markdown output |
| `entrypoints/background.ts` | Open side panel on icon click | Per 7.1 |
| `entrypoints/extractor.content.ts` | Page extraction script | `defineContentScript({ matches:["<all_urls>"], registration:"runtime", main(){ onMessage EXTRACT → extractPage() } })` |
| `src/extract/tables.ts` | `normalizeTable(table)` (header promotion, colspan/rowspan) | Pure DOM function, unit tested with jsdom |
| `src/extract/toMarkdown.ts` | `extractPage()` combining Readability + tables + Turndown | Per 7.2 |
| `entrypoints/sidepanel/index.html` | Side panel HTML shell | Mounts `#root`, loads `main.tsx` |
| `entrypoints/sidepanel/main.tsx` | React entry | `createRoot(...).render(<App/>)`, imports `tailwind.css` |
| `entrypoints/sidepanel/App.tsx` | Layout and orchestration | Uses `usePage` and `useChat`; renders StatusBar, MessageList (or SuggestedPrompts when empty), ChatInput, header menu (New chat, Delete data) |
| `src/hooks/usePage.ts` | Active tab, extraction, `/ingest`, URL-change detection | Query active tab, check denylist, inject script, message it, compute hashes, call `api.ingest`; listen to `chrome.tabs.onUpdated`/`onActivated` and re-run; expose `{status, pageId, mode, error, title}` |
| `src/hooks/useChat.ts` | Messages state, streaming send, history restore, stop | `useReducer`; on `pageId` ready call `api.history`; `send()` appends user msg and empty assistant msg, streams tokens into it, attaches `sources`; on `404 page_not_indexed` re-run ingest once and retry; abort controller for Stop |
| `src/lib/api.ts` | Typed backend client | Functions `ingest`, `history`, `deletePage`, `chatStream` (returns async iterator of events); always set `X-Install-Id` |
| `src/lib/sse.ts` | SSE parser for `fetch` body | Read `ReadableStream`, decode, split on blank lines, strip `data: `, `JSON.parse`; handle partial chunks |
| `src/lib/identity.ts` | `getInstallId()`, `getChatVersion(pageId)`, `bumpChatVersion(pageId)` | `chrome.storage.local` |
| `src/lib/url.ts` | `normalizeUrl()` | Strip fragment and tracking params, lowercase host |
| `src/lib/hash.ts` | `sha256Hex(text)` | `crypto.subtle.digest` |
| `src/lib/denylist.ts` | `isBlocked(url)` | Scheme and hostname/pattern checks |
| `src/lib/types.ts` | Shared TS types for events and responses | Mirror backend `models.py` |
| `src/components/*` | Presentational pieces | Tailwind-only; `MessageBubble` renders assistant text with `react-markdown`+`remark-gfm`, tables inside `overflow-x-auto` |
| `tests/*.test.ts` | Unit tests | Vitest: table normalisation, URL normalisation, SSE partial-chunk parsing |

### 8.3 Backend files: role and how to build

| File | Role | How to build |
|---|---|---|
| `requirements.in` / `requirements.txt` | Dependencies | Per 4.3; freeze after a working install |
| `.env.example` | Documented env vars | See section 9 |
| `Dockerfile` | Production image | `python:3.12-slim`, install requirements, pre-download the embedding model at build time (`python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"`), run `uvicorn app.main:app --host 0.0.0.0 --port 8000`, `ENV DATA_DIR=/data` |
| `app/config.py` | Typed settings | `pydantic-settings` `Settings` class; single cached `get_settings()` |
| `app/main.py` | App factory | `lifespan` creates DB, Chroma client, embeddings, LLM, checkpointer, compiled graph in `app.state`, starts cleanup task; add CORS, slowapi limiter, routers, global exception handler returning JSON |
| `app/deps.py` | FastAPI dependencies | `get_install_id` (validates header UUID), `get_state` helpers, ownership check `assert_owns(page_id, thread_id, install_id)` |
| `app/models.py` | Pydantic models | `IngestRequest/Response`, `ChatRequest`, `HistoryResponse`, SSE event models |
| `app/routes/health.py` | `GET /health` | Trivial |
| `app/routes/ingest.py` | `POST /ingest` | Per 5.2; calls `core.ingestion` and `core.db` |
| `app/routes/chat.py` | `POST /chat` | Per 5.3; `StreamingResponse` over an async generator; wrap in try/except to emit `error` event; stop on client disconnect |
| `app/routes/history.py` | `GET /history` | `graph.aget_state(config)`; map message types to roles; return `summary` |
| `app/routes/pages.py` | `DELETE /page` | Delete Chroma ids by `where page_id`, delete `pages` row, delete checkpoints for matching threads (query the checkpoint tables by `thread_id LIKE prefix%`) |
| `app/core/ids.py` | `normalize_url`, `make_page_id`, `sha256` helpers | Pure functions with tests |
| `app/core/ingestion.py` | Table-aware chunking | Per 7.4 |
| `app/core/retrieval.py` | Search plus table expansion | Per 7.5 |
| `app/core/vectorstore.py` | Chroma setup | `chromadb.PersistentClient(path)`, `langchain_chroma.Chroma(client=..., collection_name="pages", embedding_function=..., collection_metadata={"hnsw:space":"cosine"})` |
| `app/core/embeddings.py` | Embeddings factory | `FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")` or OpenAI by env |
| `app/core/llm.py` | Chat model factory | `ChatAnthropic(model=settings.LLM_MODEL, temperature=0.2, streaming=True)`; separate cheap model instance for `condense`/summaries |
| `app/core/db.py` | `pages` table access | `aiosqlite` helpers: `get_page`, `upsert_page`, `delete_page`, `touch_page`, `list_stale` |
| `app/core/cleanup.py` | TTL job | Async loop per 7.7 |
| `app/agent/state.py` | `State` TypedDict | Per 6.1 |
| `app/agent/prompts.py` | Prompt templates | Per 6.5 plus condense and summarise prompts |
| `app/agent/nodes.py` | Node functions | Per 6.2; nodes receive dependencies (llm, vectorstore, db) via closures/factory `make_nodes(deps)` |
| `app/agent/graph.py` | `build_graph(deps, checkpointer)` | StateGraph wiring with conditional edge on `route` |
| `tests/*` | Tests | Chunking (tables never split mid-row, header repeated), table expansion, ID/URL normalisation, API tests with `httpx.AsyncClient` and a fake LLM (`GenericFakeChatModel`) |

---

## 9. Configuration (backend `.env`)
```
ANTHROPIC_API_KEY=
LLM_MODEL=claude-haiku-4-5-20251001      # chat model; change to a stronger model if desired
CONDENSE_MODEL=claude-haiku-4-5-20251001
EMBEDDINGS_PROVIDER=local                  # local | openai
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
OPENAI_API_KEY=                            # only if EMBEDDINGS_PROVIDER=openai
DATA_DIR=./data
FULL_CONTEXT_MAX_TOKENS=10000
MAX_HISTORY_TOKENS=3000
MAX_MARKDOWN_CHARS=300000
PAGE_TTL_DAYS=30
ALLOWED_ORIGINS=chrome-extension://<EXTENSION_ID>,http://localhost
APP_VERSION=0.1.0
```

---

## 10. Build Order (execute in sequence; do not skip the verification gates)

**Phase 0, Scaffold.** Create the repo layout, `docs/`, `.gitignore`, both projects, install deps, record versions in `docs/VERSIONS.md`.
*Gate:* `npm run build` succeeds in `extension/`; `uvicorn app.main:app` starts and `GET /health` returns ok.

**Phase 1, Extraction (no backend).** Build `background.ts`, `extractor.content.ts`, `tables.ts`, `toMarkdown.ts`, minimal side panel that shows extracted Markdown.
*Gate:* On a Wikipedia article with tables, the panel shows Markdown pipe tables with correct columns. Unit tests for `tables.ts` pass.

**Phase 2, Ingestion backend.** `config`, `db`, `ids`, `embeddings`, `vectorstore`, `ingestion`, `/ingest`.
*Gate:* `pytest tests/test_ingestion.py` passes (no mid-row table splits, header repeated, context prefix present). Calling `/ingest` twice with the same payload returns `indexed` then `cached`; changing one character returns `reindexed`.

**Phase 3, Agent and chat.** `state`, `prompts`, `nodes`, `graph`, `retrieval`, `/chat` SSE, `/history`.
*Gate:* With `curl -N`, ask a question, then a follow-up ("explain that more") and confirm the answer uses prior context. Both `full` and `rag` modes work (set `FULL_CONTEXT_MAX_TOKENS=1` to force RAG). A table question returns correct column values.

**Phase 4, Connect UI.** `identity`, `url`, `hash`, `api`, `sse`, `usePage`, `useChat`, all components.
*Gate:* End-to-end on a real blog: panel opens, status goes Reading → Ready, answer streams, sources appear, close/reopen restores history, second open shows `cached`.

**Phase 5, Hardening.** Rate limiting, ownership checks, size caps, deny-list, error states (backend down, `page_not_indexed`, page too short, rate-limited), Stop button, New chat, Delete data, TTL cleanup, dark mode.
*Gate:* All tests pass; manual checks: install A cannot read install B's `thread_id` (403); oversized body returns 413.

**Phase 6, Ship.** Dockerfile and `docker-compose.yml`, README (setup, env, privacy statement), deploy backend with persistent volume at `/data`, set `VITE_API_BASE_URL` and `ALLOWED_ORIGINS` to the production values, `npm run zip`, prepare Chrome Web Store listing.
*Gate:* Extension built against the production URL works on a fresh Chrome profile.

---

## 11. Testing Checklist
- **Unit (TS):** table normalisation (no `<th>`, colspan, rowspan), URL normalisation, SSE parser with split chunks.
- **Unit (Python):** chunking invariants, ID generation, token estimate, ownership validation.
- **API:** ingest caching states, chat SSE event order (`token`… → `sources` → `done`), history restore, delete removes chunks and threads, 403/404/413/429 paths.
- **Manual pages:** a long blog (RAG mode), a short blog (full mode), a Wikipedia page with many tables, a docs page, a page with no readable content (graceful error).

---

## 12. Known Limitations (document in README)
Tables that are images, tables built from `<div>` grids, nested tables, and lazily loaded tables are not guaranteed to extract. Very wide tables may be unwieldy. Single-page apps are handled by re-extracting on URL change, but heavily dynamic pages may need a manual refresh. Summarised conversation turns are removed from displayed history.

## 13. Instructions to the Coding Agent
1. Work phase by phase; run the gate for each phase before moving on and fix failures immediately.
2. Do not add libraries, endpoints, or features not listed here. Do not add Express.
3. Keep functions small and typed (TypeScript `strict`, Python type hints); run `ruff` and `tsc --noEmit` before finishing each phase.
4. Never hardcode secrets. Never log page content.
5. Consult official docs for the installed versions of LangChain, LangGraph, WXT, Chroma and Tailwind before writing code against them, since their APIs change between major versions.
6. After each phase, update `README.md` with how to run what exists so far.
