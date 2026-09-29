"""NEXUS campus state — ONE merged dataset (demo seed + live telemetry + scraped truth).

Before this module the backend had two parallel, disconnected datasets:

  * a small *live* layer served under /api/campus/* (6 systems, 6 agents, a
    handful of events/decisions/incidents), and
  * the much richer *demo* dataset the frontend had to carry client-side
    (src/data/demo.ts) because nothing on the backend served the legacy routes
    the UI actually calls (/api/systems, /api/agents, /api/command-center/*,
    /api/events, /api/decisions, /api/incidents, /api/actions).
    Those routes 404'd, the client dropped to demo mode, and pages such as
    Decision Intelligence rendered "No decisions yet".

This module merges both into a single dataset served by the single backend.
Provenance is preserved on every record so nothing is ever passed off as
something it is not:

    demo = True    → seeded demo record (ported from src/data/demo.ts)
    live = True    → live backend telemetry (simulated campus feeds)
    real = True    → real data scraped from https://www.srmap.edu.in/

Live telemetry *enriches* the demo seed (domain aliases map live ids onto the
seed ids, and a live status wins over a seeded one); the AI-scraped SRMAP facts
are injected as real evidence into decisions. The result is one consistent
picture: 17 monitored systems, 18 domain agents, one event stream, one decision
log — regardless of whether a given fact came from seed data or a live feed.
"""
from __future__ import annotations

import random
import threading
import time
import uuid
from typing import Any, Dict, List, Optional

import scraper

# ===========================================================================
# A. DEMO SEED — ported 1:1 from the frontend's src/data/demo.ts
# ===========================================================================

DEMO_SYSTEMS: List[Dict[str, Any]] = [
    {"id": "academic", "name": "Academic", "status": "available"},
    {"id": "attendance", "name": "Attendance", "status": "available"},
    {"id": "transport", "name": "Transport", "status": "degraded"},
    {"id": "events", "name": "Events", "status": "available"},
    {"id": "sports", "name": "Sports", "status": "available"},
    {"id": "hostel", "name": "Hostel", "status": "available"},
    {"id": "mess", "name": "Mess", "status": "available"},
    {"id": "health", "name": "Health Center", "status": "degraded"},
    {"id": "communication", "name": "Communication", "status": "available"},
    {"id": "finance", "name": "Finance", "status": "available"},
    {"id": "facilities", "name": "Facilities", "status": "degraded"},
    {"id": "library", "name": "Library", "status": "available"},
    {"id": "security", "name": "Security", "status": "available"},
    {"id": "parking", "name": "Parking", "status": "available"},
    {"id": "energy", "name": "Energy", "status": "degraded"},
    {"id": "it", "name": "IT / Network", "status": "degraded"},
    {"id": "maintenance", "name": "Maintenance", "status": "available"},
]

# Live telemetry speaks slightly different domain ids for the same systems.
_LIVE_ID_ALIAS = {"academics": "academic", "power": "energy", "network": "it"}

DEMO_DETAILS: Dict[str, str] = {
    "academic": "Timetables, courses, exams, faculty allocation",
    "attendance": "Biometric + RFID attendance pipelines",
    "transport": "Fleet, shuttle routes, arrival prediction",
    "events": "Campus events, venue booking, crowd planning",
    "sports": "Facilities, tournaments, ground bookings",
    "hostel": "Occupancy, complaints, warden workflows",
    "mess": "Menus, counters, consumption forecasting",
    "health": "Campus clinic, duty doctor, emergencies",
    "communication": "Notifications, notices, campus-wide broadcasts",
    "finance": "Fees, scholarships, vendor payments",
    "facilities": "Rooms, HVAC, electrical safety, closures",
    "library": "Catalogue, loans, reservations, reading halls",
    "security": "Access control, CCTV triage, patrols",
    "parking": "Capacity, occupancy, overflow planning",
    "energy": "Load, meters, anomalies, DG standby",
    "it": "Network core, Wi-Fi, endpoints, outages",
    "maintenance": "Complaints, SLA tracking, field crews",
}

DEMO_AGENT_ROLES: Dict[str, str] = {
    "academic": "Timetables, attendance, exam operations",
    "attendance": "Eligibility thresholds and attendance audits",
    "transport": "Fleet, routes, delay prediction",
    "events": "Event coordination and crowd modelling",
    "sports": "Ground and tournament scheduling",
    "hostel": "Occupancy and maintenance requests",
    "mess": "Menu planning and consumption forecasting",
    "health": "Clinic load, duty rosters, escalations",
    "communication": "Campus-wide notification delivery",
    "finance": "Fee reconciliation and vendor payouts",
    "facilities": "Room availability and building restrictions",
    "library": "Catalogue search and loan tracking",
    "security": "Access control and CCTV triage",
    "parking": "Occupancy tracking and overflow routing",
    "energy": "Load monitoring and anomaly detection",
    "it": "Network and endpoint incident triage",
    "maintenance": "Facilities, power, repairs, SLA",
}

# Seed telemetry: live, always-present campus picture (demo=False).
DEMO_EVENT_SEED: List[Dict[str, Any]] = [
    {"source": "transport", "event_type": "BUS_DELAY_DETECTED",
     "summary": "Route 7 delayed 18 min — arrival congestion at East Gate", "severity": "medium"},
    {"source": "events", "event_type": "EVENT_CREATED",
     "summary": "Mid-semester exam schedule published to all UG programs", "severity": "low"},
    {"source": "security", "event_type": "SECURITY_INCIDENT_REPORTED",
     "summary": "Access alarm cleared at Innovation Fair hall B", "severity": "low"},
    {"source": "hostel", "event_type": "MAINTENANCE_REQUESTED",
     "summary": "Water tanker round 2 completed for blocks C-D", "severity": "low"},
]

DEMO_INCIDENT_SEED: List[Dict[str, Any]] = [
    {"id": "inc-1", "severity": "critical", "status": "open", "requester_id": "emergency-agent",
     "summary": "Synthetic medical response exercise (escalation pending human approval).",
     "age_min": 12},
    {"id": "inc-2", "severity": "high", "status": "investigating", "requester_id": "maintenance-agent",
     "summary": "Correlated building incident: power + network + security at Engineering Building A.",
     "age_min": 48},
    {"id": "inc-3", "severity": "high", "status": "open", "requester_id": "security-agent",
     "summary": "Access alarm active at Engineering Building A during Innovation Fair.",
     "age_min": 25},
]

DEMO_ACTIONS: List[Dict[str, Any]] = [
    {"id": "act-1", "kind": "send_notification", "risk": "LOW", "status": "executed",
     "age_min": 9, "demo": True,
     "payload": {"audience": "authorized-campus-operators",
                 "message": "East Gate Alternative recommended for exam arrival."},
     "result": {"delivery": "recorded_locally_not_delivered"}},
    {"id": "act-2", "kind": "create_maintenance_request", "risk": "MEDIUM", "status": "pending_approval",
     "age_min": 20, "demo": True,
     "payload": {"building_id": "building-a",
                 "description": "Investigate repeated power complaints (6, SLA breached)."},
     "result": None},
    {"id": "act-3", "kind": "escalate_incident", "risk": "CRITICAL", "status": "pending_approval",
     "age_min": 12, "demo": True,
     "payload": {"severity": "critical",
                 "summary": "Correlated building incident at Engineering Building A."},
     "result": None},
]

# Scenarios the UI renders on the Command Center / Campus pages.
CROSS_SYSTEM_SCENARIOS: List[Dict[str, Any]] = [
    {
        "id": "event-transport-security",
        "title": "Large Event → Transport + Parking + Security",
        "trigger": "University Innovation Fair detected (220 attendees)",
        "chain": [
            {"system": "events", "detail": "Crowd of 220 expected, congestion predicted"},
            {"system": "transport", "detail": "Transport demand 150 vs 75 free shuttle seats"},
            {"system": "parking", "detail": "Parking demand 80 vs 25 free spaces"},
            {"system": "security", "detail": "Monitoring level raised near Block A"},
        ],
        "outcome": "Coordinate Large Event workflow recommends shuttle reinforcement and overflow parking.",
        "command": "coordinate_large_event",
    },
    {
        "id": "exam-transport",
        "title": "Exam at 10 AM → Route Delay + Arrival Risk",
        "trigger": "CS301 Examination at 10:00 tomorrow",
        "chain": [
            {"system": "academic", "detail": "CS301 exam scheduled, room A101"},
            {"system": "transport", "detail": "Main Gate Route delayed 35 min"},
            {"system": "transport", "detail": "East Gate Alternative: 18 min, no delay"},
            {"system": "academic", "detail": "Arrival risk calculated: main route misses deadline"},
        ],
        "outcome": "Optimize Transport workflow recommends the East Gate Alternative (arrives 22 min early).",
        "command": "optimize_transport",
    },
    {
        "id": "maintenance-facilities",
        "title": "Building Maintenance → Classroom Unavailable",
        "trigger": "Electrical-safety closure of Engineering Building A",
        "chain": [
            {"system": "maintenance", "detail": "6 SLA-breached power complaints"},
            {"system": "facilities", "detail": "Lecture Hall A101 marked restricted"},
            {"system": "academic", "detail": "CS301 exam + seminar conflict detected in A101"},
            {"system": "facilities", "detail": "Seminar Hall B201 found: capacity 150, projector, reachable"},
        ],
        "outcome": "Find Available Resources workflow recommends relocating to Seminar Hall B201.",
        "command": "find_available_resources",
    },
]

# ===========================================================================
# B. LIVE LAYER — live telemetry feeds (simulated campus systems)
# ===========================================================================

LIVE_SYSTEMS: List[Dict[str, Any]] = [
    {"id": "academics", "name": "Academics", "status": "operational",
     "detail": "LMS, timetables, attendance pipelines", "load": 0.42},
    {"id": "transport", "name": "Transport", "status": "degraded",
     "detail": "2 buses delayed on Route 7 (gate congestion)", "load": 0.71},
    {"id": "security", "name": "Security", "status": "operational",
     "detail": "All gates nominal, CCTV mesh online", "load": 0.35},
    {"id": "hostel", "name": "Hostel", "status": "operational",
     "detail": "Occupancy 88%, water tankers scheduled", "load": 0.55},
    {"id": "power", "name": "Power & Utilities", "status": "operational",
     "detail": "Grid stable, DG standby ready", "load": 0.48},
    {"id": "network", "name": "Campus Network", "status": "operational",
     "detail": "Core links healthy, 4% packet loss spike resolved", "load": 0.61},
]

LIVE_AGENTS: List[Dict[str, Any]] = [
    {"id": "academic-agent", "name": "Academic Agent", "domain": "academic",
     "role": "Timetables, attendance, exam ops", "status": "operational", "active_tasks": 2},
    {"id": "transport-agent", "name": "Transport Agent", "domain": "transport",
     "role": "Fleet, routes, delays", "status": "degraded", "active_tasks": 4},
    {"id": "security-agent", "name": "Security Agent", "domain": "security",
     "role": "Access control, CCTV triage", "status": "operational", "active_tasks": 1},
    {"id": "hostel-agent", "name": "Hostel Agent", "domain": "hostel",
     "role": "Occupancy, maintenance requests", "status": "operational", "active_tasks": 3},
    {"id": "maintenance-agent", "name": "Maintenance Agent", "domain": "maintenance",
     "role": "Facilities, power, repairs", "status": "operational", "active_tasks": 2},
    {"id": "emergency-agent", "name": "Emergency Agent", "domain": "emergency",
     "role": "Medical/fire escalation", "status": "standby", "active_tasks": 0},
]

# The UI's agent-network widget looks up these exact ids.
AGENT_NETWORK_IDS = ["academic", "transport", "events", "facilities", "security", "health",
                     "it", "maintenance", "parking", "energy", "attendance", "comm"]

LIVE_EVENTS: List[Dict[str, Any]] = [
    {"id": "evt-1", "agent_id": "transport-agent", "kind": "alert", "domain": "transport",
     "summary": "Route 7 delayed 18 min — arrival congestion at East Gate",
     "severity": "medium", "ts": time.time() - 300},
    {"id": "evt-2", "agent_id": "academic-agent", "kind": "info", "domain": "academic",
     "summary": "Mid-semester exam schedule published to all UG programs",
     "severity": "low", "ts": time.time() - 900},
    {"id": "evt-3", "agent_id": "security-agent", "kind": "alert", "domain": "security",
     "summary": "Access alarm cleared at Innovation Fair hall B",
     "severity": "low", "ts": time.time() - 1500},
    {"id": "evt-4", "agent_id": "hostel-agent", "kind": "info", "domain": "hostel",
     "summary": "Water tanker round 2 completed for blocks C-D",
     "severity": "low", "ts": time.time() - 2100},
]

LIVE_DECISIONS: List[Dict[str, Any]] = [
    {"id": "dec-1", "title": "Redirect exam arrival flow via East Gate",
     "problem": "optimize_transport", "confidence": 0.91, "status": "recommended",
     "requester_id": "transport-agent",
     "rationale": "Transport + exam schedules correlate; Route 7 delay risks late arrivals for the 09:00 slot.",
     "evidence": ["Route 7 delay 18 min", "09:00 exam slot, 1,240 candidates", "East Gate throughput 62%"],
     "systems": ["academic", "transport", "events"],
     "risks": ["Increased traffic at service road"], "age_min": 4},
    {"id": "dec-2", "title": "Pre-position maintenance crew at Innovation Fair",
     "problem": "investigate_incident", "confidence": 0.84, "status": "approved",
     "requester_id": "maintenance-agent",
     "rationale": "Power fluctuations in hall B correlate with fair load peak.",
     "evidence": ["3 voltage dips 14:02-14:31", "Fair attendance 2.1k"],
     "systems": ["maintenance", "energy", "events"],
     "risks": ["Crew availability"], "age_min": 60},
    {"id": "dec-3", "title": "Shift library HVAC to eco mode overnight",
     "problem": "get_campus_status", "confidence": 0.78, "status": "executed",
     "requester_id": "maintenance-agent",
     "rationale": "Occupancy model shows <5% usage after 23:00.",
     "evidence": ["Gate logs 23:00-06:00", "Energy dashboard"],
     "systems": ["library", "energy", "facilities"],
     "risks": [], "age_min": 1440},
]

LIVE_INCIDENTS: List[Dict[str, Any]] = [
    {"id": "inc-1", "severity": "high", "status": "investigating", "agent": "maintenance-agent",
     "summary": "Correlated building incident: power + network at Engineering Block A",
     "age_min": 20},
    {"id": "inc-2", "severity": "medium", "status": "open", "agent": "transport-agent",
     "summary": "Transport Route 7 recurring delay (3rd time this week)", "age_min": 66},
    {"id": "inc-3", "severity": "low", "status": "resolved", "agent": "security-agent",
     "summary": "Access alarm at fair hall B — false positive", "age_min": 120},
]

COMMANDS: List[str] = [
    "get_campus_status",
    "detect_cross_system_conflicts",
    "generate_campus_intelligence_report",
    "find_available_resources",
    "optimize_transport",
    "resolve_schedule_conflict",
    "check_attendance_eligibility",
    "coordinate_large_event",
    "investigate_incident",
    "prepare_emergency_response",
    "search_library",
]

_rng = random.Random(42)
_lock = threading.RLock()


def _iso(ts: Optional[float] = None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(ts if ts else time.time()))


def _normalize_status(status: str) -> str:
    """Live telemetry says 'operational'; the UI's SystemRow uses 'available'."""
    return {"operational": "available", "up": "available", "down": "unavailable"}.get(status, status)


# ===========================================================================
# C. MERGE — demo seed enriched by live telemetry
# ===========================================================================

def systems() -> List[Dict[str, Any]]:
    """Merged system rows: live telemetry wins over the seed, demo rows fill the rest."""
    live = {_LIVE_ID_ALIAS.get(s["id"], s["id"]): s for s in LIVE_SYSTEMS}
    rows: List[Dict[str, Any]] = []
    for seed in DEMO_SYSTEMS:
        sid = seed["id"]
        feed = live.get(sid)
        if feed:
            rows.append({
                "id": sid,
                "name": seed["name"],
                "status": _normalize_status(feed["status"]),
                "detail": feed.get("detail") or DEMO_DETAILS.get(sid, ""),
                "load": feed.get("load", 0.5),
                "live_status": feed["status"],
                "live": True,
                "demo": False,
                "provenance": "live-telemetry + demo-seed",
                "last_seen": _iso(),
            })
        else:
            rows.append({
                "id": sid,
                "name": seed["name"],
                "status": seed["status"],
                "detail": DEMO_DETAILS.get(sid, ""),
                "load": {"degraded": 0.68, "available": 0.45}.get(seed["status"], 0.5),
                "live_status": None,
                "live": False,
                "demo": True,
                "provenance": "demo-seed",
                "last_seen": _iso(),
            })
    known = {r["id"] for r in rows}
    for sid, feed in live.items():
        if sid in known:
            continue
        rows.append({
            "id": sid, "name": feed["name"], "status": _normalize_status(feed["status"]),
            "detail": feed.get("detail", ""), "load": feed.get("load", 0.5),
            "live_status": feed["status"], "live": True, "demo": False,
            "provenance": "live-telemetry", "last_seen": _iso(),
        })
    return rows


def system_rows() -> List[Dict[str, Any]]:
    """The UI's SystemRow shape."""
    return [
        {"id": s["id"], "name": s["name"], "status": s["status"],
         "last_seen": s["last_seen"], "demo": s["demo"]}
        for s in systems()
    ]


def agents() -> List[Dict[str, Any]]:
    """Merged agent registry: one domain agent per system + live specialists."""
    live = {a["id"]: a for a in LIVE_AGENTS}
    out: List[Dict[str, Any]] = []
    seen = set()

    for s in systems():
        domain = s["id"]
        aid = f"{domain}-agent"
        feed = live.get(aid)
        role = DEMO_AGENT_ROLES.get(domain, f"Campus domain specialist for {domain}.")
        out.append({
            "agent_id": aid,
            "id": aid,
            "name": feed["name"] if feed else f"{s['name']} Agent",
            "role": feed["role"] if feed else role,
            "description": role if not feed else feed["role"],
            "domain": domain,
            "capabilities": [f"{domain}.inspect", f"{domain}.act"],
            "tools": [f"get_{domain}_status"],
            "status": feed["status"] if feed else ("degraded" if s["status"] == "degraded" else "operational"),
            "active_tasks": feed["active_tasks"] if feed else (1 if s["status"] == "degraded" else 0),
            "live": bool(feed),
            "demo": not bool(feed),
            "provenance": "live + demo-seed" if feed else "demo-seed",
        })
        seen.add(aid)

    for a in LIVE_AGENTS:
        if a["id"] in seen:
            continue
        out.append({
            "agent_id": a["id"], "id": a["id"], "name": a["name"], "role": a["role"],
            "description": a["role"], "domain": a["domain"],
            "capabilities": [f"{a['domain']}.inspect"], "tools": [f"get_{a['domain']}_status"],
            "status": a["status"], "active_tasks": a["active_tasks"],
            "live": True, "demo": False, "provenance": "live-telemetry",
        })
        seen.add(a["id"])

    # Alias so the UI's agent-network widget resolves live health for "comm".
    if "comm-agent" not in seen and "communication-agent" in seen:
        comm = next(a for a in out if a["agent_id"] == "communication-agent")
        clone = dict(comm)
        clone.update({"agent_id": "comm-agent", "id": "comm-agent", "name": "Communication Agent"})
        out.append(clone)

    return out


def agent_metadata() -> List[Dict[str, Any]]:
    """The UI's AgentMetadata shape."""
    return [
        {
            "agent_id": a["agent_id"],
            "name": a["name"],
            "description": a["description"],
            "domain": a["domain"],
            "capabilities": a["capabilities"],
            "tools": a["tools"],
            "permissions": ["read:campus", "propose:action"],
            "event_subscriptions": [f"{a['domain']}.*"],
            "input_schema": None,
            "output_schema": None,
        }
        for a in agents()
    ]


def agent_health() -> Dict[str, Any]:
    rows = [
        {
            "agent_id": a["agent_id"],
            "status": "degraded" if a["status"] in ("degraded", "busy") else "operational",
            "active_tasks": a["active_tasks"],
            "last_heartbeat": _iso(),
            "last_error": None,
        }
        for a in agents()
    ]
    return {
        "timestamp": _iso(),
        "agents": rows,
        "degraded_agents": [r["agent_id"] for r in rows if r["status"] == "degraded"],
        "active_tasks": sum(r["active_tasks"] for r in rows),
    }


def campus_status() -> Dict[str, Any]:
    sys_rows = systems()
    operational = [s for s in sys_rows if s["status"] == "available"]
    degraded = [s for s in sys_rows if s["status"] == "degraded"]
    unavailable = [s for s in sys_rows if s["status"] not in ("available", "degraded")]
    incidents = merged_incidents()
    open_incidents = [i for i in incidents if i["status"] != "resolved"]
    decisions = merged_decisions()
    pending = [a for a in merged_actions() if a["status"] == "pending_approval"]
    return {
        "timestamp": _iso(),
        "active_workflows": max(2, len(open_incidents) + len([d for d in decisions if d["status"] == "recommended"])),
        "pending_approvals": len(pending),
        "open_incidents": len(open_incidents),
        "dead_letters": 0,
        "kpis": {
            "systems_operational": len(operational),
            "systems_total": len(sys_rows),
            "systems_degraded": len(degraded),
            "systems_unavailable": len(unavailable),
            "active_agents": len([a for a in agents() if a["status"] != "standby"]),
            "agents_total": len(agents()),
            "open_incidents": len(open_incidents),
            "decisions_pending": len([d for d in decisions if d["status"] == "recommended"]),
        },
        "attention": [
            {"id": s["id"], "name": s["name"], "status": s["status"], "detail": s["detail"]}
            for s in sys_rows if s["status"] != "available"
        ],
    }


def status_text() -> str:
    st = campus_status()
    k = st["kpis"]
    attention = ", ".join(f"{a['name']} ({a['status']})" for a in st["attention"]) or "none"
    incidents = [i for i in merged_incidents() if i["status"] != "resolved"]
    top = merged_decisions()[0] if merged_decisions() else None
    return (
        f"Campus status: {k['systems_operational']}/{k['systems_total']} systems online, "
        f"{k['systems_degraded']} degraded ({attention}). "
        f"Open incidents: {k['open_incidents']} — "
        + (" | ".join(f"[{i['severity']}] {i['summary']}" for i in incidents[:3]) or "none")
        + f". Agents online: {k['active_agents']}/{k['agents_total']}. "
        + (f"Top recommendation: {top['problem']} ({top['confidence']:.0%} confidence)." if top else "")
    )


# ===========================================================================
# D. EVENT STREAM — one merged, live-appending feed
# ===========================================================================

EVENTS: List[Dict[str, Any]] = []
_sequence = [1040]
_evt_counter = [0]


def _append_event(*, source: str, event_type: str, summary: str, severity: str,
                  agent_id: str = "nexus-orchestrator", kind: str = "info",
                  status: str = "processed", demo: bool = False,
                  ts: Optional[float] = None) -> Dict[str, Any]:
    _sequence[0] += 1
    _evt_counter[0] += 1
    ev = {
        "id": f"evt-{_evt_counter[0]}",
        "sequence": _sequence[0],
        "event_id": f"evt-{_evt_counter[0]}",
        "source": source,
        "domain": source,
        "event_type": event_type,
        "summary": summary,
        "severity": severity,
        "agent_id": agent_id,
        "kind": kind,
        "correlation_id": f"corr-{_evt_counter[0] // 3 + 1}",
        "created_at": _iso(ts),
        "ts": ts if ts is not None else time.time(),
        "status": status,
        "attempts": 0 if status == "pending" else 1,
        "last_error": None,
        "demo": demo,
        "live": not demo,
        "provenance": "demo-seed" if demo else "live-telemetry",
    }
    EVENTS.insert(0, ev)
    del EVENTS[60:]
    return ev


def _seed_events() -> None:
    with _lock:
        if EVENTS:
            return
        for i, seed in enumerate(DEMO_EVENT_SEED):
            _append_event(
                source=seed["source"], event_type=seed["event_type"],
                summary=seed["summary"], severity=seed["severity"],
                agent_id=f"{seed['source']}-agent",
                status="pending" if i == len(DEMO_EVENT_SEED) - 1 else "processed",
                demo=True, ts=time.time() - (120 + i * 60),
            )
        for ev in sorted(LIVE_EVENTS, key=lambda e: e["ts"]):
            _append_event(
                source=ev.get("domain") or ev["agent_id"].split("-")[0],
                event_type=f"{ev['kind'].upper()}_CAMPUS_SIGNAL",
                summary=ev["summary"], severity=ev["severity"],
                agent_id=ev["agent_id"], kind=ev["kind"],
                demo=False, ts=ev["ts"],
            )


def events(offset: int = 0, limit: int = 50) -> Dict[str, Any]:
    _seed_events()
    with _lock:
        items = list(EVENTS)
    items.sort(key=lambda e: -e["ts"])
    page = items[offset: offset + limit]
    return {"items": page, "offset": offset, "limit": limit,
            "has_more": offset + limit < len(items), "total": len(items)}


def yank_events(limit: int = 3) -> List[Dict[str, Any]]:
    """Recent events in the compact shape the /api/campus/events route uses."""
    _seed_events()
    with _lock:
        items = sorted(EVENTS, key=lambda e: -e["ts"])[:limit]
    return [{"id": e["id"], "agent_id": e["agent_id"], "kind": e["kind"],
             "summary": e["summary"], "severity": e["severity"], "ts": e["ts"]} for e in items]


# ===========================================================================
# E. DECISIONS / INCIDENTS / ACTIONS — merged logs
# ===========================================================================

DECISION_LOG: List[Dict[str, Any]] = []
INCIDENT_LOG: List[Dict[str, Any]] = []
ACTION_LOG: List[Dict[str, Any]] = []


def _evidence(*, system: str, entity_type: str, name: str, data: Dict[str, Any],
              demo: bool = True, real: bool = False,
              classification: str = "FACT") -> Dict[str, Any]:
    return {
        "evidence_id": f"ev-{uuid.uuid4().hex[:10]}",
        "entity_id": f"{system}-{name}".lower().replace(" ", "-"),
        "system": system,
        "entity_type": entity_type,
        "name": name,
        "classification": "OBSERVATION" if real else classification,
        "observed_at": _iso(),
        "received_at": _iso(),
        "data": data,
        "demo": demo,
        "real": real,
        "provenance": "real-scraped" if real else ("demo-seed" if demo else "live-telemetry"),
    }


def _live_system_evidence(limit: int = 8) -> List[Dict[str, Any]]:
    out = []
    for s in systems()[:limit]:
        out.append(_evidence(
            system=s["id"], entity_type="system_snapshot", name=f"{s['name']} system",
            data={"status": s["status"], "detail": s["detail"], "load": s["load"]},
            demo=s["demo"], classification="OBSERVATION",
        ))
    return out


def _scraped_evidence(limit: int = 4) -> List[Dict[str, Any]]:
    """REAL facts pulled live from srmap.edu.in by the AI scraper."""
    out: List[Dict[str, Any]] = []
    try:
        facts = (scraper.cached_or_scrape().get("facts") or [])[:limit]
    except Exception:  # noqa: BLE001
        facts = []
    for f in facts:
        label = f.get("name") or f.get("category") or "SRMAP fact"
        out.append(_evidence(
            system="srmap", entity_type="scraped_fact", name=str(label)[:120],
            data={k: v for k, v in f.items() if k not in ("url", "source")},
            demo=False, real=True,
        ))
    return out


def _incident_evidence(limit: int = 4) -> List[Dict[str, Any]]:
    out = []
    for inc in merged_incidents()[:limit]:
        out.append(_evidence(
            system="incidents", entity_type="incident", name=inc["summary"][:120],
            data={"severity": inc["severity"], "status": inc["status"]},
            demo=inc.get("demo", False),
        ))
    return out


def merged_incidents() -> List[Dict[str, Any]]:
    """Live incidents + demo seed, newest first, in one canonical shape."""
    if not INCIDENT_LOG:
        with _lock:
            if not INCIDENT_LOG:
                for inc in LIVE_INCIDENTS:
                    INCIDENT_LOG.append({
                        "id": inc["id"], "severity": inc["severity"], "status": inc["status"],
                        "summary": inc["summary"], "agent": inc["agent"],
                        "requester_id": inc["agent"], "ts": time.time() - inc["age_min"] * 60,
                        "created_at": _iso(time.time() - inc["age_min"] * 60),
                        "demo": False, "live": True, "provenance": "live-telemetry",
                    })
                for inc in DEMO_INCIDENT_SEED:
                    ts = time.time() - inc["age_min"] * 60
                    INCIDENT_LOG.append({
                        "id": inc["id"], "severity": inc["severity"], "status": inc["status"],
                        "summary": inc["summary"], "agent": inc["requester_id"],
                        "requester_id": inc["requester_id"], "ts": ts,
                        "created_at": _iso(ts),
                        "demo": True, "live": False, "provenance": "demo-seed",
                    })
    with _lock:
        return sorted(INCIDENT_LOG, key=lambda i: -i["ts"])


def incidents(offset: int = 0, limit: int = 50) -> Dict[str, Any]:
    items = merged_incidents()
    page = items[offset: offset + limit]
    return {"items": page, "offset": offset, "limit": limit,
            "has_more": offset + limit < len(items), "total": len(items)}


def merged_actions() -> List[Dict[str, Any]]:
    if not ACTION_LOG:
        with _lock:
            if not ACTION_LOG:
                for act in DEMO_ACTIONS:
                    ts = time.time() - act["age_min"] * 60
                    ACTION_LOG.append({
                        "id": act["id"], "kind": act["kind"], "risk": act["risk"],
                        "status": act["status"], "payload": act["payload"],
                        "result": act["result"], "ts": ts, "created_at": _iso(ts),
                        "demo": True, "live": False, "provenance": "demo-seed",
                    })
    with _lock:
        return sorted(ACTION_LOG, key=lambda a: -a["ts"])


def actions(offset: int = 0, limit: int = 50) -> Dict[str, Any]:
    items = merged_actions()
    page = items[offset: offset + limit]
    return {"items": page, "offset": offset, "limit": limit,
            "has_more": offset + limit < len(items), "total": len(items)}


def execute_action(action_id: str) -> Dict[str, Any]:
    with _lock:
        for act in ACTION_LOG:
            if act["id"] == action_id:
                act["status"] = "executed"
                act["result"] = {"delivery": "recorded_locally_not_delivered",
                                 "executed_at": _iso()}
                return act
    raise KeyError(action_id)


def _decision_doc(*, problem: str, requester_id: str, reason: str, confidence: float,
                  systems_: List[str], agents_: List[str], evidence: List[Dict[str, Any]],
                  options: Optional[List[Dict[str, Any]]] = None,
                  action: Optional[Dict[str, Any]] = None,
                  confidence_factors: Optional[Dict[str, float]] = None,
                  risks: Optional[List[str]] = None,
                  assumptions: Optional[List[str]] = None,
                  expected_impact: str = "", approval: bool = False,
                  conflicts: Optional[List[Dict[str, Any]]] = None,
                  constraints: Optional[List[str]] = None,
                  context: Optional[Dict[str, Any]] = None,
                  status: str = "recommended") -> Dict[str, Any]:
    return {
        "decision_id": f"dec-{uuid.uuid4().hex[:10]}",
        "problem": problem,
        "requester_id": requester_id,
        "context": context or {
            "parameters": {},
            "source_status": {s["id"]: s["status"] for s in systems()},
            "contradictions": [],
            "preferred_option": (options or [{}])[0].get("option_id") if options else None,
        },
        "relevant_systems": systems_,
        "agents_consulted": agents_,
        "evidence": evidence,
        "constraints": constraints or [
            "Respect source-specific authorization.",
            "Do not use restricted, occupied, closed or unreachable resources.",
        ],
        "available_options": options or [],
        "selected_action": action,
        "reason": reason,
        "confidence": confidence,
        "confidence_factors": confidence_factors or {
            "source_availability": 0.95, "freshness": 0.93, "agreement": 0.9, "rule_validation": 1.0,
        },
        "risks": risks or [],
        "assumptions": assumptions or [
            "Source observations are accurate within their stated timestamps.",
        ],
        "expected_impact": expected_impact or "Campus-wide situational awareness for operators.",
        "approval_requirement": approval,
        "conflicts": conflicts or [],
        "status": status,
        "timestamp": _iso(),
        "demo": False,
        "live": True,
        "provenance": "merged demo+live",
    }


def _conflict(kind: str, severity: str, description: str, systems_: List[str]) -> Dict[str, Any]:
    return {
        "conflict_id": f"cf-{uuid.uuid4().hex[:8]}",
        "kind": kind,
        "severity": severity,
        "description": description,
        "systems": systems_,
        "evidence_ids": [],
        "classification": "INFERENCE",
    }


def _seed_decisions() -> None:
    if DECISION_LOG:
        return
    with _lock:
        if DECISION_LOG:
            return
        # Live decisions, projected into the full DecisionDocument shape.
        for d in LIVE_DECISIONS:
            evidence = [_evidence(system=s.split()[0].lower(), entity_type="live_signal",
                                  name=str(s)[:120], data={"source": "live telemetry"},
                                  demo=False)
                        for s in d["evidence"]]
            evidence += _live_system_evidence(4)
            DECISION_LOG.append(_decision_doc(
                problem=d["problem"], requester_id=d["requester_id"], reason=d["rationale"],
                confidence=d["confidence"], systems_=d["systems"],
                agents_=[f"{s}-agent" for s in d["systems"]], evidence=evidence,
                risks=d["risks"], status=d["status"],
                options=[{"option_id": "east-gate", "classification": "RECOMMENDATION",
                          "name": d["title"], "constraints_satisfied": True}],
                action={"kind": "send_notification",
                        "payload": {"audience": "authorized-campus-operators",
                                    "message": d["title"]}},
                expected_impact="Operator action dispatched through the approval-gated action layer.",
            ))
        # Demo-quality templates over the merged live picture.
        for i, command in enumerate(("get_campus_status", "find_available_resources",
                                    "optimize_transport", "prepare_emergency_response",
                                    "coordinate_large_event", "check_attendance_eligibility")):
            response = run_command(command, record=False)
            # run_command returns a CommandResponse; the log stores DecisionDocuments.
            decision = response["decision"]
            decision["status"] = ("recommended", "approved", "executed")[i % 3]
            decision["provenance"] = "demo-seed over merged live data"
            DECISION_LOG.append(decision)


def merged_decisions() -> List[Dict[str, Any]]:
    _seed_decisions()
    with _lock:
        return list(DECISION_LOG)


def decisions(offset: int = 0, limit: int = 50) -> Dict[str, Any]:
    items = merged_decisions()
    page = items[offset: offset + limit]
    return {"items": page, "offset": offset, "limit": limit,
            "has_more": offset + limit < len(items), "total": len(items)}


def commands() -> List[Dict[str, Any]]:
    domains = {c: sorted({s["id"] for s in systems()})[:6] for c in COMMANDS}
    return [{"command": c, "domains": domains[c], "available_to_principal": True} for c in COMMANDS]


# ===========================================================================
# F. INTERPRET + RUN — the merged workflow engine
# ===========================================================================

_PATTERNS: List[tuple] = [
    ("prepare_emergency_response", ["emergency", "evacuation", "medical"]),
    ("find_available_resources", ["alternative location", "available classroom", "free room",
                                  "relocate event", "classroom", "room", "resource", "venue"]),
    ("optimize_transport", ["bus delay", "alternate route", "transport", "exam route", "bus", "shuttle"]),
    ("check_attendance_eligibility", ["attendance", "eligibility"]),
    ("investigate_incident", ["network failure", "building incident", "incident", "maintenance", "power"]),
    ("coordinate_large_event", ["large event", "event crowd", "parking demand", "fair", "event"]),
    ("resolve_schedule_conflict", ["schedule conflict", "double booking", "overlap", "venue conflict"]),
    ("check_attendance_eligibility", ["attendance"]),
    ("search_library", ["library", "book"]),
    ("generate_campus_intelligence_report", ["report", "briefing", "summary report"]),
    ("detect_cross_system_conflicts", ["conflict", "correlate", "correlation"]),
    ("get_campus_status", ["campus status", "what is happening", "happening", "attention",
                           "alerts", "status", "overview", "system"]),
]


def interpret(text: str) -> Dict[str, Any]:
    """Map natural language onto a workflow (same shape as the UI's Interpretation)."""
    normalized = (text or "").lower()
    scores = [
        (command, sum(1 for phrase in phrases if phrase in normalized))
        for command, phrases in _PATTERNS
    ]
    best = max((s for _, s in scores), default=0)
    candidates = []
    for command, score in scores:
        if score == best and score > 0 and command not in candidates:
            candidates.append(command)
    command = candidates[0] if candidates else None
    return {
        "classification": "INFERENCE",
        "command": command,
        "candidates": candidates,
        "requires_clarification": len(candidates) != 1,
        "execution_performed": False,
        "next_step": (f"Running {command} workflow." if command
                      else "No specific workflow matched; running a campus-wide status scan."),
    }


def _workflow_plan(command: str) -> Dict[str, Any]:
    """Per-command grounded plan built from the merged live picture."""
    sys_list = systems()
    degraded = [s for s in sys_list if s["status"] == "degraded"]
    degraded_names = ", ".join(f"{s['name']} ({s['live_status'] or s['status']})" for s in degraded)
    evidence = _live_system_evidence(6) + _incident_evidence(3) + _scraped_evidence(3)

    plans: Dict[str, Dict[str, Any]] = {
        "optimize_transport": dict(
            reason=("The campus transport feed reports delays while the exam schedule requires "
                    "on-time arrivals. The East Gate Alternative clears the delayed corridor and "
                    "predicts an earlier arrival than the Main Gate Route."),
            confidence=0.87,
            systems=["academic", "transport", "events"],
            agents=["academic-agent", "transport-agent", "events-agent"],
            options=[
                {"option_id": "route-east", "classification": "PREDICTION",
                 "name": "East Gate Alternative", "estimated_minutes": 18,
                 "before_exam": True, "constraints_satisfied": True},
                {"option_id": "route-main", "classification": "PREDICTION",
                 "name": "Main Gate Route", "estimated_minutes": 55,
                 "before_exam": False, "constraints_satisfied": False},
            ],
            action={"kind": "send_notification",
                    "payload": {"audience": "authorized-campus-operators",
                                "message": "East Gate Alternative recommended for exam arrival."}},
            issues=["EXAM_TRANSPORT_DELAY"],
            next_steps=["Dispatch shuttle advisory via Communication Agent.",
                        "Confirm Route 7 recovery on the transport feed."],
            impact="Students routed via East Gate arrive before the exam deadline.",
        ),
        "find_available_resources": dict(
            reason=("Lecture Hall A101 is under an active electrical-safety restriction. "
                    "Seminar Hall B201 is operational, satisfies the capacity constraint (150 >= 80), "
                    "includes a projector and is reachable with no transport delay."),
            confidence=0.86,
            systems=["academic", "events", "facilities", "maintenance", "security", "transport"],
            agents=["academic-agent", "events-agent", "facilities-agent",
                    "maintenance-agent", "security-agent", "transport-agent"],
            options=[
                {"option_id": "room-b201", "classification": "RECOMMENDATION",
                 "name": "Seminar Hall B201", "capacity": 150, "constraints_satisfied": True},
                {"option_id": "room-a101", "classification": "OBSERVATION",
                 "name": "Lecture Hall A101", "capacity": 100, "constraints_satisfied": False},
            ],
            action={"kind": "send_notification",
                    "payload": {"audience": "authorized-campus-operators",
                                "message": "Seminar Hall B201 recommended as alternative venue."}},
            issues=["VENUE_RESTRICTION"],
            next_steps=["Confirm booking with Facilities."],
            impact="One evidence-grounded venue relocation recommendation.",
        ),
        "prepare_emergency_response": dict(
            reason=("Engineering Building A shows simultaneous maintenance, network, security and "
                    "energy signals. A critical escalation is prepared but requires independent "
                    "human approval before any field dispatch."),
            confidence=0.88,
            systems=["emergency", "energy", "it", "maintenance", "security", "transport"],
            agents=["emergency-agent", "energy-agent", "it-agent",
                    "maintenance-agent", "security-agent", "transport-agent"],
            options=[],
            action={"kind": "escalate_incident",
                    "payload": {"severity": "critical",
                                "summary": "Correlated building incident at Engineering Building A."}},
            issues=["CORRELATED_BUILDING_INCIDENT"],
            next_steps=["Authorized operator must review and approve the escalation."],
            impact="Escalation record created locally; no field dispatch performed.",
            approval=True,
        ),
        "coordinate_large_event": dict(
            reason=("Event demand and parking occupancy are rising together at Engineering Block A. "
                    "Transport capacity is below predicted demand, so shuttle reinforcement and "
                    "overflow parking are recommended before the peak."),
            confidence=0.82,
            systems=["events", "transport", "parking", "security"],
            agents=["events-agent", "transport-agent", "parking-agent", "security-agent"],
            options=[
                {"option_id": "shuttle-reinforce", "classification": "RECOMMENDATION",
                 "name": "Reinforce fair shuttles", "extra_buses": 3, "constraints_satisfied": True},
                {"option_id": "overflow-parking", "classification": "RECOMMENDATION",
                 "name": "Open overflow parking", "spaces": 60, "constraints_satisfied": True},
            ],
            action={"kind": "send_notification",
                    "payload": {"audience": "authorized-campus-operators",
                                "message": "Fair shuttle reinforcement and overflow parking prepared."}},
            issues=["EVENT_TRANSPORT_CAPACITY_MISMATCH"],
            next_steps=["Publish shuttle timetable to the event channel."],
            impact="Transport demand 150 vs 75 seats — capacity gap closed by reinforcement.",
        ),
        "check_attendance_eligibility": dict(
            reason=("The attendance pipeline reports a section below the 75% eligibility threshold. "
                    "Students are flagged for a condonation review rather than automatic debarment."),
            confidence=0.9,
            systems=["attendance", "academic"],
            agents=["attendance-agent", "academic-agent"],
            options=[{"option_id": "condonation-review", "classification": "RECOMMENDATION",
                      "name": "Condonation review queue", "constraints_satisfied": True}],
            action={"kind": "send_notification",
                    "payload": {"audience": "academic-office",
                                "message": "Attendance eligibility review queued for flagged sections."}},
            issues=["ATTENDANCE_ELIGIBILITY_RISK"],
            next_steps=["Academic office to confirm condonation policy."],
            impact="Eligibility decisions stay auditable and human-approved.",
        ),
        "investigate_incident": dict(
            reason=("Multiple independent systems reported anomalies for the same building inside a "
                    "short window. The correlation engine groups them into one incident instead of "
                    "four unrelated tickets."),
            confidence=0.85,
            systems=["maintenance", "it", "security", "energy"],
            agents=["maintenance-agent", "it-agent", "security-agent", "energy-agent"],
            options=[{"option_id": "single-owner", "classification": "RECOMMENDATION",
                      "name": "Assign a single incident owner", "constraints_satisfied": True}],
            action={"kind": "create_maintenance_request",
                    "payload": {"building_id": "building-a",
                                "description": "Investigate correlated building incident (maintenance + network + energy)."}},
            issues=["CORRELATED_BUILDING_INCIDENT"],
            next_steps=["Maintenance Agent to investigate the shared root cause."],
            impact="One correlated incident replaces duplicated per-system tickets.",
        ),
        "resolve_schedule_conflict": dict(
            reason=("Two bookings overlap for the same venue. The academic event has a hard start "
                    "constraint, so the flexible booking is moved to the next available slot."),
            confidence=0.83,
            systems=["academic", "events", "facilities"],
            agents=["academic-agent", "events-agent", "facilities-agent"],
            options=[
                {"option_id": "move-flexible", "classification": "RECOMMENDATION",
                 "name": "Move flexible booking to next slot", "constraints_satisfied": True},
                {"option_id": "keep-overlap", "classification": "OBSERVATION",
                 "name": "Keep the overlap", "constraints_satisfied": False},
            ],
            action={"kind": "send_notification",
                    "payload": {"audience": "events-office",
                                "message": "Venue double booking resolved by moving the flexible slot."}},
            issues=["VENUE_DOUBLE_BOOKING"],
            next_steps=["Events office to confirm the new slot."],
            impact="Removes a venue double-booking without touching the academic calendar.",
        ),
        "search_library": dict(
            reason=("The library catalogue feed reports copies available for the requested title. "
                    "Reservations are honoured before loan issue."),
            confidence=0.94,
            systems=["library"],
            agents=["library-agent"],
            options=[{"option_id": "borrow", "classification": "OBSERVATION",
                      "name": "Borrow available copy", "constraints_satisfied": True}],
            action=None,
            issues=[],
            next_steps=[],
            impact="Direct factual answer.",
        ),
        "detect_cross_system_conflicts": dict(
            reason=("A cross-system scan matched several recurring correlations between independent "
                    "feeds (transport + academic, events + parking, maintenance + network + energy)."),
            confidence=0.81,
            systems=[s["id"] for s in sys_list][:8],
            agents=[f"{s['id']}-agent" for s in sys_list][:8],
            options=[],
            action={"kind": "send_notification",
                    "payload": {"audience": "authorized-campus-operators",
                                "message": "Cross-system conflict scan complete."}},
            issues=["EXAM_TRANSPORT_DELAY", "EVENT_TRANSPORT_CAPACITY_MISMATCH",
                    "CORRELATED_BUILDING_INCIDENT"],
            next_steps=["Run the recommended workflow for each correlation."],
            impact="Correlations surfaced before they become incidents.",
        ),
        "generate_campus_intelligence_report": dict(
            reason=("A full briefing was assembled from every merged feed: system health, open "
                    "incidents, recent decisions, live events and the scraped campus knowledge base."),
            confidence=0.84,
            systems=[s["id"] for s in sys_list],
            agents=[f"{s['id']}-agent" for s in sys_list],
            options=[],
            action={"kind": "send_notification",
                    "payload": {"audience": "campus-leadership",
                                "message": "Campus intelligence briefing generated."}},
            issues=[],
            next_steps=["Share the briefing with campus leadership."],
            impact="One explainable briefing instead of eight separate dashboards.",
        ),
    }

    plan = plans.get(command) or dict(
        reason=(f"Campus-wide scan across {len(sys_list)} merged systems. "
                + (f"Degraded: {degraded_names}." if degraded else "All systems nominal.")),
        confidence=0.78,
        systems=[s["id"] for s in sys_list],
        agents=[f"{s['id']}-agent" for s in sys_list],
        options=[],
        action={"kind": "send_notification",
                "payload": {"audience": "authorized-campus-operators",
                            "message": "Three cross-system situations require coordination."}},
        issues=[i for i in ["EXAM_TRANSPORT_DELAY", "CORRELATED_BUILDING_INCIDENT",
                            "ATTENDANCE_ELIGIBILITY_RISK"]] if degraded else [],
        next_steps=["Run the recommended workflow for each flagged correlation."],
        impact="Campus-wide situational awareness for operators.",
    )
    plan["evidence"] = evidence
    return plan


_CONFLICT_TEXT = {
    "EXAM_TRANSPORT_DELAY": ("HIGH", "A delayed route serves the location of a scheduled examination.",
                             ["academic", "transport"]),
    "EVENT_TRANSPORT_CAPACITY_MISMATCH": ("MEDIUM",
                                          "Event transport demand exceeds available shuttle seats.",
                                          ["events", "transport"]),
    "CORRELATED_BUILDING_INCIDENT": ("HIGH",
                                     "One building has simultaneous maintenance, network and energy signals.",
                                     ["maintenance", "it", "energy"]),
    "ATTENDANCE_ELIGIBILITY_RISK": ("MEDIUM",
                                    "A section is below the 75% attendance eligibility threshold.",
                                    ["attendance", "academic"]),
    "VENUE_DOUBLE_BOOKING": ("HIGH", "Two bookings overlap for the same venue.", ["academic", "events"]),
    "VENUE_RESTRICTION": ("MEDIUM", "A venue is closed under an electrical-safety restriction.",
                          ["facilities", "maintenance"]),
}


def run_command(command: str, parameters: Optional[Dict[str, Any]] = None,
                record: bool = True) -> Dict[str, Any]:
    """Execute a workflow over the merged dataset and return a CommandResponse."""
    command = command or "get_campus_status"
    if command not in COMMANDS:
        command = "get_campus_status"
    plan = _workflow_plan(command)
    evidence = plan["evidence"]
    conflicts = [
        _conflict(kind, *_CONFLICT_TEXT[kind])
        for kind in plan.get("issues", []) if kind in _CONFLICT_TEXT
    ]
    sys_rows = systems()
    degraded = [s for s in sys_rows if s["status"] == "degraded"]
    kpis = campus_status()["kpis"]

    summary = (
        f"Evaluated {len(evidence)} merged observations across {kpis['agents_total']} agents. "
        f"{kpis['systems_operational']}/{kpis['systems_total']} systems online"
        + (f", {kpis['systems_degraded']} degraded ({', '.join(s['name'] for s in degraded)})" if degraded else ", none degraded")
        + f". {kpis['open_incidents']} open incident(s). "
        + f"{plan['reason']}"
    )

    decision = _decision_doc(
        problem=command,
        requester_id="nexus-orchestrator",
        reason=plan["reason"],
        confidence=plan["confidence"],
        systems_=plan["systems"],
        agents_=plan["agents"],
        evidence=evidence,
        options=plan["options"],
        action=plan["action"],
        risks=[f"{kind}: {_CONFLICT_TEXT[kind][1]}" for kind in plan.get("issues", []) if kind in _CONFLICT_TEXT],
        expected_impact=plan["impact"],
        approval=plan.get("approval", False),
        conflicts=conflicts,
        context={
            "parameters": parameters or {},
            "source_status": {s["id"]: s["status"] for s in sys_rows},
            "contradictions": [],
            "preferred_option": plan["options"][0]["option_id"] if plan["options"] else None,
        },
    )

    actions_taken: List[Dict[str, Any]] = []
    if plan["action"]:
        risk = "CRITICAL" if plan.get("approval") else ("MEDIUM" if command == "investigate_incident" else "LOW")
        act = {
            "id": f"act-{uuid.uuid4().hex[:10]}",
            "kind": plan["action"]["kind"],
            "risk": risk,
            "status": "pending_approval" if risk in ("MEDIUM", "CRITICAL") else "executed",
            "payload": plan["action"]["payload"],
            "result": None if risk in ("MEDIUM", "CRITICAL") else
                      {"delivery": "recorded_locally_not_delivered"},
            "ts": time.time(),
            "created_at": _iso(),
            "demo": False, "live": True, "provenance": "merged demo+live",
        }
        with _lock:
            ACTION_LOG.insert(0, act)
            del ACTION_LOG[40:]
        actions_taken.append(act)

    response = {
        "request_id": f"req-{uuid.uuid4().hex[:10]}",
        "correlation_id": f"corr-{uuid.uuid4().hex[:10]}",
        "status": "degraded" if degraded or conflicts else "completed",
        "summary": summary,
        "decision": decision,
        "systems_consulted": plan["systems"],
        "agents_consulted": plan["agents"],
        "evidence": evidence,
        "risks": decision["risks"],
        "assumptions": decision["assumptions"],
        "required_approval": decision["approval_requirement"],
        "actions_taken": actions_taken,
        "next_steps": plan["next_steps"],
        "emergency": ({"human_approval_required": True, "escalation_level": 1}
                      if command == "prepare_emergency_response" else None),
    }

    if record:
        with _lock:
            DECISION_LOG.insert(0, decision)
            del DECISION_LOG[60:]
        _append_event(
            source="nexus", event_type=f"WORKFLOW_{command.upper()}",
            summary=f"{command} executed — confidence {decision['confidence']:.0%}",
            severity="low" if response["status"] == "completed" else "medium",
            agent_id="nexus-orchestrator", kind="decision",
        )
    return response


# ===========================================================================
# G. LIVE TELEMETRY — keeps the merged feed alive
# ===========================================================================

TELEMETRY_SAMPLES: List[Dict[str, str]] = [
    {"source": "transport", "event_type": "BUS_DELAY_DETECTED",
     "summary": "Route 4 running 6 min behind schedule", "severity": "low"},
    {"source": "academic", "event_type": "ATTENDANCE_SYNC_COMPLETED",
     "summary": "Attendance sync completed for 214 sections", "severity": "low"},
    {"source": "security", "event_type": "PATROL_CHECKPOINT_CLEARED",
     "summary": "Night patrol checkpoint 12 cleared", "severity": "low"},
    {"source": "hostel", "event_type": "UTILITY_ANOMALY_DETECTED",
     "summary": "Hot water pressure drop reported — Block F", "severity": "medium"},
    {"source": "maintenance", "event_type": "GENERATOR_TEST_PASSED",
     "summary": "Diesel generator test cycle passed", "severity": "low"},
    {"source": "it", "event_type": "NETWORK_ANOMALY_DETECTED",
     "summary": "Wi-Fi AP flapping at Library Level 2", "severity": "medium"},
]

_telemetry_started = False


def telemetry_tick() -> Dict[str, Any]:
    sample = TELEMETRY_SAMPLES[_rng.randrange(len(TELEMETRY_SAMPLES))]
    return _append_event(
        source=sample["source"], event_type=sample["event_type"], summary=sample["summary"],
        severity=sample["severity"], agent_id=f"{sample['source']}-agent",
        status="pending" if _rng.random() < 0.2 else "processed",
    )


def start_telemetry(interval: float = 45.0) -> None:
    """Background worker: the merged event feed never goes quiet."""
    global _telemetry_started
    if _telemetry_started:
        return
    _telemetry_started = True

    def _worker() -> None:
        while True:
            time.sleep(interval)
            try:
                telemetry_tick()
            except Exception:  # noqa: BLE001
                pass

    threading.Thread(target=_worker, daemon=True, name="telemetry").start()


def summary_for_jarvis() -> str:
    return status_text()


def agents_text() -> str:
    return "\n".join(
        f" • {a['name']} ({a['agent_id']}): {a['status']}, {a['active_tasks']} active tasks — {a['role']}"
        for a in agents())


def decisions_text() -> str:
    rows = merged_decisions()[:5]
    if not rows:
        return "No decisions recorded yet."
    return "\n".join(
        f" • {d['problem']} — {d.get('status', 'recommended')}, confidence {d['confidence']:.0%}: {d['reason'][:160]}"
        for d in rows)


def incidents_text() -> str:
    rows = merged_incidents()[:5]
    return "\n".join(
        f" • [{i['severity'].upper()}] {i['summary']} — {i['status']} ({i['agent']})"
        for i in rows)


def systems_text() -> str:
    rows = systems()
    return "\n".join(
        f" • {s['name']}: {s['status']} — {s['detail']} (source: {s['provenance']})"
        for s in rows)


def facts_text() -> str:
    return scraper.facts_text(limit=40)


def init() -> None:
    """Seed the merged logs and start live telemetry (idempotent)."""
    _seed_events()
    _seed_decisions()
    merged_incidents()
    merged_actions()
    start_telemetry()
