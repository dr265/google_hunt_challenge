"""CleanApis LLM client — the ONLY LLM provider for NEXUS.

Base URL : https://cleanapis.com/v1
Model    : Gemini flash models exposed through the OpenAI-compatible endpoint
           (gemini-3.7-flash primary, gemini-3.6-flash / gemma-2-2b fallbacks).

Never uses Google/Gemini APIs directly and never uses xkiro/anymodel/etc —
this file is the single gateway for every model call in the backend.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

BASE_URL = (os.getenv("CLEANAPIS_BASE_URL") or "https://cleanapis.com/v1").rstrip("/")
API_KEY = os.getenv("CLEANAPIS_API_KEY") or ""
MODEL = os.getenv("CLEANAPIS_MODEL") or "gemini-3.7-flash"
FALLBACKS = [
    m.strip()
    for m in (os.getenv("CLEANAPIS_FALLBACK_MODELS") or "gemini-3.6-flash,gemma-2-2b").split(",")
    if m.strip()
]

_session = requests.Session()
_session.headers.update({"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"})


def chat(
    messages: List[Dict[str, Any]],
    model: Optional[str] = None,
    tools: Optional[List[Dict[str, Any]]] = None,
    temperature: float = 0.4,
    max_tokens: int = 1200,
    timeout: float = 120.0,
) -> Dict[str, Any]:
    """One chat completion. Returns the assistant message dict:
    {"content": str|None, "tool_calls": [{"id","name","arguments":dict}]}

    Tries the primary Gemini flash model, then each fallback, then a single
    retry per model for transient 5xx — so a flaky upstream never kills a task.
    """
    chain: List[str] = []
    if model:
        chain.append(model)
    else:
        chain = [MODEL] + FALLBACKS

    payload: Dict[str, Any] = {
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if tools:
        payload["tools"] = tools

    last_err: Exception = RuntimeError("no models configured")
    for m in chain:
        for attempt in (1, 2):
            try:
                r = _session.post(f"{BASE_URL}/chat/completions", json={**payload, "model": m}, timeout=timeout)
                if r.status_code >= 500 and attempt == 1:
                    time.sleep(1.2)
                    continue
                if r.status_code >= 400:
                    raise RuntimeError(f"LLM HTTP {r.status_code}: {r.text[:200]}")
                data = r.json()
                msg = (data.get("choices") or [{}])[0].get("message") or {}
                tool_calls = []
                for i, tc in enumerate(msg.get("tool_calls") or []):
                    fn = tc.get("function") or {}
                    args = fn.get("arguments")
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except json.JSONDecodeError:
                            args = {}
                    tool_calls.append({
                        "id": tc.get("id") or f"call_{i}",
                        "name": fn.get("name") or "",
                        "arguments": args or {},
                    })
                return {"content": msg.get("content"), "tool_calls": tool_calls, "model": m}
            except Exception as e:  # noqa: BLE001
                last_err = e
                if attempt == 1:
                    time.sleep(1.2)
    raise RuntimeError(f"All CleanApis models failed: {last_err}")


def chat_text(messages: List[Dict[str, Any]], **kw) -> str:
    """Convenience: chat() but returns just the text content."""
    result = chat(messages, **kw)
    return (result.get("content") or "").strip()


def extract_json(text: str) -> Any:
    """Pull the first JSON object/array out of an LLM reply."""
    t = text.strip()
    if t.startswith("```"):
        import re
        t = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", t).strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        for opener, closer in (("{", "}"), ("[", "]")):
            start = t.find(opener)
            end = t.rfind(closer)
            if start != -1 and end > start:
                try:
                    return json.loads(t[start:end + 1])
                except json.JSONDecodeError:
                    continue
    return None


def health() -> Dict[str, Any]:
    """Probe the gateway + primary model so the UI can show a real status."""
    try:
        r = _session.post(
            f"{BASE_URL}/chat/completions",
            json={
                "model": MODEL,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 5,
            },
            timeout=20,
        )
        ok = r.status_code < 400
        return {"ok": ok, "base_url": BASE_URL, "model": MODEL,
                "detail": f"HTTP {r.status_code}" if not ok else "online"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "base_url": BASE_URL, "model": MODEL,
                "detail": f"{type(e).__name__}: {e}"}
