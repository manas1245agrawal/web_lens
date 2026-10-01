from fastapi import APIRouter, Depends

from app.core.db import delete_page_db
from app.core.vectorstore import get_vectorstore
from app.deps import get_install_id

router = APIRouter()


@router.delete("/page")
async def delete_page_route(
    page_id: str, install_id: str = Depends(get_install_id)
):
    try:
        vectorstore = get_vectorstore()
        collection = vectorstore._collection
        existing = collection.get(where={"page_id": page_id})
        if existing and existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception:
        pass

    await delete_page_db(page_id)
    return {"deleted": True}
