import copy
import json
import unittest
import urllib.parse
from datetime import datetime

from .evaluation_demo_workspace import (
    EvaluationDemoSessionConflict,
    EvaluationDemoSessionHasExpiredWork,
    EvaluationDemoWorkspaceStore,
)


class PersistentEvaluationDemoStore(EvaluationDemoWorkspaceStore):
    def __init__(self, rows):
        super().__init__()
        self.rows = rows

    def _uses_supabase(self):
        return True

    def _request(self, method, path, payload=None):
        filters = urllib.parse.parse_qs(urllib.parse.urlsplit(path).query)
        if method == "POST":
            row = {**copy.deepcopy(payload), "version": 1}
            self.rows[row["token_hash"]] = row
            return [copy.deepcopy(row)]

        matches = []
        for token_hash, row in self.rows.items():
            if self._matches(row, filters):
                matches.append((token_hash, row))
        if method == "GET":
            return [copy.deepcopy(row) for _, row in matches[:1]]
        if method == "PATCH":
            if not matches:
                return []
            old_hash, row = matches[0]
            updated = {**row, **copy.deepcopy(payload)}
            self.rows.pop(old_hash, None)
            self.rows[updated["token_hash"]] = updated
            return [copy.deepcopy(updated)]
        raise AssertionError(f"Unexpected persistence method: {method}")

    @staticmethod
    def _matches(row, filters):
        for key, values in filters.items():
            condition = values[0]
            if condition.startswith("eq."):
                if str(row.get(key)) != condition[3:]:
                    return False
            elif condition.startswith("gt."):
                current = datetime.fromisoformat(row[key].replace("Z", "+00:00"))
                expected = datetime.fromisoformat(condition[3:].replace("Z", "+00:00"))
                if current <= expected:
                    return False
        return True


class EvaluationDemoPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.rows = {}

    def test_persistent_session_survives_store_instances_and_tokens_are_hashed(self):
        creator_store = PersistentEvaluationDemoStore(self.rows)
        token, created = creator_store.create()
        self.assertNotIn(token, json.dumps(self.rows))

        reviewer_store = PersistentEvaluationDemoStore(self.rows)
        recovered_token, recovered, rotated = reviewer_store.recover(token)
        self.assertFalse(rotated)
        self.assertEqual(recovered_token, token)
        self.assertEqual(recovered["id"], created["id"])

        recovered["assets"]["content-1"] = {"title": "Shared demo content"}
        reviewer_store.save(recovered)
        restarted_store = PersistentEvaluationDemoStore(self.rows)
        self.assertEqual(
            restarted_store.get(token)["assets"]["content-1"]["title"],
            "Shared demo content",
        )

    def test_sessions_are_isolated_and_stale_writes_are_rejected(self):
        first_store = PersistentEvaluationDemoStore(self.rows)
        token_a, _ = first_store.create()
        token_b, _ = first_store.create()
        store_a = PersistentEvaluationDemoStore(self.rows)
        store_b = PersistentEvaluationDemoStore(self.rows)
        first_write = store_a.get(token_a)
        stale_write = store_b.get(token_a)

        first_write["assets"]["a"] = {"title": "First write"}
        store_a.save(first_write)
        stale_write["assets"]["b"] = {"title": "Stale write"}
        with self.assertRaises(EvaluationDemoSessionConflict):
            store_b.save(stale_write)

        self.assertEqual(set(first_store.get(token_a)["assets"]), {"a"})
        self.assertEqual(first_store.get(token_b)["assets"], {})

    def test_expired_empty_session_rotates_but_expired_work_is_preserved(self):
        store = PersistentEvaluationDemoStore(self.rows)
        empty_token, _ = store.create()
        self.rows[store._digest(empty_token)]["expires_at"] = "2000-01-01T00:00:00+00:00"
        rotated_token, _, rotated = store.recover(empty_token)
        self.assertTrue(rotated)
        self.assertNotEqual(rotated_token, empty_token)

        active_token, active = store.create()
        active["assets"]["saved"] = {"title": "Do not discard"}
        store.save(active)
        row = self.rows[store._digest(active_token)]
        row["expires_at"] = "2000-01-01T00:00:00+00:00"
        with self.assertRaises(EvaluationDemoSessionHasExpiredWork):
            store.recover(active_token)
        self.assertEqual(
            self.rows[store._digest(active_token)]["data"]["assets"]["saved"]["title"],
            "Do not discard",
        )


if __name__ == "__main__":
    unittest.main()
