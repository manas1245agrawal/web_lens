from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from app.agent.nodes import condense_node, generate_node, load_full_node, retrieve_node
from app.agent.state import AgentState

_checkpointer: MemorySaver | None = None


def get_checkpointer() -> MemorySaver:
    global _checkpointer
    if _checkpointer is None:
        _checkpointer = MemorySaver()
    return _checkpointer


def route_node(state: AgentState) -> str:
    mode = state.get("mode", "rag")
    if mode == "full":
        return "load_full"
    return "retrieve"


def build_graph(checkpointer=None):
    workflow = StateGraph(AgentState)

    workflow.add_node("condense", condense_node)
    workflow.add_node("load_full", load_full_node)
    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("generate", generate_node)

    workflow.add_edge(START, "condense")
    workflow.add_conditional_edges("condense", route_node)

    workflow.add_edge("load_full", "generate")
    workflow.add_edge("retrieve", "generate")
    workflow.add_edge("generate", END)

    return workflow.compile(checkpointer=checkpointer or get_checkpointer())
