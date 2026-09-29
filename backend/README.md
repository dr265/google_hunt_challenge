> NEXUS AI Campus — backend (ONE merged dataset)

```bash
pip install -r requirements.txt
python main.py
```

## Merged demo + live state
`campus_state.py` is the single source of truth. It merges three provenance layers
into one consistent picture and labels every record:

| layer | flag | meaning |
|---|---|---|
| demo seed (ported from the frontend's `src/data/demo.ts`) | `demo: true` | seeded demo records |
| live telemetry (simulated campus feeds) | `live: true` | live backend telemetry; enriches seed rows (aliases: `academics→academic`, `power→energy`, `network→it`) |
| AI-scraped SRMAP facts | `real: true` | real data scraped from `https://www.srmap.edu.in/` |

Result: 17 monitored systems, 19 domain agents, one event stream, one decision log —
served by this backend alone, so the UI never has to fall back to bundled demo JSON.

## Routes
Legacy command-center API (what the React UI calls):
`/api/systems`, `/api/agents`, `/api/command-center/{health,status,commands,interpret}`,
`/api/events`, `/api/decisions`, `/api/incidents`, `/api/actions`, `/api/actions/{id}/execute`

Live campus + JARVIS API:
`/api/health`, `/api/auth/login`, `/api/campus/{status,systems,agents,events,decisions,incidents}`,
`/api/scenarios`, `/api/srmap/{facts,refresh}`, `/api/ask`, `/api/ask/stream` (SSE)

## Notes
- LLM: CleanApis gateway (`https://cleanapis.com/v1`) — `gemini-3.7-flash` primary,
  `gemini-3.6-flash` + `gemma-2-2b` fallbacks. No Google/Gemini API used directly.
- The CleanApis gateway rejects OpenAI-style multi-turn `tool_calls` payloads (HTTP 502),
  so the JARVIS loop feeds tool results back as flattened user messages.
- Campus knowledge: AI web scraper over `https://www.srmap.edu.in/` (ported from
  the SARA Nexus Hub scraping agent), cached in `srmap_cache.json` (6h TTL).
- JARVIS agent: tool-loop ported from the SARA Autonomous Agent (JARVIS core).

Use `start.bat` at the repo root to launch backend + frontend together.
