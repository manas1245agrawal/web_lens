from typing import Literal

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    url: str
    title: str = "Untitled Page"
    markdown: str
    content_hash: str


class IngestResponse(BaseModel):
    page_id: str
    status: Literal["indexed", "cached", "reindexed"]
    chunks: int
    tables: int
    mode: Literal["full", "rag"]
    token_estimate: int


class ChatRequest(BaseModel):
    page_id: str
    thread_id: str
    message: str = Field(..., max_length=4000)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class HistoryResponse(BaseModel):
    messages: list[ChatMessage]
    summary: str | None = None
