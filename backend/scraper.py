"""AI web scraper for SRM University AP (https://www.srmap.edu.in/).

Adapted from the SARA AI Nexus Hub scraping agent (sara-ai-platform/
backend/app/api/scraping_agent.py): fetch pages, strip noise, and let the
CleanApis Gemini-flash model extract structured campus facts. Results are
cached on disk so the campus knowledge base survives backend restarts.
"""
from __future__ import annotations

import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Comment

import llm

BASE_URL = "https://www.srmap.edu.in/"
CACHE_FILE = Path(__file__).resolve().parent / "srmap_cache.json"
CACHE_TTL = 6 * 3600  # refresh at most every 6 hours

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 NEXUSScrapeAgent/1.0"
    )
}

# Pages most likely to hold useful campus facts
SEED_PATHS = [
    "",                      # home
    "about-us/",
    "academics/",
    "schools-of-study/",
    "admissions/",
    "admissions/fees/",
    "campus-life/",
    "placements/",
    "news-events/",
    "contact-us/",
]

_fetch_lock = threading.Lock()
_cache_lock = threading.Lock()
_session = requests.Session()
_session.headers.update(HEADERS)


def _same_host(url: str) -> bool:
    try:
        return urlparse(url).netloc.endswith("srmap.edu.in")
    except Exception:  # noqa: BLE001
        return False


def fetch(url: str, timeout: float = 20.0) -> Optional[str]:
    try:
        r = _session.get(url, timeout=timeout)
        if r.status_code != 200 or len(r.text) < 200:
            return None
        return r.text
    except Exception:  # noqa: BLE001
        return None


def html_to_text(html: str) -> str:
    """Readable visible text with light structure markers (small, LLM-friendly)."""
    soup = BeautifulSoup(html, "html.parser")
    for node in soup(["script", "style", "noscript", "svg", "template", "iframe", "head"]):
        node.decompose()
    for comment in soup.find_all(string=lambda s: isinstance(s, Comment)):
        comment.extract()
    lines: List[str] = []
    title = soup.find("title")
    if title and title.get_text(strip=True):
        lines.append(f"PAGE TITLE: {title.get_text(strip=True)}")
    for el in soup.find_all(["h1", "h2", "h3", "h4", "p", "li", "td", "th"]):
        text = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
        if not text:
            continue
        if el.name in ("h1", "h2", "h3", "h4"):
            lines.append(f"[{text}]")
        elif el.name == "li":
            lines.append(f"- {text}")
        else:
            lines.append(text)
    out: List[str] = []
    prev = None
    for line in lines:
        if line == prev:
            continue
        out.append(line)
        prev = line
    return "\n".join(out)


EXTRACT_SYSTEM = (
    "You extract structured facts about SRM University AP from the visible text of "
    "one of its web pages. Extract ONLY data present in the text — never invent. "
    'Respond with STRICT JSON only, shape: {"items": [{...}, ...]} where each item '
    "is one fact/record with short string fields such as name, category, detail, url. "
    "Return an empty items array if the page has nothing useful."
)


def extract_page(url: str, html: str) -> List[Dict[str, Any]]:
    text = html_to_text(html)[:50_000]
    if len(text) < 300:
        return []
    try:
        reply = llm.chat_text(
            [
                {"role": "system", "content": EXTRACT_SYSTEM},
                {"role": "user", "content": f"Page url: {url}\n\nPage content:\n\n{text}"},
            ],
            temperature=0.0,
            max_tokens=2000,
            timeout=180,
        )
    except Exception:  # noqa: BLE001
        return []
    data = llm.extract_json(reply)
    if isinstance(data, dict):
        items = data.get("items") or []
    elif isinstance(data, list):
        items = data
    else:
        return []
    out = []
    for it in items:
        if isinstance(it, dict) and it:
            it.setdefault("url", url)
            it.setdefault("source", "srmap.edu.in (AI scraper)")
            out.append({str(k)[:40]: str(v)[:400] for k, v in it.items() if v})
    return out


def _discover_links(home_html: str, limit: int = 14) -> List[str]:
    """Pull a few interesting same-site links off the homepage."""
    soup = BeautifulSoup(home_html, "html.parser")
    seen, links = set(), []
    for a in soup.find_all("a", href=True):
        href = urljoin(BASE_URL, a["href"]).split("#")[0].rstrip("/") + "/"
        if not _same_host(href) or href in seen:
            continue
        text = a.get_text(strip=True).lower()
        if any(k in href.lower() or k in text for k in
               ("school", "program", "admission", "research", "campus", "placement", "event")):
            seen.add(href)
            links.append(href)
        if len(links) >= limit:
            break
    return links


def scrape_all(max_pages: int = 10, force: bool = False) -> Dict[str, Any]:
    """Crawl srmap.edu.in and LLM-extract facts. Cached to disk with a TTL."""
    with _cache_lock:
        if not force and CACHE_FILE.exists():
            try:
                cached = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
                if time.time() - cached.get("ts", 0) < CACHE_TTL:
                    return cached
            except Exception:  # noqa: BLE001
                pass

    urls: List[str] = []
    home_html = fetch(BASE_URL)
    if home_html:
        urls.append(BASE_URL)
        urls.extend(_discover_links(home_html)[: max(4, max_pages // 2)])
    for p in SEED_PATHS:
        u = urljoin(BASE_URL, p)
        if u not in urls:
            urls.append(u)
    urls = urls[:max_pages]

    results: Dict[str, Any] = {
        "ts": time.time(),
        "url": BASE_URL,
        "pages_scraped": 0,
        "pages_failed": 0,
        "facts": [],
        "status": "ok",
        "scraped_at": time.strftime("%Y-%m-%d %H:%M"),
    }

    def work(u: str):
        html = fetch(u)
        if not html:
            return u, None
        return u, extract_page(u, html)

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(work, u) for u in urls]
        for fut in as_completed(futures):
            u, items = fut.result()
            if items is None:
                results["pages_failed"] += 1
                continue
            results["pages_scraped"] += 1
            results["facts"].extend(items)

    if results["pages_scraped"] == 0:
        results["status"] = "network-error: no pages reachable (cached facts kept if any)"
    try:
        with _cache_lock:
            CACHE_FILE.write_text(json.dumps(results, ensure_ascii=False), encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass
    return results


def facts_text(limit: int = 120) -> str:
    """The scraped knowledge base as compact text for the LLM context."""
    data = cached_or_scrape()
    lines = []
    for f in (data.get("facts") or [])[:limit]:
        parts = [f"{k}: {v}" for k, v in f.items() if k not in ("url", "source") and v]
        lines.append(" • " + " | ".join(parts))
    header = (
        f"LIVE SRMAP DATA — scraped {data.get('scraped_at')} from {BASE_URL} "
        f"({data.get('pages_scraped')} pages)"
    )
    body = "\n".join(lines) if lines else "(no live facts yet)"
    return header + "\n" + body


_cache_once = {"ts": 0.0}


def cached_or_scrape() -> Dict[str, Any]:
    """Return cached facts; kick a background scrape if the cache is empty/stale."""
    with _cache_lock:
        if CACHE_FILE.exists():
            try:
                cached = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
                if time.time() - cached.get("ts", 0) < CACHE_TTL:
                    return cached
            except Exception:  # noqa: BLE001
                pass

    # Stale/missing → scrape in the background once, serve whatever exists now.
    now = time.time()
    if now - _cache_once["ts"] > 300:  # at most one background crawl per 5 min
        _cache_once["ts"] = now

        def _bg():
            try:
                with _fetch_lock:
                    scrape_all(max_pages=10, force=True)
            except Exception:  # noqa: BLE001
                pass

        threading.Thread(target=_bg, daemon=True, name="srmap-scraper").start()

    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass
    return {"facts": [], "pages_scraped": 0, "status": "scraping-in-background",
            "scraped_at": None}


def search_facts(query: str, limit: int = 12) -> List[Dict[str, Any]]:
    """Cheap keyword search over the cached facts."""
    data = cached_or_scrape()
    q_tokens = set(re.findall(r"[a-z0-9]{3,}", query.lower()))
    scored: List[tuple[float, Dict[str, Any]]] = []
    for f in data.get("facts") or []:
        hay = " ".join(str(v) for v in f.values()).lower()
        tokens = set(re.findall(r"[a-z0-9]{3,}", hay))
        overlap = len(q_tokens & tokens)
        if overlap:
            scored.append((overlap, f))
    scored.sort(key=lambda x: -x[0])
    return [f for _, f in scored[:limit]]
