"""NEXUS AI Campus — unified backend (ONE merged dataset: demo + live).

The backend serves a single merged campus dataset from `campus_state.py`
(demo seed + live telemetry + real scraped SRMAP facts), exposed through:

  Legacy command-center API (what the React UI actually calls)
    GET  /api/systems                    GET  /api/agents
    GET  /api/command-center/health      GET  /api/command-center/status
    GET  /api/command-center/commands    POST /api/command-center/commands
    POST /api/command-center/interpret
    GET  /api/events                     GET  /api/decisions
    GET  /api/incidents                  GET  /api/actions
    POST /api/actions/{id}/execute

  Live campus + JARVIS API
    GET  /api/health                     POST /api/auth/login
    GET  /api/campus/{status,systems,agents,events,decisions,incidents}
    GET  /api/scenarios
    GET  /api/srmap/facts                POST /api/srmap/refresh
    POST /api/ask                        POST /api/ask/stream (SSE)

LLM: CleanApis gateway ONLY (https://cleanapis.com/v1, gemini flash family).
Earlier the live layer and the demo dataset were separate, so the UI fell back
to bundled demo JSON on endpoints this backend did not expose (e.g. it showed
"No decisions yet"). Both are now merged server-side: one source of truth.
"""
from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import campus_state as cs
import jarvis
import llm
import scraper
from auth import create_token

NEXUS_PORT = int(os.getenv("NEXUS_PORT") or 8010)

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Seed the merged dataset (demo + live + scraped) and start live telemetry."""
    cs.init()
    yield


app = FastAPI(title="NEXUS AI Campus Backend", version="2.0.0-merged", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Wire JARVIS tools to the merged state (SARA pattern: registry + real impls)
# ---------------------------------------------------------------------------
jarvis.register_tool_impl("srmap_knowledge", jarvis.default_srmap_knowledge)
jarvis.register_tool_impl("campus_status", cs.status_text)
jarvis.register_tool_impl("campus_agents", cs.agents_text)
jarvis.register_tool_impl("campus_decisions", cs.decisions_text)
jarvis.register_tool_impl("campus_incidents", cs.incidents_text)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class AskBody(BaseModel):
    query: str


class LoginBody(BaseModel):
    email: Optional[str] = None
    name: str = ""
    username: Optional[str] = None
    password: Optional[str] = None


class InterpretBody(BaseModel):
    text: str


class CommandBody(BaseModel):
    command: str
    idempotency_key: Optional[str] = None
    parameters: Dict[str, Any] = {}
    authorize_low_risk_actions: bool = False


# ---------------------------------------------------------------------------
# Health / auth
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    llm_h = llm.health()
    sr = scraper.cached_or_scrape()
    st = cs.campus_status()
    return {
        "status": "online",
        "mode": "merged (demo seed + live telemetry + scraped facts)",
        "llm": llm_h,
        "campus": st["kpis"],
        "srmap": {
            "facts": len(sr.get("facts") or []),
            "pages_scraped": sr.get("pages_scraped", 0),
            "scraped_at": sr.get("scraped_at"),
            "status": sr.get("status"),
        },
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
    }


@app.post("/api/auth/login")
def login(body: LoginBody):
    """Issue a session token after Clerk Google sign-in on the frontend."""
    email = body.email or body.username or "operator@nexus.local"
    name = body.name or (email.split("@")[0] if email else "Operator")
    token = create_token({"sub": email, "name": name})
    return {"access_token": token, "refresh_token": token, "token_type": "bearer",
            "expires_in": 86400, "email": email, "name": name}


# ---------------------------------------------------------------------------
# Legacy command-center API — served from the merged dataset
# ---------------------------------------------------------------------------
@app.get("/api/systems")
def systems():
    return {"systems": cs.system_rows()}


@app.get("/api/agents")
def agents():
    return {"agents": cs.agent_metadata()}


@app.get("/api/command-center/health")
def agent_health():
    return cs.agent_health()


@app.get("/api/command-center/status")
def campus_status():
    status = cs.campus_status()
    return {
        "timestamp": status["timestamp"],
        "active_workflows": status["active_workflows"],
        "pending_approvals": status["pending_approvals"],
        "open_incidents": status["open_incidents"],
        "dead_letters": status["dead_letters"],
        "kpis": status["kpis"],
        "attention": status["attention"],
    }


@app.get("/api/command-center/commands")
def commands():
    return {"commands": cs.commands()}


@app.post("/api/command-center/commands")
def run_command(body: CommandBody):
    return cs.run_command(body.command, body.parameters)


@app.post("/api/command-center/interpret")
def interpret(body: InterpretBody):
    return cs.interpret(body.text)


@app.get("/api/events")
def events(offset: int = 0, limit: int = 50):
    return cs.events(offset, limit)


@app.get("/api/decisions")
def decisions(offset: int = 0, limit: int = 50):
    return cs.decisions(offset, limit)


@app.get("/api/incidents")
def incidents(offset: int = 0, limit: int = 50):
    return cs.incidents(offset, limit)


@app.get("/api/actions")
def actions(offset: int = 0, limit: int = 50):
    return cs.actions(offset, limit)


@app.post("/api/actions/{action_id}/execute")
def execute_action(action_id: str):
    try:
        return cs.execute_action(action_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown action {action_id}")


@app.get("/api/scenarios")
def scenarios():
    return {"scenarios": cs.CROSS_SYSTEM_SCENARIOS}


# ---------------------------------------------------------------------------
# Live campus API (same merged dataset, campus-shaped)
# ---------------------------------------------------------------------------
@app.get("/api/campus/systems")
def campus_systems():
    return {"systems": cs.systems()}


@app.get("/api/campus/agents")
def campus_agents():
    return {"agents": cs.agents()}


@app.get("/api/campus/events")
def campus_events():
    return {"events": cs.yank_events(30)}


@app.get("/api/campus/decisions")
def campus_decisions():
    return {"decisions": cs.merged_decisions()[:20]}


@app.get("/api/campus/incidents")
def campus_incidents():
    return {"incidents": cs.merged_incidents()[:20]}


@app.get("/api/campus/status")
def campus_status_route():
    return cs.campus_status()


# ---------------------------------------------------------------------------
# SRMAP AI-scraper endpoints
# ---------------------------------------------------------------------------
@app.get("/api/srmap/facts")
def srmap_facts(limit: int = 60):
    data = scraper.cached_or_scrape()
    return {
        "facts": (data.get("facts") or [])[:limit],
        "pages_scraped": data.get("pages_scraped", 0),
        "scraped_at": data.get("scraped_at"),
        "status": data.get("status"),
        "url": scraper.BASE_URL,
    }


@app.post("/api/srmap/refresh")
def srmap_refresh():
    data = scraper.scrape_all(max_pages=10, force=True)
    return {"pages_scraped": data.get("pages_scraped", 0),
            "facts": len(data.get("facts") or []),
            "status": data.get("status"),
            "scraped_at": data.get("scraped_at")}


# ---------------------------------------------------------------------------
# JARVIS ask endpoints
# ---------------------------------------------------------------------------
@app.post("/api/ask")
def ask(body: AskBody):
    """Blocking JARVIS turn (agent loop with tools)."""
    session = jarvis.ask(body.query.strip())
    ok = session.wait(timeout=180)
    if not ok:
        raise HTTPException(status_code=504, detail="JARVIS timed out")
    if session.status == "error":
        raise HTTPException(status_code=502, detail=session.answer)
    return {
        "task_id": session.task_id,
        "answer": session.answer,
        "steps": session.steps,
        "model": llm.MODEL,
    }


@app.post("/api/ask/stream")
async def ask_stream(body: AskBody):
    """SSE stream of the JARVIS pipeline (meta, tool_call, tool_result, done)."""
    session = jarvis.ask(body.query.strip())

    def gen():
        sent = 0
        deadline = time.time() + 180
        while time.time() < deadline:
            events = session.trace
            while sent < len(events):
                ev = events[sent]
                sent += 1
                payload = {k: (v if isinstance(v, (str, int, float, bool)) else str(v))
                           for k, v in ev.items() if k != "t"}
                yield f"data: {payload}\n\n"
            if session._done.is_set() and sent >= len(events):
                break
            time.sleep(0.15)
        yield f"event: end\ndata: {{\"task_id\": \"{session.task_id}\"}}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.get("/")
def root():
    status = cs.campus_status()
    return {
        "service": "NEXUS AI Campus Backend",
        "mode": "merged demo + live",
        "docs": "/docs",
        "health": "/api/health",
        "kpis": status["kpis"],
        "routes": ["/api/systems", "/api/decisions", "/api/incidents", "/api/events",
                   "/api/actions", "/api/agents", "/api/command-center/*", "/api/campus/*",
                   "/api/srmap/*", "/api/ask"],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=NEXUS_PORT)
