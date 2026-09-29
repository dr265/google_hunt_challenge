"""NEXUS JARVIS agent — a voice/text campus assistant with real tools.

Adapted from the SARA Autonomous Agent (JARVIS core) in the SARA AI Nexus Hub
(sara-ai-platform/backend/app/api/sara_auto_agent.py):

  * Same design principle: the LLM is an *agent*, not a chatbot. The system
    prompt tells it exactly which tools exist; the model decides which to
    call; real tool outputs go back into the conversation; the final answer
    is generated from what really happened.
  * Tools are campus-shaped instead of desktop-shaped: campus status,
    agents, decisions, incidents, SRMAP knowledge base (AI-scraper), etc.

The run loop (llm -> tool_calls -> execute -> feed back -> repeat) mirrors
the SARA `_run(session)` loop 1:1.
"""
from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

import llm
import scraper

MAX_TOOL_ROUNDS = 6
TOOL_OUTPUT_LIMIT = 2500

SYSTEM_PROMPT = """You are NEXUS JARVIS, the AI campus command assistant of SRM University AP.
You answer operators through a command-center UI, often read aloud by the browser voice engine.
Today is {today}.

OPERATING RULES
1. You are an agent, not a chatbot. When a question can be answered with a tool,
   CALL THE TOOL — do not guess, do not describe what you could do.
2. Anything about SRM University AP itself (programs, schools, admissions, campus
   facts, contacts) MUST come from srmap_knowledge. Never answer those from memory.
3. Campus live state (systems, alerts, incidents, decisions) comes from the
   campus_* tools. Voice questions usually want a SHORT spoken answer: 1-4 clear
   sentences, no markdown, no bullet lists unless the user asked for detail.
4. Report facts only. If a tool fails or returns nothing, say so honestly.
5. Final answer: plain text. Address the operator politely ("sir" is fine).

TOOLS
{tools}"""

TOOLS: Dict[str, Dict[str, Any]] = {
    "srmap_knowledge": {
        "description": "Search the live AI-scraped SRM University AP knowledge base "
                       "(programs, schools, admissions, fees, campus, placements, contacts).",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string",
                                     "description": "What to look up, e.g. 'CSE branch admission'"}},
            "required": ["query"],
        },
    },
    "campus_status": {
        "description": "Get the live campus-wide status: system health, active alerts, KPIs.",
        "parameters": {"type": "object", "properties": {}},
    },
    "campus_agents": {
        "description": "List the campus AI agents and their health/active tasks.",
        "parameters": {"type": "object", "properties": {}},
    },
    "campus_decisions": {
        "description": "List recent AI-generated campus decisions (with confidence).",
        "parameters": {"type": "object", "properties": {}},
    },
    "campus_incidents": {
        "description": "List recent campus incidents and their severity/status.",
        "parameters": {"type": "object", "properties": {}},
    },
}


# ---------------------------------------------------------------------------
# Tool implementations (wired to the live backend state by main.py at startup)
# ---------------------------------------------------------------------------
_impls: Dict[str, Callable[..., Any]] = {}


def register_tool_impl(name: str, fn: Callable[..., Any]) -> None:
    _impls[name] = fn


def _run_tool(name: str, args: Dict[str, Any]) -> str:
    fn = _impls.get(name)
    if fn is None:
        return f"Tool '{name}' is not available."
    try:
        out = fn(**(args or {}))
    except Exception as e:  # noqa: BLE001
        return f"Tool error: {type(e).__name__}: {e}"
    return str(out)[:TOOL_OUTPUT_LIMIT]


def tool_declarations() -> List[Dict[str, Any]]:
    return [
        {"type": "function", "function": {
            "name": name,
            "description": spec["description"],
            "parameters": spec.get("parameters") or {"type": "object", "properties": {}},
        }}
        for name, spec in TOOLS.items()
    ]


# ---------------------------------------------------------------------------
# Session — mirrors SARA's _Session (event queue + trace + steps)
# ---------------------------------------------------------------------------
class JarvisSession:
    def __init__(self, goal: str):
        self.task_id = uuid.uuid4().hex[:12]
        self.goal = goal
        self.status = "queued"
        self.created = time.time()
        self.trace: List[Dict[str, Any]] = []
        self.steps: List[Dict[str, Any]] = []
        self.answer: str = ""
        self._events: List[Dict[str, Any]] = []
        self._done = threading.Event()

    def emit(self, kind: str, **kw):
        self._events.append({"type": kind, **kw})
        self.trace.append({"t": time.time(), "kind": kind, **kw})

    def wait(self, timeout: float = 120.0) -> bool:
        return self._done.wait(timeout)

    def finish(self, status: str, answer: str):
        self.status = status
        self.answer = answer
        self._done.set()


_sessions: Dict[str, JarvisSession] = {}
_lock = threading.Lock()


def ask(goal: str) -> JarvisSession:
    """Start a JARVIS turn in a worker thread (same shape as SARA /sara-auto/run)."""
    s = JarvisSession(goal)
    with _lock:
        _sessions[s.task_id] = s
    threading.Thread(target=_run, args=(s,), daemon=True, name="jarvis-turn").start()
    return s


def get_session(task_id: str) -> Optional[JarvisSession]:
    return _sessions.get(task_id)


def _run(session: JarvisSession) -> None:
    """The agent loop — a direct port of SARA's `_run(session)`."""
    session.status = "running"
    session.emit("meta", model=llm.MODEL, tools=sorted(TOOLS))
    session.emit("log", message=f"[JARVIS] Goal: {session.goal}")

    system = SYSTEM_PROMPT.format(
        today=time.strftime("%A, %d %B %Y"),
        tools="\n".join(f"- {n}: {spec['description']}" for n, spec in TOOLS.items()),
    )
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": session.goal + "\n\n(Use tools to gather live facts before answering.)"},
    ]
    tools = tool_declarations()

    final = ""
    try:
        # NOTE on the conversation format: the CleanApis gateway rejects the
        # OpenAI-style multi-turn sequence (assistant message carrying tool_calls
        # followed by role:"tool" messages) with HTTP 502. The loop therefore
        # stays "flattened": every round sends only system+user messages, and
        # tool outputs are fed back as [TOOL RESULT] user messages. Tool calls
        # still come back in the OpenAI format on each round, so the agent
        # behavior is identical.
        for round_no in range(1, MAX_TOOL_ROUNDS + 1):
            result = llm.chat(messages, tools=tools, temperature=0.4, max_tokens=1200, timeout=120)
            content = (result.get("content") or "").strip()
            tool_calls = result.get("tool_calls") or []

            if not tool_calls:
                final = content
                break

            for tc in tool_calls:
                name, args = tc["name"], tc["arguments"]
                session.emit("tool_call", name=name, args=args)
                if name not in TOOLS:
                    out, ok = f"Tool '{name}' does not exist. Available: {', '.join(TOOLS)}", False
                else:
                    out, ok = _run_tool(name, args), True
                session.steps.append({"name": name, "args": args, "ok": ok})
                session.emit("tool_result", name=name, ok=ok, output=out[:600])
                messages.append({"role": "user",
                                 "content": f"[TOOL RESULT — {name}]\n{out}"})

        if not final:
            messages.append({"role": "user",
                             "content": "Tool budget reached. Give your final answer now based on what actually happened."})
            result = llm.chat(messages, temperature=0.4, max_tokens=800, timeout=120)
            final = (result.get("content") or "").strip()
    except Exception as e:  # noqa: BLE001
        session.emit("log", message=f"[JARVIS] error: {e}")
        final = f"JARVIS hit an error: {e}. The campus data layer may be unreachable — try again."
        session.finish("error", final)
        return

    session.emit("done", answer=final)
    session.finish("done", final)


# ---------------------------------------------------------------------------
# Built-in default tool impls (main.py can override with live data)
# ---------------------------------------------------------------------------
def default_srmap_knowledge(query: str = "") -> str:
    facts = scraper.search_facts(query, limit=10)
    if not facts:
        return "No SRMAP facts found for that query (the AI scraper may still be filling the cache)."
    lines = []
    for f in facts:
        parts = [f"{k}: {v}" for k, v in f.items() if k not in ("url", "source") and v]
        lines.append(" • " + " | ".join(parts))
    return "\n".join(lines)
