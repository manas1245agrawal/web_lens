import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage

from app.agent.graph import build_graph
from app.core.db import get_page, touch_page
from app.deps import get_install_id, validate_thread_ownership
from app.models import ChatRequest

router = APIRouter()


@router.post("/chat")
async def chat_endpoint(
    body: ChatRequest, install_id: str = Depends(get_install_id)
):
    validate_thread_ownership(body.thread_id, install_id, body.page_id)

    page = await get_page(body.page_id)
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="page_not_indexed",
        )

    await touch_page(body.page_id)
    mode = page.get("mode", "rag")

    async def event_generator():
        try:
            graph = build_graph()
            config = {"configurable": {"thread_id": body.thread_id}}

            inputs = {
                "messages": [HumanMessage(content=body.message)],
                "page_id": body.page_id,
                "mode": mode,
            }

            # Stream chunks from graph execution
            async for event in graph.astream(inputs, config, stream_mode="messages"):
                msg, metadata = event
                if metadata.get("langgraph_node") == "generate" and getattr(
                    msg, "content", None
                ):
                    payload = json.dumps({"type": "token", "text": msg.content})
                    yield f"data: {payload}\n\n"
                    await asyncio.sleep(0.01)

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            err_payload = json.dumps({"type": "error", "message": str(e)})
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
