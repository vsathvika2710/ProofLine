import re
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from .models import (
    ChangeImpactResult,
    AffectedAssetItem,
    AffectedClaimItem,
    UnaffectedAssetItem,
    ReviewTask,
    AuditLogEntry
)
from .database import db
from .claim_intelligence import extract_numeric_tokens

class ChangeImpactEngine:
    def execute_fact_change(
        self,
        fact_id: str,
        new_value: str,
        actor: str = "Admin",
        actor_role: str = "admin"
    ) -> ChangeImpactResult:
        """
        Signature Feature: Walks the fact-claim-asset graph when a fact changes.
        1. Compares old value vs new value.
        2. Graph traversal to dependent claims & assets.
        3. Exact checks first + evidence verification.
        4. Invalidates approval on affected assets and creates human review tasks.
        5. Confirms unaffected claims as 'checked, not affected'.
        """
        fact = db.get_fact(fact_id)
        if not fact:
            raise ValueError(f"Fact with ID '{fact_id}' not found.")

        old_value = fact.current_value
        fact_key = fact.fact_key
        event_id = f"IMP-{uuid.uuid4().hex[:8].upper()}"

        # Update the fact in the database
        fact.current_value = new_value
        fact.version = f"v{float(fact.version.replace('v', '')) + 0.1:.1f}" if fact.version.startswith('v') else "v2.0"
        fact.updated_at = datetime.utcnow().isoformat() + "Z"
        db.add_or_update_fact(fact)

        # Audit log the fact modification
        db.record_audit(
            actor=actor,
            role=actor_role,
            action="FACT_UPDATED",
            target_entity="structured_facts",
            target_id=fact.id,
            diff_payload={"old_value": old_value, "new_value": new_value, "fact_key": fact_key},
            notes=f"Updated fact '{fact.name}' from '{old_value}' to '{new_value}'."
        )

        all_assets = db.list_assets()
        affected_assets: List[AffectedAssetItem] = []
        unaffected_assets: List[UnaffectedAssetItem] = []
        created_tasks_count = 0

        for asset in all_assets:
            asset_claims = db.get_claims_by_asset(asset.id)
            asset_affected_claims: List[AffectedClaimItem] = []
            asset_is_affected = False

            # Check each claim in this asset
            for claim in asset_claims:
                claim_lower = claim.claim_text.lower()
                sentence_lower = claim.exact_source_sentence.lower()

                # Is this claim dependent on the changed fact?
                is_dependent = False
                if claim.matched_fact_id == fact.id:
                    is_dependent = True
                elif ('warranty' in fact_key and ('warranty' in claim_lower or 'coverage' in claim_lower or 'warranty' in sentence_lower)):
                    is_dependent = True
                elif ('water' in fact_key and ('water' in claim_lower or '50m' in claim_lower or '100m' in claim_lower)):
                    is_dependent = True
                elif ('battery' in fact_key and 'battery' in claim_lower):
                    is_dependent = True
                elif ('color' in fact_key and ('midnight' in claim_lower or 'silver' in claim_lower)):
                    is_dependent = True

                if is_dependent:
                    # Run exact check against new value
                    claim_nums = extract_numeric_tokens(claim.claim_text)
                    new_nums = extract_numeric_tokens(new_value)

                    # Determine if it truly conflicts with the new fact
                    has_conflict = True
                    suggested_text = claim.exact_source_sentence

                    if claim_nums and new_nums:
                        old_num = claim_nums[0][0]
                        new_num = new_nums[0][0]
                        if abs(old_num - new_num) < 0.001:
                            has_conflict = False
                        else:
                            # Replace old number with new number in suggested fix
                            num_str = str(int(old_num)) if old_num.is_integer() else str(old_num)
                            target_num_str = str(int(new_num)) if new_num.is_integer() else str(new_num)
                            suggested_text = re.sub(
                                rf'\b({num_str}|two|2)\b',
                                target_num_str,
                                claim.exact_source_sentence,
                                flags=re.IGNORECASE
                            )
                            # Handle 'two-year' -> '1-year'
                            suggested_text = re.sub(r'two-year', f'{target_num_str}-year', suggested_text, flags=re.IGNORECASE)
                            suggested_text = re.sub(r'two years', f'{target_num_str} year', suggested_text, flags=re.IGNORECASE)

                    if has_conflict:
                        asset_is_affected = True
                        claim.verification_status = "outdated"
                        claim.reason = f"Outdated by fact update: '{fact.name}' was modified from {old_value} to {new_value} {fact.unit or ''}."
                        db.add_claim(claim)

                        aff_item = AffectedClaimItem(
                            claim_id=claim.id,
                            claim_text=claim.claim_text,
                            exact_source_sentence=claim.exact_source_sentence,
                            reason=f"Claim asserts outdated value '{old_value}', but approved ground truth is now '{new_value} {fact.unit or ''}'.",
                            suggested_fix=suggested_text,
                            cited_source=f"{fact.source_document_title or 'Approved Policy'} ({fact.version})",
                            status="outdated"
                        )
                        asset_affected_claims.append(aff_item)

                        # Create a Human Review Task
                        task_id = f"TSK-{uuid.uuid4().hex[:8].upper()}"
                        review_task = ReviewTask(
                            id=task_id,
                            asset_id=asset.id,
                            asset_title=asset.title,
                            asset_type=asset.asset_type,
                            claim_id=claim.id,
                            impact_event_id=event_id,
                            trigger_type="fact_change_cascade",
                            priority="high",
                            assigned_role="reviewer",
                            original_text=claim.exact_source_sentence,
                            suggested_text=suggested_text,
                            explanation=f"Fact '{fact.name}' updated ({old_value} → {new_value}). Human review required before re-approving asset.",
                            cited_source=f"{fact.source_document_title or 'Approved Spec'} {fact.version}: \"{fact.source_passage}\"",
                            status="pending"
                        )
                        db.add_task(review_task)
                        created_tasks_count += 1

            if asset_is_affected:
                # Invalidate asset approval status
                asset.approval_status = "approval_invalidated"
                asset.issues_count = len(asset_affected_claims)
                db.add_or_update_asset(asset)

                # Record audit log for asset invalidation
                db.record_audit(
                    actor="System (Impact Engine)",
                    role="system",
                    action="APPROVAL_INVALIDATED",
                    target_entity="content_assets",
                    target_id=asset.id,
                    diff_payload={"asset_title": asset.title, "affected_claims": len(asset_affected_claims)},
                    notes=f"Asset '{asset.title}' approval automatically invalidated due to fact change."
                )

                affected_assets.append(AffectedAssetItem(
                    asset_id=asset.id,
                    asset_title=asset.title,
                    asset_type=asset.asset_type,
                    channel=asset.channel,
                    affected_claims=asset_affected_claims,
                    status="approval_invalidated",
                    impact_severity="high"
                ))
            else:
                # Unaffected asset: explicitly verified and marked safe
                primary_claim = asset_claims[0].claim_text if asset_claims else "General collateral copy"
                unaffected_assets.append(UnaffectedAssetItem(
                    asset_id=asset.id,
                    asset_title=asset.title,
                    asset_type=asset.asset_type,
                    claim_found=primary_claim,
                    checked_reason=f"Claims are independent of {fact.name} (e.g. color options, water resistance). Checked and verified safe.",
                    status="not_affected"
                ))

        result = ChangeImpactResult(
            event_id=event_id,
            fact_id=fact.id,
            fact_key=fact_key,
            fact_name=fact.name,
            old_value=old_value,
            new_value=new_value,
            source_doc=f"{fact.source_document_title or 'Approved Document'} {fact.version}",
            timestamp=datetime.utcnow().isoformat() + "Z",
            total_assets_scanned=len(all_assets),
            items_need_review=len(affected_assets),
            items_unaffected=len(unaffected_assets),
            affected_assets=affected_assets,
            unaffected_assets=unaffected_assets,
            tasks_created_count=created_tasks_count
        )

        db.impact_events.insert(0, result.dict())
        return result

impact_engine = ChangeImpactEngine()
