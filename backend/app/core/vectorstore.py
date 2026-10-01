import os

import chromadb
from langchain_chroma import Chroma

from app.config import get_settings
from app.core.embeddings import get_embeddings


def get_chroma_client() -> chromadb.PersistentClient:
    settings = get_settings()
    chroma_dir = os.path.join(settings.DATA_DIR, "chroma")
    os.makedirs(chroma_dir, exist_ok=True)
    return chromadb.PersistentClient(path=chroma_dir)


def get_vectorstore() -> Chroma:
    client = get_chroma_client()
    embeddings = get_embeddings()
    return Chroma(
        client=client,
        collection_name="pages",
        embedding_function=embeddings,
        collection_metadata={"hnsw:space": "cosine"},
    )
