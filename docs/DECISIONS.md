# Architecture Decisions & Record

This document records technical decisions made during the development of **PageChat**.

---

### Decision 001: Isolated Virtual Environment
* **Date:** 2026-10-01
* **Context:** User requested all Python packages and dependencies be isolated in a standalone environment so system environment remains clean.
* **Decision:** Created Python virtual environment at `d:\we\web_extension`. All backend dependencies will be installed strictly inside `web_extension`.

---

### Decision 002: Technology Stack Selection (MV3 + FastAPI)
* **Date:** 2026-10-01
* **Decision:**
  * Chrome Extension: WXT 0.20.x framework with React 19, TypeScript, and Tailwind CSS v4.
  * Backend: FastAPI (Python 3.12) with LangGraph 1.x, Chroma DB vector store, and `fastembed` local embeddings (`BAAI/bge-small-en-v1.5`).
* **Rationale:** As specified in [`PLAN.md`](file:///d:/we/PLAN.md#L60), Chrome `sidePanel` avoids injected CSS/CSP issues, local embeddings eliminate extra paid API keys, and FastAPI + LangGraph provides robust SSE streaming and stateful graph execution.
