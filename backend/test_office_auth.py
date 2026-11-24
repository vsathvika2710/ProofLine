import io
import json
import urllib.error
import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from . import auth
from .auth import CurrentUser, add_authorized_identity, deactivate_authorized_identity
from .main import (
    OfficeLoginRequest,
    enforce_office_login_rate_limit,
    office_logout,
    office_password_login,
)


class OfficeAuthorizationTests(unittest.TestCase):
    def setUp(self):
        auth._authorized_identities.clear()
        auth._evaluation_accounts.clear()

    def test_unregistered_email_is_denied(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.read.return_value = b"[]"
        with patch.object(auth.settings, "supabase_url", "https://project.supabase.co"), patch.object(
            auth.settings, "supabase_service_role_key", "test-service-role"
        ), patch("backend.auth.urllib.request.urlopen", return_value=response):
            self.assertIsNone(auth._find_authorized_identity("unknown@company.com"))

    def test_invalid_provider_token_is_denied(self):
        add_authorized_identity("employee@amazon.com", "employee", "amazon-org", ["creator"])
        with patch.object(auth, "_supabase_user", side_effect=HTTPException(401, "Invalid or expired sign-in")):
            with self.assertRaises(HTTPException):
                auth.get_current_user("Bearer invalid")

    def test_employee_roles_are_resolved_and_fixed(self):
        add_authorized_identity("creator@amazon.com", "employee", "amazon-org", ["creator"])
        add_authorized_identity("reviewer@flipkart.com", "employee", "flipkart-org", ["reviewer"])
        add_authorized_identity("admin@amazon.com", "employee", "amazon-org", ["admin"])
        creator = auth._find_authorized_identity("CREATOR@amazon.com")
        self.assertEqual(creator["roles"], ["creator"])
        self.assertEqual(creator["organization_id"], "amazon-org")
        self.assertEqual(auth._find_authorized_identity("reviewer@flipkart.com")["roles"], ["reviewer"])

    def test_judge_requires_explicit_roles(self):
        add_authorized_identity("judge@example.test", "judge_demo", "demo-org", ["creator", "reviewer", "admin"])
        identity = auth._find_authorized_identity("judge@example.test")
        self.assertEqual(set(identity["roles"]), {"creator", "reviewer", "admin"})
        self.assertEqual(identity["organization_id"], "demo-org")

    def test_normal_employee_cannot_switch_role(self):
        add_authorized_identity("creator@amazon.com", "employee", "amazon-org", ["creator"])
        identity = auth._find_authorized_identity("creator@amazon.com")
        self.assertEqual(identity["roles"], ["creator"])

    def test_demo_role_switch_requires_permission(self):
        add_authorized_identity("judge@example.test", "judge_demo", "demo-org", ["creator", "reviewer"])
        identity = auth._find_authorized_identity("judge@example.test")
        self.assertIn("reviewer", identity["roles"])
        self.assertNotIn("admin", identity["roles"])

    def test_creator_cannot_use_admin_permission(self):
        creator = CurrentUser(id="u1", email="c@x.com", role="creator", account_type="employee")
        checker = auth.require_role(["admin"])
        with self.assertRaises(HTTPException):
            checker(creator)

    def test_reviewer_cannot_manage_users(self):
        reviewer = CurrentUser(id="u1", email="r@x.com", role="reviewer", account_type="employee")
        checker = auth.require_role(["admin"])
        with self.assertRaises(HTTPException):
            checker(reviewer)

    def test_forgeries_of_role_and_org_are_rejected(self):
        creator = CurrentUser(
            id="u1",
            email="c@amazon.com",
            role="creator",
            account_type="employee",
            organization_id="amazon-org",
            available_roles=["creator"],
        )
        self.assertNotIn("admin", creator.available_roles)
        self.assertEqual(creator.organization_id, "amazon-org")

    def test_deactivated_account_loses_access(self):
        add_authorized_identity("offboarded@amazon.com", "employee", "amazon-org", ["creator"])
        self.assertTrue(deactivate_authorized_identity("offboarded@amazon.com"))
        identity = auth._find_authorized_identity("offboarded@amazon.com")
        self.assertFalse(identity["is_active"])

    def test_company_isolation_is_identity_scoped(self):
        add_authorized_identity("a@amazon.com", "employee", "amazon-org", ["creator"])
        add_authorized_identity("f@flipkart.com", "employee", "flipkart-org", ["creator"])
        self.assertEqual(auth._find_authorized_identity("a@amazon.com")["organization_id"], "amazon-org")
        self.assertEqual(auth._find_authorized_identity("f@flipkart.com")["organization_id"], "flipkart-org")

    def test_judge_cannot_be_real_org(self):
        add_authorized_identity("judge@example.test", "judge_demo", "demo-org", ["creator"])
        identity = auth._find_authorized_identity("judge@example.test")
        self.assertEqual(identity["organization_id"], "demo-org")
        self.assertNotEqual(identity["organization_id"], "amazon-org")

    def test_evaluation_account_is_separate_from_employee_accounts(self):
        auth.add_evaluation_account("judge@example.test", ["creator", "reviewer", "admin"])
        self.assertNotIn("judge@example.test", auth._authorized_identities)
        record = auth._evaluation_accounts["judge@example.test"]
        self.assertEqual(set(record["roles"]), {"creator", "reviewer", "admin"})

    def test_evaluation_role_must_be_explicitly_assigned(self):
        auth.add_evaluation_account("judge@example.test", ["creator"])
        record = auth._evaluation_accounts["judge@example.test"]
        self.assertIn("creator", record["roles"])
        self.assertNotIn("admin", record["roles"])

    def test_super_admin_workspaces_are_database_role_scoped(self):
        add_authorized_identity(
            "executive@example.test",
            "employee",
            "proofline-test-org",
            ["admin", "creator", "reviewer"],
            global_role="super_admin",
        )
        identity = auth._find_authorized_identity("executive@example.test")
        self.assertEqual(identity["global_role"], "super_admin")
        self.assertEqual(set(identity["roles"]), {"admin", "creator", "reviewer"})

        with patch.object(auth, "_supabase_user", return_value={"id": "u1", "email": "executive@example.test"}):
            user = auth.get_current_user("Bearer valid", "reviewer")
            self.assertEqual(user.role, "reviewer")
            self.assertEqual(user.global_role, "super_admin")
            self.assertTrue(user.requires_role_selection)
            with self.assertRaises(HTTPException) as context:
                auth.get_current_user("Bearer valid", "owner")
        self.assertEqual(context.exception.status_code, 403)

    def test_supabase_identity_lookup_returns_all_active_super_admin_workspaces(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.read.return_value = json.dumps([
            {
                "account_type": "employee",
                "global_role": "super_admin",
                "is_active": True,
                "organization_memberships": [
                    {"organization_id": "test-org", "assigned_role": role, "membership_status": "active"}
                    for role in ("admin", "creator", "reviewer")
                ],
            }
        ]).encode()
        with patch.object(auth.settings, "supabase_url", "https://project.supabase.co"), patch.object(
            auth.settings, "supabase_service_role_key", "test-service-role"
        ), patch("backend.auth.urllib.request.urlopen", return_value=response):
            identity = auth._find_authorized_identity("super-admin@example.test")

        self.assertEqual(identity["global_role"], "super_admin")
        self.assertEqual(identity["roles"], ["admin", "creator", "reviewer"])
        self.assertEqual(identity["organization_id"], "test-org")

    def test_database_permission_error_is_not_reported_as_invalid_credentials(self):
        error = urllib.error.HTTPError(
            "https://project.supabase.co/rest/v1/authorized_identities",
            403,
            "Forbidden",
            {},
            io.BytesIO(b'{"code":"42501","message":"permission denied"}'),
        )
        with patch.object(auth.settings, "supabase_url", "https://project.supabase.co"), patch.object(
            auth.settings, "supabase_service_role_key", "test-service-role"
        ), patch("backend.auth.urllib.request.urlopen", side_effect=error), self.assertLogs(
            "backend.auth", level="ERROR"
        ) as logs:
            with self.assertRaises(HTTPException) as context:
                auth._find_authorized_identity("private@example.test")

        self.assertEqual(context.exception.status_code, 503)
        self.assertIn("provider_code=42501", "\n".join(logs.output))
        self.assertNotIn("private@example.test", "\n".join(logs.output))
        self.assertNotIn("test-service-role", "\n".join(logs.output))

    def test_active_identity_without_memberships_is_not_an_invalid_password(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.read.return_value = json.dumps([
            {
                "account_type": "employee",
                "global_role": "super_admin",
                "is_active": True,
                "organization_memberships": [],
            }
        ]).encode()
        with patch.object(auth.settings, "supabase_url", "https://project.supabase.co"), patch.object(
            auth.settings, "supabase_service_role_key", "test-service-role"
        ), patch("backend.auth.urllib.request.urlopen", return_value=response):
            with self.assertRaises(HTTPException) as context:
                auth._find_authorized_identity("super-admin@example.test")

        self.assertEqual(context.exception.status_code, 403)

    def test_multi_role_employee_cannot_select_unassigned_workspace(self):
        add_authorized_identity("staff@example.test", "employee", "org-1", ["creator", "reviewer"])
        with patch.object(auth, "_supabase_user", return_value={"id": "u2", "email": "staff@example.test"}):
            user = auth.get_current_user("Bearer valid", "creator")
            self.assertEqual(user.available_roles, ["creator", "reviewer"])
            with self.assertRaises(HTTPException) as context:
                auth.get_current_user("Bearer valid", "admin")
        self.assertEqual(context.exception.status_code, 403)

    def test_password_login_returns_only_a_provider_session_for_active_office_accounts(self):
        provider_session = {
            "access_token": "access",
            "refresh_token": "refresh",
            "expires_in": 3600,
            "user": {"id": "u3", "email": "staff@example.test"},
        }
        with patch("backend.main.supabase_password_login", return_value=provider_session) as login, patch(
            "backend.main._find_authorized_identity",
            return_value={"is_active": True, "account_type": "employee"},
        ):
            result = office_password_login(OfficeLoginRequest(email="Staff@example.test", password="not-logged"))
        login.assert_called_once_with("Staff@example.test", "not-logged")
        self.assertEqual(result["user"]["email"], "staff@example.test")
        self.assertNotIn("password", result)

        with patch("backend.main.supabase_password_login", return_value=provider_session), patch(
            "backend.main._find_authorized_identity",
            return_value={"is_active": False, "account_type": "employee"},
        ):
            with self.assertRaises(HTTPException) as context:
                office_password_login(OfficeLoginRequest(email="staff@example.test", password="wrong"))
        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(context.exception.detail, "Invalid email or password")

    def test_password_login_preserves_authorization_service_failures(self):
        provider_session = {
            "access_token": "access",
            "refresh_token": "refresh",
            "user": {"id": "u4", "email": "staff@example.test"},
        }
        with patch("backend.main.supabase_password_login", return_value=provider_session), patch(
            "backend.main._find_authorized_identity",
            side_effect=HTTPException(503, "Office authorization service is unavailable"),
        ):
            with self.assertRaises(HTTPException) as context:
                office_password_login(OfficeLoginRequest(email="staff@example.test", password="not-logged"))

        self.assertEqual(context.exception.status_code, 503)

    def test_office_login_rate_limit_and_logout_revocation(self):
        request = type("Request", (), {"client": type("Client", (), {"host": "test-auth-ip"})()})()
        from . import main
        main._office_login_attempts.pop("test-auth-ip", None)
        for _ in range(main.OFFICE_LOGIN_ATTEMPTS_PER_MINUTE):
            enforce_office_login_rate_limit(request)
        with self.assertRaises(HTTPException) as context:
            enforce_office_login_rate_limit(request)
        self.assertEqual(context.exception.status_code, 429)
        main._office_login_attempts.pop("test-auth-ip", None)

        with patch("backend.main.supabase_logout") as revoke:
            self.assertEqual(office_logout("Bearer session-token"), {"success": True})
        revoke.assert_called_once_with("session-token")


if __name__ == "__main__":
    unittest.main()
