import unittest

from .auth import CurrentUser
from .database import db
from .main import (
    CreateAssetRequest,
    FactChangeRequest,
    TaskDecisionRequest,
    create_content_asset,
    get_creator_workspace,
    get_reviewer_workspace,
    make_review_decision,
    submit_content_asset,
    trigger_fact_change_impact,
)
from .models import Claim, ContentAsset, StructuredFact


class OfficeWorkspaceFlowTests(unittest.TestCase):
    def setUp(self):
        db.reset()

    def tearDown(self):
        db.reset()

    @staticmethod
    def user(user_id: str, role: str, organization_id: str) -> CurrentUser:
        return CurrentUser(
            id=user_id,
            email=f"{user_id}@example.test",
            role=role,
            account_type="employee",
            organization_id=organization_id,
            available_roles=[role],
        )

    def test_creator_submission_is_reviewed_and_updates_creator_status(self):
        creator = self.user("creator", "creator", "org-a")
        reviewer = self.user("reviewer", "reviewer", "org-a")
        created = create_content_asset(
            CreateAssetRequest(
                title="Warranty content",
                raw_text="The product warranty lasts 2 years.",
            ),
            creator,
        )

        submitted = submit_content_asset(created.id, creator)
        task = submitted["task"]
        reviewer_workspace = get_reviewer_workspace(reviewer)
        self.assertEqual([item["id"] for item in reviewer_workspace["tasks"]], [task.id])
        self.assertEqual(reviewer_workspace["assets"][0]["id"], created.id)

        decision = make_review_decision(
            task.id,
            TaskDecisionRequest(decision="approve", notes="Approved after review."),
            reviewer,
        )
        self.assertEqual(decision["task"].status, "approved")
        self.assertEqual(decision["asset"].approval_status, "approved")
        self.assertEqual(len(decision["asset"].approval_history), 1)
        self.assertEqual(get_creator_workspace(creator)["assets"][0]["approval_status"], "approved")

    def test_office_workspace_data_isolated_by_organization(self):
        org_a_creator = self.user("creator-a", "creator", "org-a")
        org_b_creator = self.user("creator-b", "creator", "org-b")
        org_a_asset = create_content_asset(
            CreateAssetRequest(title="Org A", raw_text="Organization A content."),
            org_a_creator,
        )
        org_b_asset = create_content_asset(
            CreateAssetRequest(title="Org B", raw_text="Organization B content."),
            org_b_creator,
        )

        workspace_a = get_creator_workspace(org_a_creator)
        workspace_b = get_creator_workspace(org_b_creator)
        self.assertEqual([asset["id"] for asset in workspace_a["assets"]], [org_a_asset.id])
        self.assertEqual([asset["id"] for asset in workspace_b["assets"]], [org_b_asset.id])

    def test_fact_change_creates_only_affected_reassessment_tasks_and_preserves_approval(self):
        organization_id = "org-a"
        fact = StructuredFact(
            id="FACT-WARRANTY-A",
            fact_key="warranty",
            name="Warranty term",
            current_value="2 years",
            source_passage="The approved warranty term is 2 years.",
            version="v1.0",
            organization_id=organization_id,
        )
        db.add_or_update_fact(fact)

        affected = ContentAsset(
            id="AST-AFFECTED",
            title="Warranty claim",
            asset_type="website_page",
            channel="Web",
            raw_text="The product warranty lasts 2 years.",
            approval_status="approved",
            organization_id=organization_id,
            approval_history=[{
                "version": 1,
                "approved_by": "reviewer@example.test",
                "approved_at": "2025-01-01T00:00:00Z",
                "review_task_id": "TSK-OLD",
            }],
        )
        unaffected = ContentAsset(
            id="AST-UNAFFECTED",
            title="Color claim",
            asset_type="website_page",
            channel="Web",
            raw_text="The product is available in blue.",
            approval_status="approved",
            organization_id=organization_id,
        )
        db.add_or_update_asset(affected)
        db.add_or_update_asset(unaffected)
        db.add_claim(Claim(
            id="CLM-WARRANTY",
            asset_id=affected.id,
            claim_text="The product warranty lasts 2 years.",
            claim_type="numeric",
            exact_source_sentence="The product warranty lasts 2 years.",
            matched_fact_id=fact.id,
            verification_status="supported",
            reason="Matches the approved warranty fact.",
            organization_id=organization_id,
        ))
        db.add_claim(Claim(
            id="CLM-COLOR",
            asset_id=unaffected.id,
            claim_text="The product is available in blue.",
            claim_type="other",
            exact_source_sentence="The product is available in blue.",
            verification_status="supported",
            reason="Matches a separate fact.",
            organization_id=organization_id,
        ))

        result = trigger_fact_change_impact(
            FactChangeRequest(fact_id=fact.id, new_value="1 year"),
            self.user("admin", "admin", organization_id),
        )

        self.assertEqual([item.asset_id for item in result.affected_assets], [affected.id])
        self.assertEqual([item.asset_id for item in result.unaffected_assets], [unaffected.id])
        self.assertEqual(len(db.list_tasks(organization_id=organization_id)), 1)
        self.assertEqual(db.get_asset(affected.id, organization_id).approval_status, "approval_invalidated")
        self.assertEqual(len(db.get_asset(affected.id, organization_id).approval_history), 1)
        self.assertEqual(db.get_asset(unaffected.id, organization_id).approval_status, "approved")


if __name__ == "__main__":
    unittest.main()
