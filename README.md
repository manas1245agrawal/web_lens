# PageChat 🚀

PageChat is a Chrome (Manifest V3) extension and Python backend that lets you chat with any web page using RAG (Retrieval-Augmented Generation). It automatically extracts web page content (including Markdown pipe tables), indexes it into a local vector store, and provides streaming answers grounded in the page.

---

## 🔒 Isolated Environment Setup

All backend dependencies run inside an isolated Python virtual environment named `web_extension` located at `d:\we\web_extension`.

### 1. Backend Setup

```bash
# Activate virtual environment (Windows PowerShell)
.\web_extension\Scripts\Activate.ps1

# Or run backend server directly using virtualenv binary:
.\web_extension\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### 2. Extension Setup

```bash
cd extension
npm install
npm run dev
```

---

## 📄 Privacy Notice
PageChat processes web page content to generate accurate answers. Extracted content is sent to your backend instance and passed to the configured LLM provider (Anthropic Claude). No page data is sold or used for ad targeting.
