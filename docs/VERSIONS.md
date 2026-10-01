# Pinned Dependency Versions

This document records the exact pinned major and minor release versions chosen for **PageChat** (both Extension and Backend).

---

## 1. Extension Dependencies (`extension/package.json`)

| Package | Pinned Version | Description / Role |
|---|---|---|
| `wxt` | `0.20.0` | Chrome extension framework (MV3) |
| `@wxt-dev/module-react` | `1.2.2` | React integration for WXT |
| `react` | `19.0.0` | UI Library |
| `react-dom` | `19.0.0` | DOM Renderer for React |
| `tailwindcss` | `4.0.0` | Styling |
| `@tailwindcss/vite` | `4.0.0` | Tailwind 4 Vite Plugin |
| `@mozilla/readability` | `0.5.0` | Web page article/content extractor |
| `turndown` | `7.2.0` | HTML to Markdown converter |
| `turndown-plugin-gfm` | `1.0.2` | GFM table plugin for Turndown |
| `react-markdown` | `10.1.0` | Assistant Markdown rendering |
| `remark-gfm` | `4.0.1` | Markdown GFM plugin (tables) |
| `typescript` | `5.6.3` | TypeScript compiler |
| `vitest` | `2.1.0` | Unit test runner |
| `jsdom` | `25.0.0` | DOM environment for unit tests |

---

## 2. Backend Dependencies (`backend/requirements.txt`)

| Package | Pinned Version | Description / Role |
|---|---|---|
| `python` | `3.13` | Runtime (venv: `web_extension`) |
| `fastapi` | `0.142.2` | Web API framework |
| `uvicorn` | `0.54.0` | ASGI server |
| `pydantic` | `2.13.5` | Data validation & schemas |
| `pydantic-settings` | `2.15.0` | Settings & env loading |
| `langchain` | `1.4.3` | Core RAG framework |
| `langchain-core` | `1.6.6` | Messages & documents interfaces |
| `langchain-anthropic` | `1.7.5` | Claude chat model wrapper |
| `langchain-chroma` | `1.1.0` | ChromaDB vector store integration |
| `chromadb` | `1.5.9` | Vector database |
| `fastembed` | `0.8.1` | Local ONNX embeddings (`BAAI/bge-small-en-v1.5`) |
| `langgraph` | `1.2.12` | Agent state graph & streaming |
| `langgraph-checkpoint-sqlite` | `3.1.1` | Async SQLite checkpointer |
| `aiosqlite` | `0.22.1` | Async SQLite database client |
| `slowapi` | `0.1.10` | Rate limiting |
| `pytest` | `9.1.1` | Backend test runner |
| `pytest-asyncio` | `1.4.0` | Async testing for pytest |
| `httpx` | `0.28.1` | Async HTTP client for API testing |
