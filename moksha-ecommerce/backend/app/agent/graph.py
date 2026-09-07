"""The support agent's LangGraph state machine.

Two nodes and one conditional edge — the whole control flow fits in a sentence:

    START ──> agent ──(wants a tool?)──> tools ──┐
                 │                               │
                 └──(no)──> END                  └──> back to agent

LangGraph rather than a prebuilt agent executor, deliberately (DECISIONS D-002): the graph *is*
the explanation. Every decision the loop makes is visible in `_should_continue` below, including
where it is bounded — an `AgentExecutor` would put the same logic behind an abstraction I would
be describing from documentation rather than from code I wrote.

**The chat model is injected, never constructed here.** That single seam is what lets the test
suite substitute a stub that returns fixed tool calls and stay green with no `ANTHROPIC_API_KEY`
present. It is not a provider abstraction — there is one provider, wired directly in `service.py`.
"""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AnyMessage, SystemMessage
from langchain_core.tools import StructuredTool
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.agent.prompts import SYSTEM_PROMPT
from app.core.logging import get_logger

logger = get_logger(__name__)


class AgentState(TypedDict):
    """What flows through the graph.

    `user_id` is carried in state and is **read-only to the model** — it is here for logging and
    for the invariant that identity travels with the request, never through a tool argument. The
    tools themselves close over the `User` object rather than reading it from state, so even a
    model that could somehow write to state could not redirect them (DECISIONS D-008).
    """

    messages: Annotated[list[AnyMessage], add_messages]
    user_id: int
    steps: int


def _agent_node(model: BaseChatModel, max_steps: int):  # type: ignore[no-untyped-def]
    async def agent(state: AgentState) -> dict[str, object]:
        steps = state.get("steps", 0)

        if steps >= max_steps:
            # A hard stop, not a retry. Without it a model that keeps requesting tools loops
            # until something else times out, and every iteration is a paid API call. Bounding
            # the loop is a cost control as much as a correctness one.
            logger.warning(
                "agent_step_limit_reached",
                extra={"user_id": state["user_id"], "steps": steps},
            )
            return {
                "messages": [
                    AIMessage(
                        content=(
                            "I could not work that out. Could you rephrase, or ask about a "
                            "specific product or order number?"
                        )
                    )
                ],
                "steps": steps + 1,
            }

        # The system prompt is prepended per invocation rather than stored in state, so a long
        # conversation cannot push it out of the window or let earlier turns overwrite it.
        response = await model.ainvoke([SystemMessage(content=SYSTEM_PROMPT), *state["messages"]])
        return {"messages": [response], "steps": steps + 1}

    return agent


def _should_continue(state: AgentState) -> str:
    """The only branch in the graph: did the model ask for a tool?"""
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return END


def build_graph(*, model: BaseChatModel, tools: list[StructuredTool], max_steps: int = 6):  # type: ignore[no-untyped-def]
    """Compile the graph for one request.

    Compiled per request because the tools are bound to that request's database session and
    verified user. That is the cost of building identity into the tools rather than passing it
    as an argument, and it is worth paying: compiling a two-node graph is microseconds, and a
    long-lived graph would need the user threaded through every call anyway.
    """
    builder = StateGraph(AgentState)

    builder.add_node("agent", _agent_node(model.bind_tools(tools), max_steps))
    builder.add_node("tools", ToolNode(tools))

    builder.add_edge(START, "agent")
    builder.add_conditional_edges("agent", _should_continue, {"tools": "tools", END: END})
    # Unconditional: after running tools the model always gets to see the results and answer.
    builder.add_edge("tools", "agent")

    return builder.compile()
