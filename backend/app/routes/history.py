from fastapi import APIRouter, Depends

from app.agent.graph import build_graph
from app.deps import get_install_id
from app.models import ChatMessage, HistoryResponse

router = APIRouter()


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    thread_id: str, install_id: str = Depends(get_install_id)
):
    try:
        graph = build_graph()
        config = {"configurable": {"thread_id": thread_id}}
        state = await graph.aget_state(config)

        if not state or not state.values:
            return HistoryResponse(messages=[], summary=None)

        raw_messages = state.values.get("messages", [])
        summary = state.values.get("summary", None)

        formatted: list[ChatMessage] = []
        for msg in raw_messages:
            role = "user" if msg.type == "human" else "assistant"
            formatted.append(ChatMessage(role=role, content=str(msg.content)))

        return HistoryResponse(messages=formatted, summary=summary)
    except Exception:
        return HistoryResponse(messages=[], summary=None)
