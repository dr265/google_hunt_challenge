# NEXUS AI - Campus Intelligence Command Center

**One AI layer across every campus system.** Multi-agent intelligence that sees,
correlates, decides, and speaks - operated by voice through JARVIS.

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents

- [The Problem](#the-problem)
- [Our Solution](#our-solution)
- [Feature Matrix](#feature-matrix)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [JARVIS Tools](#jarvis-tools)
- [Project Structure](#project-structure)
- [2-Minute Demo Script](#2-minute-demo-script)
- [Engineering Notes](#engineering-notes)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

---

## The Problem

A modern university runs on **10+ independent systems** - academics, transport,
security, hostels, power, network, health centre, facilities. Each has its own
dashboard and its own alerts, so nobody sees the *connections*:

- A delayed bus route + a 09:00 exam slot = **1,240 students arriving late**.
- A voltage dip + an auditorium event in the same building = **a power failure at peak load**.
- Six SLA-breached maintenance complaints in one block = **one hidden root cause**.

Staff discover these correlations *after* they become incidents, by phoning around.
The data exists; the coordination doesn't.

## Our Solution

NEXUS AI is a single command layer that sits above siloed campus systems:

| # | Capability | What it does |
|---|---|---|
| 1 | **Ingests** | Pulls events from every campus system into one correlated event stream. |
| 2 | **Reasons** | A multi-agent orchestrator (Academic, Transport, Security, Hostel, Maintenance, Emergency) correlates across domains. |
| 3 | **Decides** | Produces evidence, confidence scores, risks and constraints - never a black box. |
| 4 | **Acts** | Executes approval-gated actions (notify, escalate, raise a maintenance request). |
| 5 | **Speaks** | JARVIS, a real tool-calling voice agent, answers any operator question out loud and grounds every answer in live data. |

> **One-line pitch:** *NEXUS AI turns a university's disconnected systems into one
> coordinated, explainable, voice-operated intelligence layer.*


## Feature Matrix

| Capability | Status |
|---|---|
| Live LLM reasoning via an OpenAI-compatible gateway (`gemini-3.7-flash`, auto-failover) | Working |
| JARVIS tool-calling agent loop (5 campus tools, real tool outputs fed back) | Working |
| Voice in + voice out (browser speech recognition -> LLM -> speech synthesis) | Working |
| AI web scraper over `srmap.edu.in` extracting structured campus facts | Working (live) |
| Campus state API: systems, agents, events, decisions, incidents, KPIs | Working |
| Premium landing + interactive hero UI (React, Tailwind, Framer Motion) | Working |
| Google sign-in via Clerk, exchanged for a backend session token | Working |
| Unified one-click launcher (`start.bat`: backend + frontend + browser) | Working |

> **On data honesty:** campus telemetry comes from a live simulation worker, so the
> system is fully demonstrable without privileged access to real university systems.
> Every scraped SRMAP fact, every LLM answer and every agent action is real - and every
> record is labelled with its provenance (`demo` / `live` / `real`).

## Architecture

```
+------------------+         +------------------+         +-------------------+
|  React 18 + Vite |         |  FastAPI backend |         |  LLM gateway      |
|  (TypeScript)    |  /api   |  (Python)         |  HTTP   |  (OpenAI-compat)  |
|                  | ------> |                  | ------> |  gemini-3.7-flash |
|  - Landing/hero  |  SSE    |  - campus state  |  <------ |  gemini-3.6-flash |
|  - JARVIS voice  | <------ |  - JARVIS agent  |         |  gemma-2-2b       |
|  - Campus/agents |         |  - AI web scraper|         +-------------------+
|  - Decisions     |         |  - event stream  |                 |
|  - Incidents     |         |  - Clerk auth    |                 |
+------------------+         +------------------+                 |
                                     |                            |
                                     v                            v
                              +--------------+          +--------------------+
                              | srmap.edu.in |          |  JARVIS tool loop  |
                              | AI-scraped   |          |  (5 campus tools)  |
                              | 6h cache     |          +--------------------+
                              +--------------+
```

**The correlation pipeline** (what the Command Center visualises live):

```
Campus Systems -> Agents -> Shared Context -> NEXUS Orchestrator
              -> Cross-System Intelligence -> Decision -> Action
```

## Tech Stack

**Frontend** - React 18, TypeScript 5.6, Vite 5, Tailwind CSS 3, Framer Motion,
Lucide React, React Router 6, Clerk (`@clerk/clerk-react`)

**Backend** - Python 3.13, FastAPI, Uvicorn, BeautifulSoup4 + lxml, PyJWT, httpx,
python-dotenv

**LLM** - an OpenAI-compatible gateway exposing Gemini flash models. No Google/Gemini API
is called directly; `backend/llm.py` is the single gateway for every model call.


## Quick Start

### Prerequisites

- **Node.js 18+** and **npm**
- **Python 3.10+** and **pip**
- A free **Clerk** account (for Google sign-in) - see [dashboard.clerk.com](https://dashboard.clerk.com)
- *(Optional)* An API key for an OpenAI-compatible LLM gateway - the app degrades
  gracefully without one, but JARVIS answers will be unavailable.

### Option A - One-click (Windows)

Double-click **`start.bat`**. It installs missing dependencies, boots the backend on
`:8010`, waits for `/api/health`, starts Vite on `:5173`, and opens your browser.

### Option B - Manual

**1. Clone and install**

```bash
git clone https://github.com/shubhamy-ops/google_hunt_challenge.git
cd google_hunt_challenge
npm install
pip install -r backend/requirements.txt
```

**2. Configure environment**

```bash
# Frontend
copy .env.example .env          # Windows
cp .env.example .env            # macOS / Linux

# Backend
copy backend\.env.example backend\.env        # Windows
cp backend/.env.example backend/.env          # macOS / Linux
```

Then edit both files and paste in your own keys (see [Environment Variables](#environment-variables)).

**3. Run the backend** (terminal 1)

```bash
cd backend
python main.py
# -> http://localhost:8010   (interactive API docs at /docs)
```

**4. Run the frontend** (terminal 2)

```bash
npm run dev
# -> http://localhost:5173
```

Vite proxies every `/api/*` request to the backend, so no CORS setup is required.

**5. Build for production**

```bash
npm run build      # -> dist/
npm run preview    # serve the production build locally
npm run typecheck  # tsc --noEmit
```

## Environment Variables

Real `.env` files are **git-ignored**; only `.env.example` templates are committed.

### Frontend - `.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk **Frontend API** publishable key (`pk_test_...` / `pk_live_...`). |
| `VITE_API_BASE` | No | Base path for API calls. Defaults to `/api`. |
| `NEXUS_API_URL` | No | Backend origin for the Vite dev proxy. Defaults to `http://localhost:8010`. Read by Vite only - never shipped to the browser. |

### Backend - `backend/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `CLEANAPIS_BASE_URL` | No | `https://cleanapis.com/v1` | OpenAI-compatible gateway base URL. |
| `CLEANAPIS_API_KEY` | No | - | Gateway API key. Without it, LLM features are disabled. |
| `CLEANAPIS_MODEL` | No | `gemini-3.7-flash` | Primary model. |
| `CLEANAPIS_FALLBACK_MODELS` | No | `gemini-3.6-flash,gemma-2-2b` | Comma-separated failover chain. |
| `SRMAP_URL` | No | `https://www.srmap.edu.in/` | Target site for the AI scraper. |
| `NEXUS_JWT_SECRET` | Yes | - | Signing secret for dev session tokens. Use 32+ random chars. |
| `NEXUS_PORT` | No | `8010` | Port the backend binds to. |

> **Security note:** an LLM API key was previously committed in plaintext inside
> `backend/.env.example`. It has been redacted and the file now contains placeholders only.
> If that key was ever pushed to a public remote, **rotate it** at the provider.

## API Reference

All routes are prefixed with `/api`.

### Command Center (what the React UI calls)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Liveness + gateway health probe. |
| `POST` | `/auth/login` | Exchange a Clerk session for a backend token. |
| `GET` | `/systems` | Monitored campus systems. |
| `GET` | `/agents` | Domain agent registry. |
| `GET` | `/command-center/health` | Per-agent health. |
| `GET` | `/command-center/status` | Campus-wide KPIs. |
| `GET` | `/command-center/commands` | Available command catalogue. |
| `POST` | `/command-center/commands` | Execute a command -> decision, evidence, conflicts, confidence. |
| `POST` | `/command-center/interpret` | Natural-language -> structured intent. |
| `GET` | `/events` | Activity feed (paginated). |
| `GET` | `/decisions` | Decision log. |
| `GET` | `/incidents` | Incident log. |
| `GET` | `/actions` | Pending/available actions. |
| `POST` | `/actions/{id}/execute` | Execute an approval-gated action. |

### Live Campus + JARVIS

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/scenarios` | Pre-built cross-system demo scenarios. |
| `GET` | `/campus/status` | Live campus KPIs. |
| `GET` | `/campus/systems`, `/campus/agents` | Live systems / agents. |
| `GET` | `/campus/events`, `/campus/decisions`, `/campus/incidents` | Live correlated records. |
| `GET` | `/srmap/facts` | AI-scraped SRMAP facts (cached, 6h TTL). |
| `POST` | `/srmap/refresh` | Force a scraper refresh. |
| `POST` | `/ask` | One-shot JARVIS question -> grounded answer. |
| `POST` | `/ask/stream` | Same, streamed as **SSE** (tool events arrive live). |

## JARVIS Tools

JARVIS is a real tool-calling agent. Its system prompt instructs it to *call tools rather
than guess*, and to report failures honestly instead of fabricating. Five campus tools are
registered at startup:

| Tool | Returns |
|---|---|
| `campus_status` | Campus-wide KPIs, system health, active incidents. |
| `campus_agents` | The domain agent registry and per-agent status. |
| `campus_decisions` | Recent decisions with confidence and approval state. |
| `campus_incidents` | Open incidents with severity and cross-system correlation. |
| `srmap_knowledge` | Real facts scraped live from `srmap.edu.in`. |

The loop runs for up to **6 tool rounds**; each tool's output (truncated to 2,500 chars)
is fed back into the conversation.

## Project Structure

```
.
├── start.bat                     # One-click launcher (backend + frontend + browser)
├── package.json                  # Frontend scripts & dependencies
├── vite.config.ts                # Vite config + /api dev proxy
├── tailwind.config.js
├── tsconfig.json
├── index.html
├── .env.example                  # Frontend env template
│
├── backend/
│   ├── main.py                   # FastAPI app - all HTTP routes
│   ├── campus_state.py           # Single source of truth: demo + live + scraped layers
│   ├── jarvis.py                 # Tool-calling agent loop + tool registry
│   ├── llm.py                    # LLM gateway: model chain, retry, health probe
│   ├── scraper.py                # AI web scraper (page -> LLM -> structured facts)
│   ├── auth.py                   # JWT create/verify, Clerk bridge
│   ├── requirements.txt
│   ├── srmap_cache.json          # Scraper cache (6h TTL)
│   ├── .env.example
│   └── README.md                 # Backend-specific notes
│
└── src/
    ├── App.tsx                   # Routes + ClerkProvider + AuthBridge
    ├── api/
    │   ├── client.ts             # API client: auth, timeout, demo fallback, SSE
    │   ├── types.ts              # Mirrors the backend Pydantic schemas 1:1
    │   └── hooks.ts              # Polling + mode hooks
    ├── components/
    │   ├── Layout.tsx            # Sidebar, mode badge, navigation
    │   ├── JarvisConsole.tsx     # Voice/text console + tool event stream
    │   ├── CommandBar.tsx        # JARVIS pipeline visualisation
    │   ├── Orb.tsx               # Animated agent network
    │   └── ui.tsx                # UI primitives
    ├── data/demo.ts              # Demo dataset mirroring the backend seed
    └── pages/
        ├── Landing.tsx           # Hero
        ├── CommandCenter.tsx     # KPI strip + JARVIS
        ├── Campus.tsx            # System grid + schematic map
        ├── Agents.tsx            # Agent network
        ├── Decisions.tsx         # Evidence, confidence, risks, approval
        ├── Incidents.tsx         # Severity escalation timeline
        ├── Activity.tsx          # Correlated event ticker
        ├── Contact.tsx
        └── Login.tsx             # Clerk Google sign-in
```

## 2-Minute Demo Script

1. **Landing** - premium hero, hit **Launch NEXUS**.
2. **Command Center** - KPI strip (systems online, degraded, workflows, agents) and the
   JARVIS Voice Console with the human-portrait reel behind it.
3. Tap the mic (or type): *"What is happening across campus right now?"*
   - watch the tool chips light up (`campus_status`, `campus_agents`, `campus_incidents`,
   `campus_decisions`) - JARVIS **speaks** the correlated briefing.
4. Ask: *"Where is SRM University AP and how big is the campus?"*
   - JARVIS calls `srmap_knowledge` and answers from **live scraped data**
   (*"Neerukonda, Mangalagiri, Guntur District... 100-acre campus designed by Perkins & Will"*).
5. **Decisions** - open an AI decision: evidence, confidence, risks, approval gate.
6. **Incidents** - severity timeline with cross-system correlation.
7. **Get in touch** - typewriter hero, multi-select services, springy acknowledgment banner.

|---|---|
| `campus_status` | Campus-wide KPIs, system health, active incidents. |
| `campus_agents` | The domain agent registry and per-agent status. |

## Engineering Notes

Details worth knowing if you're reading the code:

- **Gateway `tool_calls` workaround.** The LLM gateway rejects OpenAI-style multi-turn
  `tool_calls` payloads with HTTP 502. The JARVIS loop therefore flattens tool results back
  in as `[TOOL RESULT]` user messages. Documented inline in `backend/jarvis.py`.
- **Non-blocking scraper.** The AI scraper caches results with a 6h TTL and refreshes in a
  background thread, so the UI never blocks on network I/O.
- **Model failover.** Every LLM call walks the chain
  `gemini-3.7-flash -> gemini-3.6-flash -> gemma-2-2b`, with one retry per model on
  transient 5xx - a flaky upstream never kills a request.
- **Provenance labelling.** `campus_state.py` merges three layers into one consistent
  picture and labels each record:

  | Layer | Flag | Meaning |
  |---|---|---|
  | Demo seed (ported from `src/data/demo.ts`) | `demo: true` | Seeded demo records |
  | Live telemetry (simulated campus feeds) | `live: true` | Live backend telemetry; enriches seed rows (`academics`->`academic`, `power`->`energy`, `network`->`it`) |
  | AI-scraped SRMAP facts | `real: true` | Live data from `https://www.srmap.edu.in/` |

  Result: **17 monitored systems, 19 domain agents**, one event stream, one decision log.
- **Never an empty state.** The dashboard always has data - resilient fallbacks guarantee it.
- **Auth flow.** Clerk handles Google sign-in in the browser; the `AuthBridge` exchanges the
  session for a backend-signed JWT via `POST /api/auth/login`. If the backend is offline the
  UI still runs and JARVIS reports the outage rather than crashing.

## Troubleshooting

| Symptom | Cause & fix |
|---|---|
| `ModuleNotFoundError: fastapi` | Run `pip install -r backend/requirements.txt` in the backend's Python environment. |
| Frontend shows `DEMO DATA` while the backend is running | The browser is pointed at the wrong origin. Set `NEXUS_API_URL` before `npm run dev`, then sign in via the sidebar. |
| Port 8010 already in use | Change `NEXUS_PORT` in `backend/.env` and `NEXUS_API_URL` in `.env` to match. |
| JARVIS says the tool/gateway is unavailable | `CLEANAPIS_API_KEY` is missing or invalid. Check `GET /api/health` for the gateway probe result. |
| Clerk sign-in fails | `VITE_CLERK_PUBLISHABLE_KEY` is wrong, or your allowed origins don't include `http://localhost:5173`. |
| Voice input does nothing | Browser speech recognition needs a secure context and mic permission; use Chrome/Edge. |
| `npm run build` fails | Run `npm run typecheck` to surface the real TypeScript error. |

## Roadmap

**Today** - one campus, six domains, voice ops.

**Next**

- Plug into real campus APIs (LMS, transport GPS, access control)
- Role-based approvals for high-impact actions
- On-device wake-word JARVIS
- Predictive incident forecasting from historical events
- A mobile operator app

---

## License

Released under the [MIT License](LICENSE).

---

<div align="center">

**NEXUS AI** - built for the Google Solution Challenge

Made with love by [shubhamy-ops](https://github.com/shubhamy-ops)

*If this project helped you, consider starring the repo*
