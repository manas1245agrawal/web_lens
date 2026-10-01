from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.agent.prompts import CONDENSE_PROMPT, SYSTEM_PROMPT
from app.agent.state import AgentState
from app.config import get_settings
from app.core.db import get_page
from app.core.retrieval import retrieve_with_table_expansion


def get_llm():
    settings = get_settings()
    return ChatGroq(
        model=settings.LLM_MODEL,
        groq_api_key=settings.GROQ_API_KEY,
        temperature=0.2,
        streaming=True,
    )


async def condense_node(state: AgentState) -> dict:
    messages = state.get("messages", [])
    if not messages:
        return {"standalone_q": ""}

    last_user_msg = messages[-1].content
    summary = state.get("summary", "")

    if len(messages) <= 1 and not summary:
        return {"standalone_q": last_user_msg}

    # Rephrase follow up
    llm = get_llm()
    prompt = CONDENSE_PROMPT.format(summary=summary, question=last_user_msg)
    try:
        res = await llm.ainvoke([HumanMessage(content=prompt)])
        return {"standalone_q": res.content.strip()}
    except Exception:
        return {"standalone_q": last_user_msg}


async def load_full_node(state: AgentState) -> dict:
    page_id = state.get("page_id", "")
    page_data = await get_page(page_id)
    if page_data:
        return {
            "full_text": page_data.get("markdown", ""),
            "title": page_data.get("title", "Untitled"),
        }
    return {"full_text": "", "title": "Untitled"}


async def retrieve_node(state: AgentState) -> dict:
    page_id = state.get("page_id", "")
    query = state.get("standalone_q", "")
    page_data = await get_page(page_id)
    title = page_data.get("title", "Untitled") if page_data else "Untitled"

    docs = await retrieve_with_table_expansion(query, page_id, k=6)
    return {"context": docs, "title": title}


async def generate_node(state: AgentState) -> dict:
    mode = state.get("mode", "rag")
    summary = state.get("summary", "")
    title = state.get("title", "Untitled")
    messages = state.get("messages", [])

    if mode == "full":
        page_content = state.get("full_text", "")
    else:
        context_docs = state.get("context", [])
        page_content = "\n\n".join(
            [f"[{i+1}] {doc.page_content}" for i, doc in enumerate(context_docs)]
        )

    sys_text = SYSTEM_PROMPT.format(
        summary=summary, title=title, page_content=page_content
    )

    llm = get_llm()
    input_messages = [SystemMessage(content=sys_text)] + messages

    response = await llm.ainvoke(input_messages)
    return {"messages": [response]}
