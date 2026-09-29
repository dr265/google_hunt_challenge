"""Lightweight token auth for NEXUS.

Clerk (Google sign-in) authenticates the user on the frontend; after a
successful Clerk session the frontend calls POST /api/auth/login and this
module issues a simple signed session token used for backend calls.
"""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

import jwt
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

SECRET = os.getenv("NEXUS_JWT_SECRET") or "nexus-dev-secret"
ALGO = "HS256"
TTL = 7 * 86400


def create_token(claims: Dict[str, Any]) -> str:
    payload = {**claims, "iat": int(time.time()), "exp": int(time.time()) + TTL}
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGO])
    except jwt.PyJWTError:
        return None
