import hashlib
import secrets
import threading
import time
import uuid
from typing import Any, Dict, Optional, Tuple


DEMO_SESSION_TTL_SECONDS = 60 * 60
MAX_DEMO_SESSIONS = 5_000


class EvaluationDemoWorkspaceStore:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def _remove_expired(self, now: float) -> None:
        expired = [
            key
            for key, session in self._sessions.items()
            if now - session["last_activity"] >= DEMO_SESSION_TTL_SECONDS
        ]
        for key in expired:
            self._sessions.pop(key, None)

    def create(self) -> Tuple[str, Dict[str, Any]]:
        now = time.time()
        with self.lock:
            self._remove_expired(now)
            if len(self._sessions) >= MAX_DEMO_SESSIONS:
                raise RuntimeError("The demonstration workspace is temporarily full. Please try again later.")
            token = secrets.token_urlsafe(32)
            session = {
                "id": uuid.uuid4().hex,
                "created_at": now,
                "last_activity": now,
                "assets": {},
                "reviews": {},
                "events": [],
            }
            self._sessions[self._digest(token)] = session
            return token, session

    def get(self, token: Optional[str]) -> Optional[Dict[str, Any]]:
        if not token:
            return None
        now = time.time()
        key = self._digest(token)
        with self.lock:
            self._remove_expired(now)
            session = self._sessions.get(key)
            if session is None:
                return None
            session["last_activity"] = now
            return session

    @staticmethod
    def _digest(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def clear(self) -> None:
        with self.lock:
            self._sessions.clear()


evaluation_demo_workspace_store = EvaluationDemoWorkspaceStore()
