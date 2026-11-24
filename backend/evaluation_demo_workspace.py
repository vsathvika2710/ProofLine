import hashlib
import json
import logging
import os
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from .config import settings


DEMO_SESSION_TTL_SECONDS = 60 * 60
MAX_DEMO_SESSIONS = 5_000
logger = logging.getLogger(__name__)


class EvaluationDemoStoreUnavailable(RuntimeError):
    pass


class EvaluationDemoSessionNotFound(RuntimeError):
    pass


class EvaluationDemoSessionHasExpiredWork(RuntimeError):
    pass


class EvaluationDemoSessionConflict(RuntimeError):
    pass


class EvaluationDemoWorkspaceStore:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def _uses_supabase(self) -> bool:
        app_env = settings.app_env.strip().lower()
        is_render = os.getenv("RENDER", "").strip().lower() in {"1", "true", "yes"}
        if app_env in {"development", "dev", "local", "test"} and not is_render:
            return False
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise EvaluationDemoStoreUnavailable(
                "Persistent Evaluation demo storage is not configured."
            )
        return True

    def _request(
        self,
        method: str,
        path: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Any:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise EvaluationDemoStoreUnavailable(
                "Persistent Evaluation demo storage is not configured."
            )
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/evaluation_demo_sessions{path}",
            data=body,
            method=method,
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Prefer": "return=representation",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                content = response.read()
        except urllib.error.HTTPError as error:
            logger.error(
                "Evaluation demo persistence request failed (http_status=%s)",
                error.code,
            )
            raise EvaluationDemoStoreUnavailable(
                "Persistent Evaluation demo storage is unavailable."
            ) from error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            logger.error(
                "Evaluation demo persistence request failed (%s)",
                type(error).__name__,
            )
            raise EvaluationDemoStoreUnavailable(
                "Persistent Evaluation demo storage is unavailable."
            ) from error

        if not content:
            return None
        try:
            return json.loads(content)
        except json.JSONDecodeError as error:
            logger.error("Evaluation demo persistence returned invalid JSON")
            raise EvaluationDemoStoreUnavailable(
                "Persistent Evaluation demo storage is unavailable."
            ) from error

    @staticmethod
    def _new_session() -> Dict[str, Any]:
        now = time.time()
        return {
            "id": uuid.uuid4().hex,
            "created_at": now,
            "last_activity": now,
            "assets": {},
            "reviews": {},
            "events": [],
        }

    @staticmethod
    def _has_user_work(session: Dict[str, Any]) -> bool:
        return bool(session.get("assets") or session.get("reviews") or session.get("events"))

    @staticmethod
    def _digest(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _iso_time(timestamp: float) -> str:
        return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()

    @staticmethod
    def _row_expiry(row: Dict[str, Any]) -> float:
        value = row.get("expires_at")
        if not isinstance(value, str):
            raise EvaluationDemoStoreUnavailable(
                "Persistent Evaluation demo storage returned an invalid session."
            )
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
        except ValueError as error:
            raise EvaluationDemoStoreUnavailable(
                "Persistent Evaluation demo storage returned an invalid session."
            ) from error

    def _select_row(self, token_hash: str) -> Optional[Dict[str, Any]]:
        query = urllib.parse.urlencode({
            "select": "token_hash,data,expires_at,version",
            "token_hash": f"eq.{token_hash}",
            "limit": "1",
        })
        rows = self._request("GET", f"?{query}")
        if not isinstance(rows, list) or not rows:
            return None
        row = rows[0]
        if not isinstance(row, dict) or not isinstance(row.get("data"), dict):
            raise EvaluationDemoStoreUnavailable(
                "Persistent Evaluation demo storage returned an invalid session."
            )
        return row

    def _patch_row(self, token_hash: str, payload: Dict[str, Any]) -> bool:
        now = time.time()
        query = urllib.parse.urlencode({
            "token_hash": f"eq.{token_hash}",
            "expires_at": f"gt.{self._iso_time(now)}",
        })
        rows = self._request("PATCH", f"?{query}", payload)
        return isinstance(rows, list) and bool(rows)

    @staticmethod
    def _attach_token_hash(session: Dict[str, Any], token_hash: str) -> Dict[str, Any]:
        session["_token_hash"] = token_hash
        return session

    def _create_persistent(self, token: str, session: Dict[str, Any]) -> None:
        now = time.time()
        row = self._request(
            "POST",
            "",
            {
                "token_hash": self._digest(token),
                "data": session,
                "last_activity_at": self._iso_time(now),
                "expires_at": self._iso_time(now + DEMO_SESSION_TTL_SECONDS),
            },
        )
        if not isinstance(row, list) or not row:
            raise EvaluationDemoStoreUnavailable(
                "Persistent Evaluation demo storage did not confirm the new session."
            )

    def create(self) -> Tuple[str, Dict[str, Any]]:
        token = secrets.token_urlsafe(32)
        session = self._new_session()
        if self._uses_supabase():
            self._create_persistent(token, session)
            self._attach_token_hash(session, self._digest(token))
            session["_version"] = 1
            return token, session

        with self.lock:
            self._remove_expired(time.time())
            if len(self._sessions) >= MAX_DEMO_SESSIONS:
                raise EvaluationDemoStoreUnavailable(
                    "The demonstration workspace is temporarily full. Please try again later."
                )
            token_hash = self._digest(token)
            self._sessions[token_hash] = self._attach_token_hash(session, token_hash)
        return token, session

    def _remove_expired(self, now: float) -> None:
        expired_without_work = [
            key
            for key, session in self._sessions.items()
            if now - session["last_activity"] >= DEMO_SESSION_TTL_SECONDS
            and not self._has_user_work(session)
        ]
        for key in expired_without_work:
            self._sessions.pop(key, None)

    def _inspect(self, token: Optional[str]) -> Tuple[Optional[Dict[str, Any]], bool]:
        if not token:
            return None, False
        token_hash = self._digest(token)
        if self._uses_supabase():
            row = self._select_row(token_hash)
            if row is None:
                return None, False
            session = self._attach_token_hash(dict(row["data"]), token_hash)
            session["_version"] = int(row.get("version") or 1)
            return session, self._row_expiry(row) <= time.time()

        with self.lock:
            session = self._sessions.get(token_hash)
            if session is None:
                return None, False
            expired = time.time() - session["last_activity"] >= DEMO_SESSION_TTL_SECONDS
            return session, expired

    def get(self, token: Optional[str]) -> Optional[Dict[str, Any]]:
        session, expired = self._inspect(token)
        if session is None or expired:
            return None
        now = time.time()
        session["last_activity"] = now
        if self._uses_supabase():
            token_hash = session["_token_hash"]
            if not self._patch_row(
                token_hash,
                {
                    "last_activity_at": self._iso_time(now),
                    "expires_at": self._iso_time(now + DEMO_SESSION_TTL_SECONDS),
                },
            ):
                return None
        return session

    def recover(self, token: Optional[str]) -> Tuple[str, Dict[str, Any], bool]:
        session, expired = self._inspect(token)
        if session is None or token is None:
            raise EvaluationDemoSessionNotFound()
        if not expired:
            active_session = self.get(token)
            if active_session is None:
                raise EvaluationDemoSessionNotFound()
            return token, active_session, False
        if self._has_user_work(session):
            raise EvaluationDemoSessionHasExpiredWork()
        return self._rotate_empty_session(token)

    def _rotate_empty_session(
        self,
        old_token: str,
    ) -> Tuple[str, Dict[str, Any], bool]:
        token = secrets.token_urlsafe(32)
        session = self._new_session()
        old_hash = self._digest(old_token)
        new_hash = self._digest(token)
        if self._uses_supabase():
            now = time.time()
            query = urllib.parse.urlencode({"token_hash": f"eq.{old_hash}"})
            rows = self._request(
                "PATCH",
                f"?{query}",
                {
                    "token_hash": new_hash,
                    "data": session,
                    "version": 1,
                    "last_activity_at": self._iso_time(now),
                    "expires_at": self._iso_time(now + DEMO_SESSION_TTL_SECONDS),
                },
            )
            if not isinstance(rows, list) or not rows:
                raise EvaluationDemoSessionNotFound()
            self._attach_token_hash(session, new_hash)
            session["_version"] = 1
            return token, session, True

        with self.lock:
            current = self._sessions.get(old_hash)
            if current is None or self._has_user_work(current):
                raise EvaluationDemoSessionHasExpiredWork()
            self._sessions.pop(old_hash, None)
            self._attach_token_hash(session, new_hash)
            self._sessions[new_hash] = session
        return token, session, True

    def save(self, session: Dict[str, Any]) -> None:
        now = time.time()
        session["last_activity"] = now
        if not self._uses_supabase():
            return
        token_hash = session.get("_token_hash")
        if not isinstance(token_hash, str):
            raise EvaluationDemoSessionNotFound()
        version = session.get("_version")
        if not isinstance(version, int):
            raise EvaluationDemoSessionConflict()
        data = {key: value for key, value in session.items() if not key.startswith("_")}
        now_iso = self._iso_time(now)
        query = urllib.parse.urlencode({
            "token_hash": f"eq.{token_hash}",
            "version": f"eq.{version}",
            "expires_at": f"gt.{now_iso}",
        })
        rows = self._request(
            "PATCH",
            f"?{query}",
            {
                "data": data,
                "version": version + 1,
                "last_activity_at": now_iso,
                "expires_at": self._iso_time(now + DEMO_SESSION_TTL_SECONDS),
            },
        )
        if not isinstance(rows, list) or not rows:
            raise EvaluationDemoSessionConflict()
        session["_version"] = version + 1

    def clear(self) -> None:
        with self.lock:
            self._sessions.clear()


evaluation_demo_workspace_store = EvaluationDemoWorkspaceStore()
