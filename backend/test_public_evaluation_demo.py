import unittest
import asyncio
import json
from http.cookies import SimpleCookie
from unittest.mock import patch
from fastapi import HTTPException

from .auth import get_evaluation_user
from .main import app, get_feature_flags
from .config import settings
from .evaluation_demo_workspace import evaluation_demo_workspace_store


class PublicEvaluationDemoSecurityTests(unittest.TestCase):
    def request(self, path, method="GET", headers=(), body=b""):
        messages = []
        request_sent = False

        async def receive():
            nonlocal request_sent
            if request_sent:
                await asyncio.sleep(0)
                return {"type": "http.disconnect"}
            request_sent = True
            return {"type": "http.request", "body": body, "more_body": False}

        async def send(message):
            messages.append(message)

        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": b"",
            "root_path": "",
            "headers": list(headers),
            "client": ("127.0.0.1", 12345),
            "server": ("127.0.0.1", 8000),
        }
        asyncio.run(app(scope, receive, send))
        start = next(message for message in messages if message["type"] == "http.response.start")
        body = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
        return start["status"], json.loads(body) if body else {}, dict(start.get("headers", []))

    def test_feature_flag_controls_public_config_and_demo_api(self):
        with patch.object(settings, "enable_evaluation_access", False):
            self.assertFalse(get_feature_flags()["enableEvaluationAccess"])
            with self.assertRaises(HTTPException) as context:
                get_evaluation_user(authorization=None)
        self.assertEqual(context.exception.status_code, 404)

    def test_cors_allows_explicit_local_frontend_origins_only(self):
        status, payload, headers = self.request(
            "/api/config/features",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        self.assertEqual(status, 200)
        self.assertIsInstance(payload["enableEvaluationAccess"], bool)
        self.assertEqual(headers.get(b"access-control-allow-origin"), b"http://localhost:5173")

        _, _, headers = self.request(
            "/api/config/features",
            headers=[(b"origin", b"http://untrusted.example")],
        )
        self.assertNotIn(b"access-control-allow-origin", headers)

    def test_public_demo_has_no_anonymous_office_data_access(self):
        self.assertEqual(self.request("/api/dashboard/stats")[0], 401)
        self.assertEqual(self.request("/api/evidence")[0], 401)
        self.assertEqual(self.request("/api/content")[0], 401)

    def test_public_demo_cannot_trigger_shared_office_mutations(self):
        self.assertEqual(self.request("/api/workspace/load-demo", "POST")[0], 401)
        self.assertEqual(self.request("/api/eval/run", "POST")[0], 401)

    def test_legacy_evaluation_api_still_requires_authenticated_authorization(self):
        with patch.object(settings, "enable_evaluation_access", True):
            status, _, _ = self.request("/api/evaluation/workspace")
        self.assertEqual(status, 401)

    def test_evaluation_creator_workspace_requires_an_enabled_session(self):
        evaluation_demo_workspace_store.clear()
        with patch.object(settings, "enable_evaluation_access", False):
            self.assertEqual(self.request("/api/evaluation/demo/session", "POST")[0], 404)
            self.assertEqual(self.request("/api/evaluation/demo/session/recover", "POST")[0], 404)
            self.assertEqual(self.request("/api/evaluation/demo/session/restart", "POST")[0], 404)
            self.assertEqual(self.request("/api/evaluation/demo/creator/content")[0], 404)

        with patch.object(settings, "enable_evaluation_access", True):
            self.assertEqual(self.request("/api/evaluation/demo/creator/content")[0], 401)

    def test_demo_session_recovery_is_non_destructive_and_restart_is_explicit(self):
        evaluation_demo_workspace_store.clear()

        def cookie_header(headers):
            cookie = SimpleCookie()
            cookie.load(headers[b"set-cookie"].decode("utf-8"))
            return f"{cookie['proofline_evaluation_demo'].key}={cookie['proofline_evaluation_demo'].value}".encode("ascii")

        with patch.object(settings, "enable_evaluation_access", True):
            status, _, created_headers = self.request("/api/evaluation/demo/session", "POST")
            self.assertEqual(status, 200)
            self.assertNotIn(b"max-age", created_headers[b"set-cookie"].lower())
            original_cookie = cookie_header(created_headers)
            original_token = original_cookie.decode("ascii").split("=", 1)[1]
            original_session_id = evaluation_demo_workspace_store.get(original_token)["id"]

            status, _, _ = self.request(
                "/api/evaluation/demo/session/recover",
                "POST",
                headers=[(b"cookie", original_cookie)],
            )
            self.assertEqual(status, 200)
            self.assertEqual(
                evaluation_demo_workspace_store.get(original_token)["id"],
                original_session_id,
            )

            evaluation_demo_workspace_store.clear()
            self.assertEqual(
                self.request(
                    "/api/evaluation/demo/session/recover",
                    "POST",
                    headers=[(b"cookie", original_cookie)],
                )[0],
                401,
            )
            self.assertEqual(
                self.request(
                    "/api/evaluation/demo/session",
                    "POST",
                    headers=[(b"cookie", original_cookie)],
                )[0],
                401,
            )

            status, _, restarted_headers = self.request(
                "/api/evaluation/demo/session/restart",
                "POST",
                headers=[(b"cookie", original_cookie)],
            )
            self.assertEqual(status, 200)
            restarted_cookie = cookie_header(restarted_headers)
            restarted_token = restarted_cookie.decode("ascii").split("=", 1)[1]
            self.assertNotEqual(restarted_token, original_token)
            self.assertIsNotNone(evaluation_demo_workspace_store.get(restarted_token))

    def test_creator_submissions_are_isolated_between_anonymous_sessions(self):
        evaluation_demo_workspace_store.clear()
        with patch.object(settings, "enable_evaluation_access", True):
            status_a, _, headers_a = self.request("/api/evaluation/demo/session", "POST")
            status_b, _, headers_b = self.request("/api/evaluation/demo/session", "POST")
            self.assertEqual(status_a, 200)
            self.assertEqual(status_b, 200)

            def cookie_header(headers):
                cookie = SimpleCookie()
                cookie.load(headers[b"set-cookie"].decode("utf-8"))
                return f"{cookie['proofline_evaluation_demo'].key}={cookie['proofline_evaluation_demo'].value}".encode("ascii")

            session_a = cookie_header(headers_a)
            session_b = cookie_header(headers_b)
            session_id_a = evaluation_demo_workspace_store.get(session_a.decode("ascii").split("=", 1)[1])["id"]
            draft = {
                "title": "NovaWear demo launch copy",
                "description": "A fictional evaluation draft",
                "source_text": "NovaWear SmartWatch X includes a 1-year warranty.",
                "input_method": "text",
                "product": {
                    "name": "NovaWear SmartWatch X",
                    "brand": "NovaWear",
                    "category": "Smartwatch",
                    "model": "X",
                    "identification": "identified",
                },
                "claims": [{
                    "id": "GCL-demo-test",
                    "text": "NovaWear SmartWatch X includes a 1-year warranty.",
                    "normalized": "novawear smartwatch x includes a 1-year warranty",
                    "claim_type": "warranty",
                }],
                "assessment": {
                    "product": {"name": "NovaWear SmartWatch X", "brand": "NovaWear"},
                    "input_method": "text",
                    "findings": [{
                        "claim_id": "GCL-demo-test",
                        "original_claim": "NovaWear SmartWatch X includes a 1-year warranty.",
                        "normalized_claim": "novawear smartwatch x includes a 1-year warranty",
                        "claim_type": "warranty",
                        "status": "supported",
                        "explanation": "Matched to fictional demonstration evidence.",
                        "evidence": [],
                        "suggested_correction": None,
                        "limitation": None,
                    }],
                    "evidence_source_note": "Fictional demonstration evidence only.",
                    "assessed_at": "2025-01-01T00:00:00Z",
                    "processing_notice": "Demonstration result.",
                },
            }
            request_headers = [
                (b"cookie", session_a),
                (b"content-type", b"application/json"),
            ]
            status, saved, _ = self.request(
                "/api/evaluation/demo/creator/content",
                "POST",
                request_headers,
                json.dumps(draft).encode("utf-8"),
            )
            self.assertEqual(status, 200)
            self.assertEqual(saved["approval_status"], "draft")
            status, saved_again, _ = self.request(
                "/api/evaluation/demo/creator/content",
                "POST",
                request_headers,
                json.dumps(draft).encode("utf-8"),
            )
            self.assertEqual(status, 200)
            self.assertEqual(saved_again["version"], 1)

            status, submitted, _ = self.request(
                f"/api/evaluation/demo/creator/content/{saved['id']}/submit",
                "POST",
                [(b"cookie", session_a)],
            )
            self.assertEqual(status, 200)
            self.assertEqual(submitted["task"]["status"], "pending")
            self.assertEqual(submitted["asset"]["assessment"]["findings"][0]["status"], "contradicted")

            status, queue_a, _ = self.request(
                "/api/evaluation/demo/reviewer/queue",
                headers=[(b"cookie", session_a)],
            )
            self.assertEqual(status, 200)
            self.assertEqual([task["id"] for task in queue_a["tasks"]], [submitted["task"]["id"]])

            status, queue_b, _ = self.request(
                "/api/evaluation/demo/reviewer/queue",
                headers=[(b"cookie", session_b)],
            )
            self.assertEqual(status, 200)
            self.assertEqual(queue_b["tasks"], [])
            status, _, _ = self.request(
                f"/api/evaluation/demo/creator/content/{saved['id']}/submit",
                "POST",
                [(b"cookie", session_b)],
            )
            self.assertEqual(status, 404)

            status, _, _ = self.request(
                f"/api/evaluation/demo/reviewer/queue/{submitted['task']['id']}/decision",
                "POST",
                [(b"cookie", session_a), (b"content-type", b"application/json")],
                json.dumps({"decision": "approve", "note": "Attempt to approve the original claim."}).encode("utf-8"),
            )
            self.assertEqual(status, 409)

            decision_body = json.dumps({
                "decision": "approve",
                "note": "Demo review complete.",
                "edited_text": "NovaWear SmartWatch X offers up to 7 days of typical battery life.",
            }).encode("utf-8")
            status, decision, _ = self.request(
                f"/api/evaluation/demo/reviewer/queue/{submitted['task']['id']}/decision",
                "POST",
                [(b"cookie", session_a), (b"content-type", b"application/json")],
                decision_body,
            )
            self.assertEqual(status, 200)
            self.assertEqual(decision["asset"]["approval_status"], "approved")
            self.assertEqual(decision["asset"]["version"], 2)
            self.assertIsNotNone(decision["asset"]["assessment"])

            rejected_draft = {**draft, "title": "NovaWear demo copy requiring rejection"}
            status, rejected_asset, _ = self.request(
                "/api/evaluation/demo/creator/content",
                "POST",
                request_headers,
                json.dumps(rejected_draft).encode("utf-8"),
            )
            self.assertEqual(status, 200)
            status, rejected_submission, _ = self.request(
                f"/api/evaluation/demo/creator/content/{rejected_asset['id']}/submit",
                "POST",
                [(b"cookie", session_a)],
            )
            self.assertEqual(status, 200)
            rejection_url = f"/api/evaluation/demo/reviewer/queue/{rejected_submission['task']['id']}/decision"
            status, _, _ = self.request(
                rejection_url,
                "POST",
                [(b"cookie", session_a), (b"content-type", b"application/json")],
                json.dumps({"decision": "reject", "note": " "}).encode("utf-8"),
            )
            self.assertEqual(status, 422)
            status, rejection, _ = self.request(
                rejection_url,
                "POST",
                [(b"cookie", session_a), (b"content-type", b"application/json")],
                json.dumps({"decision": "reject", "note": "The warranty statement needs substantiation."}).encode("utf-8"),
            )
            self.assertEqual(status, 200)
            self.assertEqual(rejection["task"]["status"], "rejected")
            self.assertEqual(rejection["asset"]["approval_status"], "rejected")
            self.assertEqual(rejection["task"]["contentVersion"], rejected_asset["version"])

            status, workspace, _ = self.request(
                "/api/evaluation/demo/creator/content",
                headers=[(b"cookie", session_a)],
            )
            self.assertEqual(status, 200)
            rejection_event = next(event for event in workspace["events"] if event["type"] == "review_rejected")
            self.assertEqual(rejection_event["actor"], "Evaluation Reviewer")
            self.assertEqual(rejection_event["role"], "reviewer")
            self.assertEqual(rejection_event["session_id"], session_id_a)
            self.assertEqual(rejection_event["resource_id"], rejected_asset["id"])

        evaluation_demo_workspace_store.clear()


if __name__ == "__main__":
    unittest.main()
