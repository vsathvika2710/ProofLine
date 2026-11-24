import base64
import json
import math
import re
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

from .config import settings

MAX_GUEST_TEXT_LENGTH = 20_000
MAX_GUEST_REFERENCE_LENGTH = 10_000
MAX_GUEST_CLAIMS = 25

ClaimType = Literal[
    "warranty",
    "battery",
    "pricing",
    "performance",
    "specification",
    "comparative",
    "promotional",
    "other",
]
EvidenceType = Literal["demonstration", "guest_provided"]
VerificationStatus = Literal["supported", "contradicted", "unsupported", "inconclusive"]
InputMethod = Literal["text", "image", "pdf"]


class GuestProductInfo(BaseModel):
    name: Optional[str] = Field(default=None, max_length=160)
    brand: Optional[str] = Field(default=None, max_length=100)
    category: Optional[str] = Field(default=None, max_length=100)
    model: Optional[str] = Field(default=None, max_length=80)
    identification: Literal["identified", "uncertain"] = "uncertain"


class GuestClaim(BaseModel):
    id: str = Field(default_factory=lambda: f"GCL-{uuid.uuid4().hex[:10]}")
    text: str = Field(min_length=1, max_length=1_000)
    normalized: str = Field(min_length=1, max_length=1_000)
    claim_type: ClaimType = "other"


class GuestTextExtractionRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_GUEST_TEXT_LENGTH)


class GuestProductRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=160)
    brand: Optional[str] = Field(default=None, max_length=100)


class GuestEvidenceRequest(BaseModel):
    product: GuestProductRequest
    claims: list[GuestClaim] = Field(min_length=1, max_length=MAX_GUEST_CLAIMS)
    reference_text: str = Field(default="", max_length=MAX_GUEST_REFERENCE_LENGTH)
    input_method: InputMethod = "text"


class GuestEvidenceItem(BaseModel):
    id: str
    claim_id: str
    source_type: EvidenceType
    source_title: str
    passage: str
    source_url: Optional[str] = None
    retrieved_at: str
    relevance_score: float = Field(ge=0, le=1)
    topic: str


class GuestClaimEvidence(BaseModel):
    claim_id: str
    evidence: list[GuestEvidenceItem]


class GuestEvidenceResponse(BaseModel):
    product_name: Optional[str]
    evidence_source_note: str
    claims: list[GuestClaimEvidence]


class GuestClaimFinding(BaseModel):
    claim_id: str
    original_claim: str
    normalized_claim: str
    claim_type: ClaimType
    status: VerificationStatus
    explanation: str
    evidence: list[GuestEvidenceItem]
    suggested_correction: Optional[str] = None
    limitation: Optional[str] = None


class GuestAssessmentResponse(BaseModel):
    product: GuestProductRequest
    input_method: InputMethod
    findings: list[GuestClaimFinding]
    evidence_source_note: str
    assessed_at: str
    processing_notice: str


class GuestProcessingError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


_ACTION_PATTERN = re.compile(
    r"\b(?:provides|offers|delivers|includes|features|has|comes with|is equipped with)\b",
    re.IGNORECASE,
)
_PRODUCT_PATTERN = re.compile(
    r"\b([A-Z][A-Za-z0-9&'-]*(?:\s+[A-Z][A-Za-z0-9&'-]*){1,5})\s+"
    r"(?=(?:provides|offers|delivers|includes|features|has|comes with|is equipped with)\b)"
)
_CLAIM_CUE = re.compile(
    r"\d|warrant|battery|standby|water.?resistan|waterproof|price|cost|msrp|"
    r"performance|speed|faster|slower|longer|shorter|better|than|display|screen|"
    r"camera|weight|weighs|material|storage|memory|power|charging|charge|"
    r"certif|guarantee|best|fastest|durable|resistan|made of|supports|capacity|"
    r"color|colour|finish|connectivity|resolution|processor|"
    r"offers|provides|delivers|features|includes",
    re.IGNORECASE,
)
_NUMBER_PATTERN = re.compile(
    r"(?P<currency>[$€£])?\s*(?P<value>\d+(?:\.\d+)?)\s*[- ]?\s*"
    r"(?P<unit>hours?|hrs?|days?|years?|months?|meters?|metres?|m\b|"
    r"gb|tb|percent|%)?",
    re.IGNORECASE,
)
_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
    "have", "in", "includes", "is", "it", "its", "of", "on", "or", "the",
    "this", "to", "with", "provides", "offers", "delivers", "product",
}

_PUBLIC_DEMONSTRATION_EVIDENCE = (
    {
        "topic": "warranty",
        "source_title": "ProofLine Public Demonstration — Warranty Specification",
        "passage": (
            "All NovaWear SmartWatch X devices include a comprehensive 2-year warranty "
            "from the original date of retail purchase."
        ),
    },
    {
        "topic": "battery",
        "source_title": "ProofLine Public Demonstration — Technical Specification",
        "passage": "Up to 7 days of typical battery life on a single charge.",
    },
    {
        "topic": "battery",
        "source_title": "ProofLine Public Demonstration — Technical Specification",
        "passage": "48-hour standby is available in low power mode.",
    },
    {
        "topic": "water",
        "source_title": "ProofLine Public Demonstration — Technical Specification",
        "passage": (
            "The NovaWear SmartWatch X is rated 5 ATM water resistance, "
            "safe up to 50 meters depth for swimming and splash proofing."
        ),
    },
    {
        "topic": "pricing",
        "source_title": "ProofLine Public Demonstration — Commercial Specification",
        "passage": "The suggested retail price (MSRP) for SmartWatch X is $199 USD.",
    },
    {
        "topic": "color",
        "source_title": "ProofLine Public Demonstration — Finish Specification",
        "passage": "The SmartWatch X is available in Midnight Blue and Silver finishes.",
    },
)

_TOPIC_TERMS = {
    "warranty": {"warranty", "coverage", "guarantee", "replacement", "defect"},
    "battery": {"battery", "runtime", "standby", "charge", "charging", "endurance"},
    "water": {"water", "resistance", "waterproof", "atm", "meters", "metres", "swimming"},
    "pricing": {"price", "pricing", "cost", "msrp", "retail", "usd", "dollar"},
    "color": {"color", "colour", "finish", "blue", "silver"},
}
_CATEGORY_TERMS = (
    ("Smartwatch", ("smartwatch", "smart watch", "watch")),
    ("Phone", ("smartphone", "mobile phone", "phone")),
    ("Laptop", ("laptop", "notebook computer")),
    ("Headphones", ("headphones", "earbuds", "headset")),
    ("Camera", ("camera",)),
)


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _claim_type(text: str) -> ClaimType:
    lower = text.lower()
    if "warrant" in lower or "coverage" in lower or "guarantee" in lower:
        return "warranty"
    if any(term in lower for term in ("battery", "standby", "charging", "charge")):
        return "battery"
    if any(term in lower for term in ("price", "cost", "msrp", "retail", "$", "€", "£")):
        return "pricing"
    if any(term in lower for term in ("faster", "slower", "better", "longer", "shorter", "than")):
        return "comparative"
    if any(term in lower for term in ("best", "fastest", "world's", "#1", "unmatched", "guaranteed")):
        return "promotional"
    if any(term in lower for term in ("water", "meter", "atm", "display", "screen", "storage", "memory")):
        return "specification"
    if re.search(r"\d", lower):
        return "performance"
    return "other"


def _topic(text: str) -> Optional[str]:
    lower = text.lower()
    for topic, terms in _TOPIC_TERMS.items():
        if any(term in lower for term in terms):
            return topic
    return None


def _product_info(text: str) -> GuestProductInfo:
    match = _PRODUCT_PATTERN.search(text)
    name = _normalize(match.group(1)) if match else None
    if name:
        name = re.sub(r"^(?:our|the|this|new)\s+", "", name, flags=re.IGNORECASE)
        if not name or name.lower() in {"our", "the", "this", "new"}:
            name = None

    explicit_model = re.search(
        r"\b(?:model|variant)\s*(?:number|name)?\s*(?:is|:)?\s*([A-Za-z0-9-]{1,40})",
        text,
        re.IGNORECASE,
    )
    model = explicit_model.group(1) if explicit_model else None
    if not model and name:
        last_word = name.split()[-1]
        if re.fullmatch(r"(?:[A-Z]|\d{1,4}|[A-Z]\d{1,4}|Pro|Plus|Ultra|Mini)", last_word):
            model = last_word

    brand = None
    if name:
        candidate = name.split()[0]
        if candidate.lower() not in {"the", "this", "our", "new"} and len(name.split()) > 1:
            brand = candidate

    category = None
    searchable = f"{name or ''} {text}".lower()
    for label, terms in _CATEGORY_TERMS:
        if any(term in searchable for term in terms):
            category = label
            break

    return GuestProductInfo(
        name=name,
        brand=brand,
        category=category,
        model=model,
        identification="identified" if name else "uncertain",
    )


def _claims_from_fragments(fragments: list[str]) -> list[GuestClaim]:
    claims: list[GuestClaim] = []
    seen: set[str] = set()
    for fragment in fragments:
        cleaned = _normalize(fragment).strip(" ,;:-")
        if len(cleaned) < 8 or len(cleaned) > 1_000 or not _CLAIM_CUE.search(cleaned):
            continue
        key = cleaned.casefold()
        if key in seen:
            continue
        seen.add(key)
        claims.append(
            GuestClaim(
                text=cleaned,
                normalized=cleaned,
                claim_type=_claim_type(cleaned),
            )
        )
        if len(claims) >= MAX_GUEST_CLAIMS:
            break
    return claims


def extract_guest_text(text: str) -> dict:
    cleaned = text.strip()
    if not cleaned:
        raise GuestProcessingError(422, "Enter product text before extracting claims.")
    if len(cleaned) > MAX_GUEST_TEXT_LENGTH:
        raise GuestProcessingError(413, "Text is too long. The maximum is 20,000 characters.")

    fragments: list[str] = []
    for sentence in re.findall(r"[^.!?\n]+[.!?]?", cleaned):
        pieces = re.split(r",\s+|\s+(?:and|while|but)\s+", sentence, flags=re.IGNORECASE)
        fragments.extend(pieces)

    claims = _claims_from_fragments(fragments)
    omitted_long_claim = any(
        len(_normalize(fragment).strip(" ,;:-")) > 1_000 and _CLAIM_CUE.search(fragment)
        for fragment in fragments
    )
    notice = (
        "Text was processed with deterministic local rules. Review and edit the product "
        "details and claims before verification."
    )
    if omitted_long_claim:
        notice += " One or more claim passages over 1,000 characters were omitted; add a shorter version manually if needed."

    return {
        "input_method": "text",
        "source_text": cleaned,
        "product": _product_info(cleaned),
        "claims": claims,
        "extraction_notice": notice,
    }


def extract_guest_pdf(file_bytes: bytes) -> str:
    try:
        import fitz
    except ImportError as exc:
        raise GuestProcessingError(503, "PDF text extraction is not available on this server.") from exc

    try:
        document = fitz.open(stream=file_bytes, filetype="pdf")
        if document.page_count > 50:
            document.close()
            raise GuestProcessingError(413, "PDFs are limited to 50 pages.")
        text_parts = []
        for page in document:
            text_parts.append(page.get_text())
        document.close()
    except GuestProcessingError:
        raise
    except Exception as exc:
        raise GuestProcessingError(422, "This PDF could not be opened or read.") from exc

    text = "\n".join(text_parts).strip()
    readable_characters = re.sub(r"[^A-Za-z0-9]", "", text)
    if len(readable_characters) < 20:
        raise GuestProcessingError(
            422,
            "No readable text was found. This may be a scanned or image-only PDF; no OCR service is configured.",
        )
    return text[:MAX_GUEST_TEXT_LENGTH]


def extract_guest_image(file_bytes: bytes, mime_type: str) -> dict:
    if not settings.has_gemini_key:
        raise GuestProcessingError(
            503,
            "Image extraction is unavailable because server-side image analysis is not configured. "
            "Paste the product text or upload a readable PDF instead.",
        )

    prompt = (
        "Read the product information visible in this image. Return only JSON with this shape: "
        '{"product":{"name":string|null,"brand":string|null,"category":string|null,'
        '"model":string|null},"claims":[string]}. Extract only text and claims actually visible. '
        "Do not infer missing specifications, evidence, or product details. Use an empty claims "
        "array if no product claims are readable."
    )
    body = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64.b64encode(file_bytes).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }
    request = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
        f"?key={settings.gemini_api_key}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            payload = json.loads(response.read(256_000).decode("utf-8"))
        raw = payload["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(raw)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise GuestProcessingError(502, "Image analysis did not complete. Please try again or use text/PDF input.") from exc
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise GuestProcessingError(502, "Image analysis returned an unreadable response. Please try another input method.") from exc

    if not isinstance(result, dict):
        raise GuestProcessingError(502, "Image analysis returned invalid data. Please try another input method.")
    product_data = result.get("product") or {}
    if not isinstance(product_data, dict):
        raise GuestProcessingError(502, "Image analysis returned invalid product data. Please try another input method.")
    product = GuestProductInfo(
        name=_safe_optional_text(product_data.get("name"), 160),
        brand=_safe_optional_text(product_data.get("brand"), 100),
        category=_safe_optional_text(product_data.get("category"), 100),
        model=_safe_optional_text(product_data.get("model"), 80),
        identification="identified" if product_data.get("name") else "uncertain",
    )
    raw_claims = result.get("claims")
    if not isinstance(raw_claims, list) or len(raw_claims) > MAX_GUEST_CLAIMS:
        raise GuestProcessingError(502, "Image analysis returned invalid claim data. Please try another input method.")
    fragments = [claim for claim in raw_claims if isinstance(claim, str) and len(claim) <= 1_000]
    claims = _claims_from_fragments(fragments)
    return {
        "input_method": "image",
        "source_text": "\n".join(claim.text for claim in claims),
        "product": product,
        "claims": claims,
        "extraction_notice": (
            "Image text was analyzed by the server-configured Google Gemini service. "
            "The extraction may be incomplete; review all details before verification."
        ),
    }


def _safe_optional_text(value: object, max_length: int) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = _normalize(value)
    return cleaned[:max_length] or None


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", text.lower())
        if len(token) > 1 and token not in _STOP_WORDS
    }


def _is_public_demo_product(product: GuestProductRequest) -> bool:
    identifying_text = f"{product.brand or ''} {product.name or ''}".lower()
    return bool(
        re.search(r"\bnovawear\b", identifying_text)
        or re.search(r"\bsmart\s?watch\s+x\b", identifying_text)
    )


def _reference_passages(reference_text: str) -> list[str]:
    return [
        _normalize(part)
        for part in re.split(r"[\n.!?]+", reference_text)
        if _normalize(part)
    ]


def _relevance_score(claim: str, passage: str, topic: str) -> float:
    claim_topic = _topic(claim)
    if claim_topic and topic in _TOPIC_TERMS and claim_topic != topic:
        return 0.0
    if claim_topic == "battery" and topic == "battery":
        claim_is_standby = bool(re.search(r"\bstandby\b", claim, re.IGNORECASE))
        passage_is_standby = bool(re.search(r"\bstandby\b", passage, re.IGNORECASE))
        if claim_is_standby != passage_is_standby:
            return 0.0
    if claim_topic and claim_topic == topic:
        return 0.92
    passage_tokens = _tokens(passage)
    claim_tokens = _tokens(claim)
    if not claim_tokens or not passage_tokens:
        return 0.0
    overlap = claim_tokens.intersection(passage_tokens)
    if not overlap:
        return 0.0
    return min(0.85, len(overlap) / max(len(claim_tokens), 1))


def retrieve_guest_evidence(
    product: GuestProductRequest,
    claims: list[GuestClaim],
    reference_text: str = "",
) -> list[GuestClaimEvidence]:
    retrieved_at = datetime.now(timezone.utc).isoformat()
    demo_product_available = _is_public_demo_product(product)
    references = _reference_passages(reference_text[:MAX_GUEST_REFERENCE_LENGTH])
    results: list[GuestClaimEvidence] = []

    for claim in claims:
        evidence: list[GuestEvidenceItem] = []
        claim_topic = _topic(claim.text)
        if demo_product_available:
            for entry_index, entry in enumerate(_PUBLIC_DEMONSTRATION_EVIDENCE):
                score = _relevance_score(claim.text, entry["passage"], entry["topic"])
                if score >= 0.2:
                    evidence.append(
                        GuestEvidenceItem(
                            id=f"DEMO-{entry['topic']}-{entry_index}",
                            claim_id=claim.id,
                            source_type="demonstration",
                            source_title=entry["source_title"],
                            passage=entry["passage"],
                            source_url=None,
                            retrieved_at=retrieved_at,
                            relevance_score=score,
                            topic=entry["topic"],
                        )
                    )

        for index, passage in enumerate(references):
            topic = _topic(passage) or "other"
            score = _relevance_score(claim.text, passage, topic)
            if score >= 0.2:
                evidence.append(
                    GuestEvidenceItem(
                        id=f"GUEST-{index + 1}",
                        claim_id=claim.id,
                        source_type="guest_provided",
                        source_title="Guest-provided reference",
                        passage=passage[:2_000],
                        source_url=None,
                        retrieved_at=retrieved_at,
                        relevance_score=score,
                        topic=topic,
                    )
                )

        results.append(GuestClaimEvidence(claim_id=claim.id, evidence=evidence[:6]))
    return results


def _numeric_values(text: str) -> list[tuple[float, str, str]]:
    values = []
    for match in _NUMBER_PATTERN.finditer(text):
        unit = (match.group("unit") or "").lower()
        currency = match.group("currency") or ""
        if currency:
            unit = "usd" if currency == "$" else "eur" if currency == "€" else "gbp"
        elif unit in {"hr", "hrs", "hour"}:
            unit = "hours"
        elif unit == "day":
            unit = "days"
        elif unit in {"yr", "year"}:
            unit = "years"
        elif unit in {"month"}:
            unit = "months"
        elif unit in {"meter", "metre", "m"}:
            unit = "meters"
        elif unit == "%":
            unit = "percent"
        context = text[max(0, match.start() - 55): min(len(text), match.end() + 55)].lower()
        values.append((float(match.group("value")), unit, context))
    return values


def _contradicts_negation(claim: str, evidence_text: str) -> bool:
    negation_pattern = re.compile(
        r"\b(?:not|no|never|without|does\s+not|doesn't|is\s+not|isn't)\b",
        re.IGNORECASE,
    )
    claim_has_negation = bool(negation_pattern.search(claim))
    evidence_has_negation = bool(negation_pattern.search(evidence_text))
    return claim_has_negation != evidence_has_negation


def _canonical_numeric(value: float, unit: str) -> tuple[str, float] | None:
    if unit in {"hours", "days"}:
        return "time", value * (24 if unit == "days" else 1)
    if unit in {"years", "months"}:
        return "calendar_time", value * (12 if unit == "years" else 1)
    if unit:
        return unit, value
    return None


def _assess_claim(
    claim: GuestClaim,
    evidence: list[GuestEvidenceItem],
) -> GuestClaimFinding:
    if not evidence:
        return GuestClaimFinding(
            claim_id=claim.id,
            original_claim=claim.text,
            normalized_claim=claim.normalized,
            claim_type=claim.claim_type,
            status="unsupported",
            explanation=(
                "No relevant evidence was found in the public demonstration collection or "
                "the reference text supplied by the guest. This is absence of evidence, not "
                "proof that the claim is false."
            ),
            evidence=[],
            limitation="No live web search is configured, and no permitted evidence matched this claim.",
        )

    if _contradicts_negation(claim.text, " ".join(item.passage for item in evidence)):
        return GuestClaimFinding(
            claim_id=claim.id,
            original_claim=claim.text,
            normalized_claim=claim.normalized,
            claim_type=claim.claim_type,
            status="contradicted",
            explanation="The claim's negation conflicts with the wording in the supplied evidence.",
            evidence=evidence,
            suggested_correction=evidence[0].passage,
        )

    claim_values = _numeric_values(claim.text)
    evidence_values = [
        value
        for item in evidence
        for value in _numeric_values(item.passage)
    ]
    if claim_values:
        for claim_value, claim_unit, claim_context in claim_values:
            claim_canonical = _canonical_numeric(claim_value, claim_unit)
            compatible = [
                (item, _canonical_numeric(item[0], item[1]))
                for item in evidence_values
            ]
            compatible = [
                (item, canonical)
                for item, canonical in compatible
                if claim_canonical
                and canonical
                and canonical[0] == claim_canonical[0]
            ]
            if not compatible:
                other_units = [item for item in evidence_values if item[1] and item[1] != claim_unit]
                if other_units:
                    return GuestClaimFinding(
                        claim_id=claim.id,
                        original_claim=claim.text,
                        normalized_claim=claim.normalized,
                        claim_type=claim.claim_type,
                        status="inconclusive",
                        explanation="Relevant evidence uses a different measurement unit; the values cannot be compared reliably.",
                        evidence=evidence,
                        limitation="No unit conversion or contextual equivalence was assumed.",
                    )
                continue

            distinct_values = {round(canonical[1], 8) for _, canonical in compatible}
            if len(distinct_values) > 1:
                return GuestClaimFinding(
                    claim_id=claim.id,
                    original_claim=claim.text,
                    normalized_claim=claim.normalized,
                    claim_type=claim.claim_type,
                    status="inconclusive",
                    explanation="The available evidence contains multiple values for this measurement, so the claim needs contextual review.",
                    evidence=evidence,
                    limitation="The result does not choose between condition-dependent values.",
                )

            reference_item, reference_canonical = compatible[0]
            reference_value, reference_unit = reference_item[0], reference_item[1]
            if math.isclose(claim_canonical[1], reference_canonical[1], rel_tol=1e-9, abs_tol=1e-9):
                if (
                    _topic(claim.text) == "battery"
                    and "battery life" in claim_context
                    and "standby" in reference_item[2]
                    and "battery life" not in reference_item[2]
                ):
                    return GuestClaimFinding(
                        claim_id=claim.id,
                        original_claim=claim.text,
                        normalized_claim=claim.normalized,
                        claim_type=claim.claim_type,
                        status="inconclusive",
                        explanation="The matching number describes standby time, not the claimed typical battery life.",
                        evidence=evidence,
                        limitation="Do not treat a standby specification as typical battery runtime.",
                    )
                return GuestClaimFinding(
                    claim_id=claim.id,
                    original_claim=claim.text,
                    normalized_claim=claim.normalized,
                    claim_type=claim.claim_type,
                    status="supported",
                    explanation=f"The claim's value ({claim_value:g} {claim_unit}) matches the relevant evidence.",
                    evidence=evidence,
                )

            correction = evidence[0].passage if len(distinct_values) == 1 else None
            return GuestClaimFinding(
                claim_id=claim.id,
                original_claim=claim.text,
                normalized_claim=claim.normalized,
                claim_type=claim.claim_type,
                status="contradicted",
                explanation=(
                    f"The claim states {claim_value:g} {claim_unit}, while the relevant "
                        f"evidence states {reference_value:g} {reference_unit}."
                ),
                evidence=evidence,
                suggested_correction=correction,
            )

        return GuestClaimFinding(
            claim_id=claim.id,
            original_claim=claim.text,
            normalized_claim=claim.normalized,
            claim_type=claim.claim_type,
            status="inconclusive",
            explanation="Relevant evidence was found, but it does not contain a comparable value and unit.",
            evidence=evidence,
            limitation="Numeric comparison was not possible.",
        )

    claim_terms = _tokens(claim.text)
    combined_passages = " ".join(item.passage for item in evidence).lower()
    if claim_terms and all(term in _tokens(combined_passages) for term in claim_terms):
        return GuestClaimFinding(
            claim_id=claim.id,
            original_claim=claim.text,
            normalized_claim=claim.normalized,
            claim_type=claim.claim_type,
            status="supported",
            explanation="The substantive claim wording is present in the relevant evidence.",
            evidence=evidence,
        )

    return GuestClaimFinding(
        claim_id=claim.id,
        original_claim=claim.text,
        normalized_claim=claim.normalized,
        claim_type=claim.claim_type,
        status="inconclusive",
        explanation="Related evidence was found, but it does not establish or directly contradict the full claim.",
        evidence=evidence,
        limitation="A human should review context and wording before relying on this result.",
    )


def build_guest_evidence_response(
    product: GuestProductRequest,
    claims: list[GuestClaim],
    reference_text: str,
) -> GuestEvidenceResponse:
    return GuestEvidenceResponse(
        product_name=product.name,
        evidence_source_note=(
            "Guest mode searches only the fictional public demonstration collection and "
            "reference text supplied in this session. It does not search the Office Evidence Vault or the live web."
        ),
        claims=retrieve_guest_evidence(product, claims, reference_text),
    )


def assess_guest_claims(
    product: GuestProductRequest,
    claims: list[GuestClaim],
    reference_text: str = "",
    input_method: InputMethod = "text",
) -> GuestAssessmentResponse:
    normalized_claims = [
        claim.model_copy(
            update={
                "normalized": _normalize(claim.text),
                "claim_type": _claim_type(claim.text),
            }
        )
        for claim in claims
    ]
    evidence_by_claim = retrieve_guest_evidence(product, normalized_claims, reference_text)
    evidence_map = {entry.claim_id: entry.evidence for entry in evidence_by_claim}
    findings = [
        _assess_claim(claim, evidence_map.get(claim.id, []))
        for claim in normalized_claims
    ]
    return GuestAssessmentResponse(
        product=product,
        input_method=input_method,
        findings=findings,
        evidence_source_note=(
            "Assessment used only explicitly labeled fictional demonstration evidence and/or "
            "reference text supplied by the guest. No Office Mode data or live web search was used."
        ),
        assessed_at=datetime.now(timezone.utc).isoformat(),
        processing_notice=(
            "Results are deterministic comparisons for demonstration purposes, not a legal, "
            "regulatory, or scientific certification."
        ),
    )
