from typing import Annotated, TypedDict

from langchain_core.documents import Document
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    summary: str
    page_id: str
    standalone_q: str
    mode: str
    context: list[Document]
    full_text: str
    title: str
