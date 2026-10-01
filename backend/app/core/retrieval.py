from langchain_core.documents import Document

from app.core.vectorstore import get_vectorstore


async def retrieve_with_table_expansion(query: str, page_id: str, k: int = 6) -> list[Document]:
    vectorstore = get_vectorstore()
    hits = vectorstore.similarity_search(query, k=k, filter={"page_id": page_id})

    results: list[Document] = list(hits)
    seen_ids = {doc.page_content for doc in results}

    table_ids = {
        doc.metadata["table_id"]
        for doc in hits
        if doc.metadata.get("type") == "table" and "table_id" in doc.metadata
    }

    collection = vectorstore._collection

    for t_id in table_ids:
        try:
            expanded = collection.get(where={"table_id": t_id, "page_id": page_id})
            if expanded and expanded["documents"]:
                if len(expanded["documents"]) > 30:
                    continue  # Skip expansion for huge tables
                for doc_text, meta in zip(expanded["documents"], expanded["metadatas"]):
                    if doc_text not in seen_ids:
                        seen_ids.add(doc_text)
                        results.append(Document(page_content=doc_text, metadata=meta))
                        if len(results) >= 12:
                            break
        except Exception:
            pass

        if len(results) >= 12:
            break

    return results[:12]
