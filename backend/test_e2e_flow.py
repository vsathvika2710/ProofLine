import sys
import os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.main import (
    health,
    get_dashboard_stats,
    list_evidence_documents,
    list_structured_facts,
    list_content_assets,
    trigger_fact_change_impact,
    FactChangeRequest,
    make_review_decision,
    TaskDecisionRequest,
    get_audit_trail
)
from backend.auth import CurrentUser
from backend.database import db
from backend.seed_data import load_seed_workspace

def test_full_pipeline():
    print("=== PROOFLINE END-TO-END WORKFLOW TEST ===")
    organization_id = "test-novawear-demo"
    load_seed_workspace()
    for collection in (db.documents.values(), db.chunks, db.facts.values(), db.assets.values(), db.claims.values(), db.review_tasks.values()):
        for item in collection:
            item.organization_id = organization_id
    for entry in db.audit_log:
        entry.organization_id = organization_id
    admin = CurrentUser(
        id="USR-ADMIN-01",
        email="admin@example.test",
        role="admin",
        account_type="employee",
        organization_id=organization_id,
        available_roles=["admin"],
    )
    reviewer = CurrentUser(
        id="USR-REV-01",
        email="reviewer@example.test",
        role="reviewer",
        account_type="employee",
        organization_id=organization_id,
        available_roles=["reviewer"],
    )
    
    # 1. Health
    h = health()
    print("1. Health Status:", h["status"], "| Version:", h["version"])
    assert h["status"] == "healthy"
    
    # 2. Stats
    s = get_dashboard_stats(admin)
    print("2. Initial Assets:", s["total_assets"], "| Total Claims:", s["total_claims"])
    assert s["total_assets"] >= 3
    
    # 3. Documents & Facts
    docs = list_evidence_documents(admin)
    print(f"3. Evidence Vault: {len(docs)} documents loaded.")
    assert len(docs) >= 3
    
    facts = list_structured_facts(admin)
    print(f"4. Structured Facts: {len(facts)} facts active.")
    assert len(facts) >= 4
    
    warranty_fact = [f for f in facts if "warranty" in f.fact_key][0]
    print(f"   Selected Fact: {warranty_fact.name} (Current: {warranty_fact.current_value} {warranty_fact.unit})")
    
    # 4. Trigger Fact Change (Warranty 2 -> 1)
    req = FactChangeRequest(fact_id=warranty_fact.id, new_value="1")
    impact = trigger_fact_change_impact(req, admin)
    
    print("\n=== SIGNATURE: CHANGE IMPACT ENGINE RESULT ===")
    headline = f"1 fact changed, {impact.items_need_review} items need review, {impact.items_unaffected} checked, not affected"
    print("Headline:", headline)
    print("Fact Changed:", impact.fact_name, f"({impact.old_value} -> {impact.new_value})")
    print(f"Items Need Review: {impact.items_need_review}")
    print(f"Items Checked Not Affected: {impact.items_unaffected}")
    
    for aff in impact.affected_assets:
        claim_desc = aff.affected_claims[0].claim_text if aff.affected_claims else "N/A"
        print(f"   [AFFECTED] {aff.asset_title} | Claim: '{claim_desc}'")
    for unaff in impact.unaffected_assets:
        print(f"   [UNAFFECTED] {unaff.asset_title} | Reason: {unaff.checked_reason}")
    
    assert impact.items_need_review >= 2
    assert impact.items_unaffected >= 1
    
    # 5. Review Centre
    tasks = db.list_tasks(status="pending", organization_id=organization_id)
    print(f"\n5. Pending Review Tasks Created: {len(tasks)}")
    assert len(tasks) >= 1
    
    first_task = tasks[0]
    print(f"   Reviewing Task {first_task.id} for Asset '{first_task.asset_title}'")
    print(f"   Original:  '{first_task.original_text}'")
    print(f"   Suggested: '{first_task.suggested_text}'")
    print(f"   Source:    {first_task.cited_source}")
    
    # Reviewer decision: APPROVE
    dec_req = TaskDecisionRequest(decision="approve", notes="Updated per Warranty Policy v3 revision")
    dec_res = make_review_decision(first_task.id, dec_req, reviewer)
    assert dec_res["task"].status == "approved"
    print(f"   Review Status after Human Decision: {dec_res['task'].status}")
    print(f"   Updated Asset Version: v{dec_res['asset'].version}")
    
    # 6. Audit Trail
    logs = get_audit_trail(5, admin)
    print(f"\n6. Audit Trail Ledger: {len(logs)} entries retrieved.")
    for entry in logs:
        print(f"   [{entry.timestamp}] {entry.actor} ({entry.actor_role}): {entry.action} -> {entry.notes}")
    
    print("\nSUCCESS: All Proofline end-to-end assertions PASSED!")

if __name__ == "__main__":
    test_full_pipeline()
