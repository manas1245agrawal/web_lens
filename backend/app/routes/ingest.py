from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.core.db import get_page, upsert_page
from app.core.ids import make_page_id, normalize_url
from app.core.ingestion import index_page_chunks
from app.deps import get_install_id
from app.models import IngestRequest, IngestResponse

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_page(
    body: IngestRequest, install_id: str = Depends(get_install_id)
):
    settings = get_settings()

    if len(body.markdown) > settings.MAX_MARKDOWN_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Page content exceeds maximum allowed character length",
        )

    if len(body.markdown.strip()) < 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="page_too_short",
        )

    url_norm = normalize_url(body.url)
    page_id = make_page_id(install_id, url_norm)
    token_estimate = len(body.markdown) // 4
    mode = "full" if token_estimate <= settings.FULL_CONTEXT_MAX_TOKENS else "rag"

    existing = await get_page(page_id)

    if existing and existing.get("content_hash") == body.content_hash:
        return IngestResponse(
            page_id=page_id,
            status="cached",
            chunks=0,
            tables=0,
            mode=mode,
            token_estimate=token_estimate,
        )

    status_str = "reindexed" if existing else "indexed"

    chunks_count, tables_count = await index_page_chunks(page_id, body.markdown)

    await upsert_page(
        page_id=page_id,
        install_id=install_id,
        url=body.url,
        title=body.title,
        content_hash=body.content_hash,
        markdown=body.markdown,
        token_estimate=token_estimate,
        mode=mode,
    )

    return IngestResponse(
        page_id=page_id,
        status=status_str,
        chunks=chunks_count,
        tables=tables_count,
        mode=mode,
        token_estimate=token_estimate,
    )
