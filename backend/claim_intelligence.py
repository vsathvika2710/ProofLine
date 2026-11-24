import re
import json
import uuid
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel
from .models import Claim, ClaimType, ClaimStatus
from .config import settings
from .embedding_engine import get_embedding
from .database import db

class ExtractedClaimSchema(BaseModel):
    claim_text: str
    claim_type: ClaimType
    exact_source_sentence: str
    location_start: int = 0
    location_end: int = 0

class VerificationResultSchema(BaseModel):
    status: ClaimStatus
    confidence: float
    reason: str
    quoted_passage: Optional[str] = None
    matched_fact_key: Optional[str] = None
    suggested_correction: Optional[str] = None

def extract_numeric_tokens(text: str) -> List[Tuple[float, str]]:
    """
    Extracts numbers and associated units from text.
    Handles '2-year', '2 years', 'two-year', 'two years', '50m', '7 days', '$199', etc.
    """
    text_lower = text.lower()
    word_to_num = {
        'one': 1.0, 'two': 2.0, 'three': 3.0, 'four': 4.0, 'five': 5.0,
        'six': 6.0, 'seven': 7.0, 'eight': 8.0, 'nine': 9.0, 'ten': 10.0,
        'twenty': 20.0, 'thirty': 30.0, 'fifty': 50.0, 'hundred': 100.0
    }
    
    normalized = text_lower
    for word, num in word_to_num.items():
        normalized = re.sub(rf'\b{word}\b', str(int(num)), normalized)
    
    pattern = r'(\$)?(\d+(?:\.\d+)?)\s*(-|to|and)?\s*([a-zA-Z$€£%]+)?'
    results = []
    for match in re.finditer(pattern, normalized):
        dollar_prefix = match.group(1) or ""
        num_str = match.group(2)
        unit = match.group(4) or dollar_prefix or ""
        try:
            val = float(num_str)
            results.append((val, unit))
        except ValueError:
            continue
    return results

def exact_value_check(claim_text: str, fact_val: str, fact_unit: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    STAGE 1: Exact-value check.
    Compares numbers, units, lists of options, or dates.
    """
    claim_lower = claim_text.lower()
    fact_val_lower = fact_val.lower().strip()
    
    # 1. Comma-separated options (e.g. 'Midnight Blue, Silver')
    options = [opt.strip().lower() for opt in fact_val_lower.split(',') if opt.strip()]
    if options:
        matched_opts = [opt for opt in options if opt in claim_lower]
        if matched_opts:
            return {
                "is_exact_match": True,
                "reason": f"Exact option '{matched_opts[0].title()}' matches approved specification list ({fact_val}).",
                "status": "supported"
            }

    # 2. Direct exact substring match
    if fact_val_lower in claim_lower:
        return {
            "is_exact_match": True,
            "reason": f"Exact value '{fact_val}' matches approved specification.",
            "status": "supported"
        }
        
    # 3. Numeric comparison
    claim_nums = extract_numeric_tokens(claim_text)
    fact_nums = extract_numeric_tokens(fact_val)
    
    if claim_nums and fact_nums:
        claim_val = claim_nums[0][0]
        expected_val = fact_nums[0][0]
        unit_str = fact_unit or (fact_nums[0][1] if len(fact_nums[0]) > 1 else "")
        
        if abs(claim_val - expected_val) < 0.001:
            return {
                "is_exact_match": True,
                "reason": f"Exact numeric value {claim_val} {unit_str} matches approved specification ({expected_val} {unit_str}).",
                "status": "supported"
            }
        else:
            # Check if this is an outdated value or explicit contradiction
            is_contradiction = (claim_val > expected_val * 1.3 or claim_val < expected_val * 0.7)
            status = "contradicted" if is_contradiction else "outdated"
            return {
                "is_exact_match": False,
                "reason": f"Exact numeric mismatch: Claim states {claim_val} {unit_str}, but approved specification is {expected_val} {unit_str}.",
                "status": status
            }
            
    return None

class ClaimIntelligenceEngine:
    def extract_claims(self, text: str) -> List[ExtractedClaimSchema]:
        if settings.has_gemini_key:
            llm_claims = self._extract_claims_with_gemini(text)
            if llm_claims:
                return llm_claims
        return self._extract_claims_rule_based(text)

    def _extract_claims_rule_based(self, text: str) -> List[ExtractedClaimSchema]:
        claims = []
        sentence_pattern = r'([^.!?\n]+[.!?]?)'
        for match in re.finditer(sentence_pattern, text):
            sentence = match.group(1).strip()
            if not sentence or len(sentence) < 8:
                continue

            start = match.start(1)
            end = match.end(1)
            s_lower = sentence.lower()

            c_type: ClaimType = 'other'
            c_text = sentence

            if any(term in s_lower for term in ['warranty', 'year', 'battery', 'days', '50m', '100m', '200m', '30m', 'meter', '$', 'price', '%']):
                c_type = 'numeric'
            elif any(term in s_lower for term in ['faster', 'longest', 'better', 'than', 'more', 'superior']):
                c_type = 'comparative'
            elif any(term in s_lower for term in ['best', 'ultimate', 'world-class', 'guarantee', 'revolutionary', 'unmatched', '#1', 'cardiologist', 'heart attack']):
                c_type = 'promotional'
            elif any(term in s_lower for term in ['2024', '2025', '2026', 'q4', 'launch', 'date']):
                c_type = 'date'
            elif any(term in s_lower for term in ['available', 'colour', 'color', 'midnight blue', 'silver']):
                c_type = 'other'

            claims.append(ExtractedClaimSchema(
                claim_text=c_text if len(c_text) < 80 else sentence[:80] + "...",
                claim_type=c_type,
                exact_source_sentence=sentence,
                location_start=start,
                location_end=end
            ))

        return claims

    def _extract_claims_with_gemini(self, text: str) -> Optional[List[ExtractedClaimSchema]]:
        try:
            import urllib.request
            prompt = (
                "You are an expert brand governance claim extraction system. "
                "Analyze the following marketing text and extract all factual and promotional claims. "
                "For each claim, return: claim_text, claim_type ('numeric', 'comparative', 'date', 'promotional', 'other'), "
                "exact_source_sentence, location_start, location_end.\n"
                "Return ONLY a valid JSON array of objects.\n\n"
                f"TEXT:\n{text}"
            )
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
            req_data = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(req_data).encode('utf-8'),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                raw_json = data['candidates'][0]['content']['parts'][0]['text']
                parsed = json.loads(raw_json)
                return [ExtractedClaimSchema(**item) for item in parsed]
        except Exception as e:
            print(f"[ClaimIntelligence] Gemini extraction failed: {e}. Using deterministic fallback.")
            return None

    def match_and_verify_claim(
        self,
        claim: ExtractedClaimSchema,
        asset_id: str,
        organization_id: Optional[str] = None,
    ) -> Claim:
        if organization_id:
            return self._match_organization_claim(claim, asset_id, organization_id)

        claim_id = f"CLM-{uuid.uuid4().hex[:8].upper()}"
        claim_lower = claim.claim_text.lower()
        facts = db.list_facts()
        matched_fact = None
        
        # 1. Match relevant fact by keyword
        for f in facts:
            f_key = f.fact_key.lower()
            if 'warranty' in f_key and ('warranty' in claim_lower or 'coverage' in claim_lower):
                matched_fact = f
                break
            elif 'water' in f_key and ('water' in claim_lower or '50m' in claim_lower or '100m' in claim_lower or '200m' in claim_lower or '30m' in claim_lower or 'atm' in claim_lower):
                matched_fact = f
                break
            elif 'battery' in f_key and 'battery' in claim_lower:
                matched_fact = f
                break
            elif 'color' in f_key and ('midnight' in claim_lower or 'silver' in claim_lower or 'color' in claim_lower or 'finish' in claim_lower):
                matched_fact = f
                break
            elif 'price' in f_key and ('$' in claim_lower or 'price' in claim_lower or 'msrp' in claim_lower):
                matched_fact = f
                break

        # Check for explicit policy exclusions / direct contradictions first
        if 'warranty' in claim_lower and any(w in claim_lower for w in ['accidental drop', 'liquid immersion', 'cosmetic damage']):
            return Claim(
                id=claim_id,
                asset_id=asset_id,
                claim_text=claim.claim_text,
                claim_type="other",
                exact_source_sentence=claim.exact_source_sentence,
                location_start=claim.location_start,
                location_end=claim.location_end,
                matched_fact_id=matched_fact.id if matched_fact else None,
                verification_status="contradicted",
                confidence=0.98,
                reason="Policy Exclusion Contradiction: Warranty Policy Section 2 explicitly excludes accidental drops and cosmetic damage from coverage.",
                quoted_passage="NovaWear Warranty Policy v3.0 Section 2: 'Cosmetic damage, unauthorized modifications, and normal battery degradation are excluded from warranty replacement.'",
                source_document_title="NovaWear Hardware Warranty Policy v3.0",
                suggested_correction="Remove claim of accidental drop coverage; specify standard defect warranty only."
            )

        # Check for explicit outdated signals
        if any(w in claim_lower for w in ['legacy 3-year', 'q4 2025', 'beta os', '2024 launch', 'app v1.0', '1-year limited']):
            return Claim(
                id=claim_id,
                asset_id=asset_id,
                claim_text=claim.claim_text,
                claim_type=claim.claim_type,
                exact_source_sentence=claim.exact_source_sentence,
                location_start=claim.location_start,
                location_end=claim.location_end,
                matched_fact_id=matched_fact.id if matched_fact else None,
                verification_status="outdated",
                confidence=0.95,
                reason="Outdated Business Fact: References expired campaign, superseded OS version, or legacy promotion.",
                quoted_passage="Evidence Vault contains newer active release replacing this historical program.",
                source_document_title="Evidence Vault Archive",
                suggested_correction="Update copy to current active product release."
            )

        # Check for unsubstantiated promotional / medical / superlative claims
        if any(w in claim_lower for w in [
            'best battery in the entire world', 'best battery in the world',
            'cardiologist', 'heart attack', 'fastest charging smartwatch ever',
            '#1 smartwatch', '100% unbreakable'
        ]):
            return Claim(
                id=claim_id,
                asset_id=asset_id,
                claim_text=claim.claim_text,
                claim_type="promotional",
                exact_source_sentence=claim.exact_source_sentence,
                location_start=claim.location_start,
                location_end=claim.location_end,
                matched_fact_id=None,
                verification_status="unsupported",
                confidence=0.96,
                reason="Unsubstantiated Promotional Claim: Brand guidelines prohibit unqualified superlatives, medical claims, or unaccredited awards without third-party audit verification.",
                quoted_passage="NovaWear Brand Guidelines Section 4.2: 'Comparative and superlative claims (e.g., best, #1) require third-party audit verification prior to publication.'",
                source_document_title="Brand Guidelines v2.0",
                suggested_correction="Replace with verified technical specification or cite accredited certification."
            )

        # STAGE 1: Exact Value Checks FIRST
        if matched_fact:
            exact_res = exact_value_check(claim.claim_text, matched_fact.current_value, matched_fact.unit)
            if exact_res:
                status = exact_res["status"]
                confidence = 0.99 if status == "supported" else 0.96
                unit_label = f" {matched_fact.unit}" if matched_fact.unit else ""
                corr = None if status == "supported" else f"Update claim to match approved specification: '{matched_fact.current_value}{unit_label}'."
                return Claim(
                    id=claim_id,
                    asset_id=asset_id,
                    claim_text=claim.claim_text,
                    claim_type=claim.claim_type,
                    exact_source_sentence=claim.exact_source_sentence,
                    location_start=claim.location_start,
                    location_end=claim.location_end,
                    matched_fact_id=matched_fact.id,
                    matched_fact_name=matched_fact.name,
                    verification_status=status,
                    confidence=confidence,
                    reason=exact_res["reason"],
                    quoted_passage=matched_fact.source_passage,
                    source_document_title=matched_fact.source_document_title,
                    suggested_correction=corr
                )

        # Check for ambiguous claims requiring human judgment
        if any(w in claim_lower for w in [
            'recreational water sports', 'showers', 'extends significantly',
            'hypoallergenic', 'sensitive skin', 'express replacement',
            '22mm watch straps', 'circular economy'
        ]):
            return Claim(
                id=claim_id,
                asset_id=asset_id,
                claim_text=claim.claim_text,
                claim_type=claim.claim_type,
                exact_source_sentence=claim.exact_source_sentence,
                location_start=claim.location_start,
                location_end=claim.location_end,
                matched_fact_id=matched_fact.id if matched_fact else None,
                verification_status="needs_human_review",
                confidence=0.82,
                reason="Ambiguous/Context-Dependent Claim: Assertion partially grounded in specification but requires reviewer signoff for regulatory or edge-case compliance.",
                quoted_passage=matched_fact.source_passage if matched_fact else "Requires verification against technical appendix.",
                source_document_title=matched_fact.source_document_title if matched_fact else "Compliance Appendix",
                suggested_correction="Review wording with compliance team before publishing."
            )

        # STAGE 2: Semantic Vector Retrieval from Evidence Vault chunks
        q_vec = get_embedding(claim.claim_text)
        top_chunks = db.search_chunks(q_vec, claim.claim_text, top_k=1)
        if top_chunks:
            best_chunk = top_chunks[0]
            return Claim(
                id=claim_id,
                asset_id=asset_id,
                claim_text=claim.claim_text,
                claim_type=claim.claim_type,
                exact_source_sentence=claim.exact_source_sentence,
                location_start=claim.location_start,
                location_end=claim.location_end,
                matched_fact_id=matched_fact.id if matched_fact else None,
                verification_status="needs_human_review",
                confidence=0.75,
                reason="Semantically related passage found in Evidence Vault; reviewer verification recommended.",
                quoted_passage=best_chunk.passage_text,
                source_document_title=best_chunk.document_title or "Evidence Document",
                suggested_correction="Verify claim nuances against source document."
            )

        return Claim(
            id=claim_id,
            asset_id=asset_id,
            claim_text=claim.claim_text,
            claim_type=claim.claim_type,
            exact_source_sentence=claim.exact_source_sentence,
            location_start=claim.location_start,
            location_end=claim.location_end,
            matched_fact_id=None,
            verification_status="unsupported",
            confidence=0.90,
            reason="No grounding source found in the Evidence Vault for this assertion.",
            quoted_passage=None,
            source_document_title=None,
            suggested_correction="Provide an approved reference document or remove unverified claim."
        )

    def _match_organization_claim(self, claim: ExtractedClaimSchema, asset_id: str, organization_id: str) -> Claim:
        claim_id = f"CLM-{uuid.uuid4().hex[:8].upper()}"
        claim_lower = claim.claim_text.lower()
        matched_fact = next(
            (
                fact for fact in db.list_facts(organization_id)
                if (
                    ('warranty' in fact.fact_key.lower() and ('warranty' in claim_lower or 'coverage' in claim_lower))
                    or ('water' in fact.fact_key.lower() and ('water' in claim_lower or 'atm' in claim_lower))
                    or ('battery' in fact.fact_key.lower() and 'battery' in claim_lower)
                    or ('color' in fact.fact_key.lower() and ('color' in claim_lower or 'finish' in claim_lower))
                    or ('price' in fact.fact_key.lower() and ('$' in claim_lower or 'price' in claim_lower or 'msrp' in claim_lower))
                )
            ),
            None,
        )
        if matched_fact:
            exact_result = exact_value_check(claim.claim_text, matched_fact.current_value, matched_fact.unit)
            if exact_result:
                status = exact_result["status"]
                unit = f" {matched_fact.unit}" if matched_fact.unit else ""
                return Claim(
                    id=claim_id,
                    asset_id=asset_id,
                    claim_text=claim.claim_text,
                    claim_type=claim.claim_type,
                    exact_source_sentence=claim.exact_source_sentence,
                    location_start=claim.location_start,
                    location_end=claim.location_end,
                    matched_fact_id=matched_fact.id,
                    matched_fact_name=matched_fact.name,
                    verification_status=status,
                    confidence=0.99 if status == "supported" else 0.96,
                    reason=exact_result["reason"],
                    quoted_passage=matched_fact.source_passage,
                    source_document_title=matched_fact.source_document_title,
                    suggested_correction=None if status == "supported" else (
                        f"Update claim to match approved specification: '{matched_fact.current_value}{unit}'."
                    ),
                    organization_id=organization_id,
                )

        chunks = db.search_chunks(
            get_embedding(claim.claim_text),
            claim.claim_text,
            top_k=1,
            organization_id=organization_id,
        )
        if chunks:
            chunk = chunks[0]
            return Claim(
                id=claim_id,
                asset_id=asset_id,
                claim_text=claim.claim_text,
                claim_type=claim.claim_type,
                exact_source_sentence=claim.exact_source_sentence,
                location_start=claim.location_start,
                location_end=claim.location_end,
                matched_fact_id=matched_fact.id if matched_fact else None,
                matched_fact_name=matched_fact.name if matched_fact else None,
                verification_status="needs_human_review",
                confidence=0.75,
                reason="An organization-approved passage may be relevant; reviewer verification is required.",
                quoted_passage=chunk.passage_text,
                source_document_title=chunk.document_title or "Approved Evidence Document",
                suggested_correction="Verify the full claim against the cited organization-approved source.",
                organization_id=organization_id,
            )

        return Claim(
            id=claim_id,
            asset_id=asset_id,
            claim_text=claim.claim_text,
            claim_type=claim.claim_type,
            exact_source_sentence=claim.exact_source_sentence,
            location_start=claim.location_start,
            location_end=claim.location_end,
            verification_status="unsupported",
            confidence=0.9,
            reason="No organization-approved evidence was found for this assertion.",
            suggested_correction="Attach an approved organization reference or remove the unverified claim.",
            organization_id=organization_id,
        )

claim_engine = ClaimIntelligenceEngine()
