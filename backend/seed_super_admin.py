import getpass
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

from .config import settings


ADMIN_EMAIL = "proofline.office@gmail.com"
ADMIN_NAME = "ProofLine Super Admin"
MIN_PASSWORD_LENGTH = 12


def _request(
    path: str,
    method: str = "GET",
    payload: Optional[Dict[str, Any]] = None,
    prefer: Optional[str] = None,
) -> Any:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before provisioning.")
    if not settings.supabase_anon_key:
        raise RuntimeError("Set SUPABASE_ANON_KEY before provisioning.")

    url = f"{settings.supabase_url.rstrip('/')}{path}"
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError("Supabase must use HTTPS except for a local development instance.")

    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            response_body = response.read().decode("utf-8")
            return json.loads(response_body) if response_body else None
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Supabase request failed with HTTP {error.code} for {path}.") from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Could not complete the Supabase request for {path}.") from error


def _find_existing_auth_user() -> Optional[Dict[str, Any]]:
    page = 1
    while True:
        users_response = _request(
            f"/auth/v1/admin/users?page={page}&per_page=1000",
        )
        users = users_response.get("users", []) if isinstance(users_response, dict) else []
        for user in users:
            if str(user.get("email", "")).strip().lower() == ADMIN_EMAIL:
                return user
        if len(users) < 1000:
            return None
        page += 1


def main() -> int:
    if not settings.supabase_url or not settings.supabase_service_role_key or not settings.supabase_anon_key:
        print(
            "Persistent Supabase authentication is not configured. Set SUPABASE_URL, "
            "SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY, then apply "
            "backend/migrations/20261124_super_admin_auth.sql.",
            file=sys.stderr,
        )
        return 2

    password = getpass.getpass("Set the initial ProofLine password (12+ characters): ")
    confirmation = getpass.getpass("Confirm the initial ProofLine password: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.", file=sys.stderr)
        return 2
    if password != confirmation:
        print("Passwords do not match.", file=sys.stderr)
        return 2

    created_auth_user = False
    user_id: Optional[str] = None
    try:
        existing_identity = _request(
            "/rest/v1/authorized_identities"
            f"?select=id,global_role&normalized_email=eq.{urllib.parse.quote(ADMIN_EMAIL)}"
        )
        if existing_identity:
            if existing_identity[0].get("global_role") != "super_admin":
                raise RuntimeError("The email is already assigned to a non-super-admin identity.")

        user = _find_existing_auth_user()
        if user:
            user_id = user.get("id")
            _request(
                f"/auth/v1/admin/users/{urllib.parse.quote(str(user_id), safe='')}",
                method="PUT",
                payload={
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": ADMIN_NAME},
                },
            )
        else:
            user = _request(
                "/auth/v1/admin/users",
                method="POST",
                payload={
                    "email": ADMIN_EMAIL,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": ADMIN_NAME},
                },
            )
            user_id = user.get("id") if isinstance(user, dict) else None
            created_auth_user = True

        if not user_id:
            raise RuntimeError("Supabase did not return the registered auth user ID.")

        registration = _request(
            "/rest/v1/rpc/proofline_register_super_admin",
            method="POST",
            payload={"p_user_id": user_id},
        )
        print("Super Admin registered in Supabase Auth and the authorization database.")
        if isinstance(registration, dict):
            print(f"Email: {registration.get('email', ADMIN_EMAIL)}")
            print("Role: super_admin")
            print(f"Organization ID: {registration.get('organization_id', 'configured by database')}")
        print("Authorized workspaces: Admin, Content Creator, Reviewer")
        print("The password was sent only to Supabase Auth and was not saved or printed.")
        return 0
    except RuntimeError as error:
        if created_auth_user and user_id:
            try:
                _request(
                    f"/auth/v1/admin/users/{urllib.parse.quote(str(user_id), safe='')}",
                    method="DELETE",
                )
            except RuntimeError:
                print("Warning: the newly created Auth user could not be rolled back.", file=sys.stderr)
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
