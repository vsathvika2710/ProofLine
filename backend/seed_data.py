import uuid
from datetime import datetime
from .models import (
    EvidenceDocument,
    EvidenceChunk,
    StructuredFact,
    ContentAsset,
    Claim
)
from .database import db
from .document_parser import chunk_document
from .embedding_engine import get_embedding

def load_seed_workspace():
    """
    Seeds the NovaWear / SmartWatch X demo dataset.
    """
    db.reset()

    # 1. Approved Evidence Documents
    doc1 = EvidenceDocument(
        id="DOC-WTY-01",
        title="NovaWear Hardware Warranty Policy v3.0",
        doc_type="pdf",
        owner="Legal & Compliance",
        version="v3.0",
        approval_status="approved",
        effective_date="2026-01-01",
        expiry_date="2027-12-31",
        raw_text=(
            "NovaWear Hardware Warranty Policy (Version 3.0)\n\n"
            "Section 1. Warranty Coverage Period.\n"
            "All NovaWear SmartWatch X devices include a comprehensive 2-year warranty from the original date of retail purchase. "
            "This warranty covers defects in materials and workmanship under normal consumer use.\n\n"
            "Section 2. Exclusions & Limitations.\n"
            "Cosmetic damage, unauthorized modifications, and normal battery degradation are excluded from warranty replacement."
        ),
        created_at=datetime.utcnow().isoformat() + "Z"
    )

    doc2 = EvidenceDocument(
        id="DOC-SPEC-02",
        title="SmartWatch X Technical Specification Sheet",
        doc_type="pdf",
        owner="Hardware Engineering",
        version="v1.4",
        approval_status="approved",
        effective_date="2026-02-15",
        expiry_date="2028-02-15",
        raw_text=(
            "SmartWatch X Technical Specifications (Engineering Release v1.4)\n\n"
            "1. Battery & Power: Up to 7 days of typical battery life on a single charge. 48-hour standby in low power mode.\n"
            "2. Water Resistance: Rated 5 ATM water resistance (safe up to 50 meters depth for swimming and splash proofing). "
            "Not certified for deep scuba diving exceeding 50m.\n"
            "3. Enclosure & Finishes: Available exclusively in Midnight Blue and Silver matte anodized aerospace aluminum."
        ),
        created_at=datetime.utcnow().isoformat() + "Z"
    )

    doc3 = EvidenceDocument(
        id="DOC-PRC-03",
        title="SmartWatch X Global Pricing & Commercial Guidelines",
        doc_type="docx",
        owner="Commercial Finance",
        version="v2.1",
        approval_status="approved",
        effective_date="2026-03-01",
        expiry_date="2026-12-31",
        raw_text=(
            "NovaWear Commercial Guidelines (v2.1)\n\n"
            "Suggested Retail Price (MSRP) for SmartWatch X is $199 USD. "
            "No authorized retailer may advertise below $179 without prior commercial committee signoff."
        ),
        created_at=datetime.utcnow().isoformat() + "Z"
    )

    for doc in [doc1, doc2, doc3]:
        db.add_document(doc)
        # Generate Chunks
        raw_chunks = chunk_document(doc.raw_text, chunk_size=300)
        chunks_objs = []
        for idx, title, passage in raw_chunks:
            chunk_obj = EvidenceChunk(
                id=f"CHK-{uuid.uuid4().hex[:8].upper()}",
                document_id=doc.id,
                document_title=doc.title,
                chunk_index=idx,
                passage_text=passage,
                section_title=title,
                embedding=get_embedding(passage),
                metadata={"owner": doc.owner, "version": doc.version}
            )
            chunks_objs.append(chunk_obj)
        db.add_chunks(chunks_objs)
        doc.chunk_count = len(chunks_objs)

    # 2. Structured Facts
    fact_wty = StructuredFact(
        id="FACT-WTY-01",
        fact_key="warranty_period",
        name="Hardware Warranty Coverage",
        current_value="2",
        unit="years",
        source_document_id=doc1.id,
        source_document_title=doc1.title,
        source_passage="All NovaWear SmartWatch X devices include a comprehensive 2-year warranty from the original date of purchase.",
        version="v3.0",
        effective_date="2026-01-01",
        updated_at=datetime.utcnow().isoformat() + "Z"
    )

    fact_bat = StructuredFact(
        id="FACT-BAT-02",
        fact_key="battery_life_days",
        name="Battery Endurance",
        current_value="7",
        unit="days",
        source_document_id=doc2.id,
        source_document_title=doc2.title,
        source_passage="Up to 7 days of typical battery life on a single charge.",
        version="v1.4",
        effective_date="2026-02-15",
        updated_at=datetime.utcnow().isoformat() + "Z"
    )

    fact_wtr = StructuredFact(
        id="FACT-WTR-03",
        fact_key="water_resistance_depth",
        name="Water Resistance Depth",
        current_value="50",
        unit="meters",
        source_document_id=doc2.id,
        source_document_title=doc2.title,
        source_passage="Rated 5 ATM water resistance (safe up to 50 meters depth for swimming and splash proofing).",
        version="v1.4",
        effective_date="2026-02-15",
        updated_at=datetime.utcnow().isoformat() + "Z"
    )

    fact_col = StructuredFact(
        id="FACT-COL-04",
        fact_key="color_options",
        name="Available Color Options",
        current_value="Midnight Blue, Silver",
        unit="finishes",
        source_document_id=doc2.id,
        source_document_title=doc2.title,
        source_passage="Available exclusively in Midnight Blue and Silver matte anodized aerospace aluminum.",
        version="v1.4",
        effective_date="2026-02-15",
        updated_at=datetime.utcnow().isoformat() + "Z"
    )

    fact_prc = StructuredFact(
        id="FACT-PRC-05",
        fact_key="retail_price",
        name="Retail Launch Price (MSRP)",
        current_value="199",
        unit="USD",
        source_document_id=doc3.id,
        source_document_title=doc3.title,
        source_passage="Suggested Retail Price (MSRP) for SmartWatch X is $199 USD.",
        version="v2.1",
        effective_date="2026-03-01",
        updated_at=datetime.utcnow().isoformat() + "Z"
    )

    for f in [fact_wty, fact_bat, fact_wtr, fact_col, fact_prc]:
        db.add_or_update_fact(f)

    # 3. Content Assets
    # Asset 1: Website Product Page (Contains 2-year warranty, Midnight Blue, and unsupported claim)
    ast1 = ContentAsset(
        id="AST-WEB-01",
        title="NovaWear Official Product Page",
        asset_type="website_page",
        channel="Web / E-Commerce",
        raw_text=(
            "Meet NovaWear SmartWatch X. Built for adventure, it features our revolutionary titanium bezel and the best battery in the world. "
            "Available in Midnight Blue. Every watch comes backed by our peace-of-mind 2-year warranty."
        ),
        approval_status="approved",
        last_scanned_at=datetime.utcnow().isoformat() + "Z",
        claims_count=3,
        issues_count=0,
        linked_fact_ids=[fact_wty.id, fact_col.id],
        last_approved_by="Sarah Connor (Head of Compliance)",
        last_approved_at="2026-03-01T10:00:00Z"
    )

    # Asset 2: Sales Brochure PDF (Contains Two-year warranty and contradicted 100m claim)
    ast2 = ContentAsset(
        id="AST-BRC-02",
        title="SmartWatch X Retail Sales Brochure",
        asset_type="sales_brochure",
        channel="Retail & In-Store Collateral",
        raw_text=(
            "The all-new SmartWatch X is engineered to outperform. Features include a two-year warranty with express replacements, "
            "and an ultra-rugged housing waterproof to 100m."
        ),
        approval_status="approved",
        last_scanned_at=datetime.utcnow().isoformat() + "Z",
        claims_count=2,
        issues_count=0,
        linked_fact_ids=[fact_wty.id, fact_wtr.id],
        last_approved_by="David Miller (Brand Director)",
        last_approved_at="2026-03-02T14:30:00Z"
    )

    # Asset 3: Instagram Launch Post (Contains Two years of coverage and 7 days battery)
    ast3 = ContentAsset(
        id="AST-SOC-03",
        title="SmartWatch X Launch Campaign",
        asset_type="instagram_post",
        channel="Instagram / TikTok",
        raw_text=(
            "Never stop exploring. SmartWatch X delivers up to 7 days of non-stop battery life and two years of coverage so you're always protected. "
            "Tap the link in bio to pre-order."
        ),
        approval_status="approved",
        last_scanned_at=datetime.utcnow().isoformat() + "Z",
        claims_count=2,
        issues_count=0,
        linked_fact_ids=[fact_wty.id, fact_bat.id],
        last_approved_by="Elena Rostova (Legal Counsel)",
        last_approved_at="2026-03-03T09:15:00Z"
    )

    # Asset 4: Colours & Finish Page (Independent: Unaffected by warranty change!)
    ast4 = ContentAsset(
        id="AST-COL-04",
        title="Hardware Finishes & Strap Guide",
        asset_type="website_page",
        channel="Web / Product Guide",
        raw_text=(
            "Crafted from premium aluminum, the SmartWatch X is available in Midnight Blue and Silver finishes. "
            "Pair with interchangeable silicone or braided nylon bands."
        ),
        approval_status="approved",
        last_scanned_at=datetime.utcnow().isoformat() + "Z",
        claims_count=1,
        issues_count=0,
        linked_fact_ids=[fact_col.id],
        last_approved_by="Elena Rostova (Legal Counsel)",
        last_approved_at="2026-03-03T11:00:00Z"
    )

    for ast in [ast1, ast2, ast3, ast4]:
        db.add_or_update_asset(ast)

    # 4. Claims
    claims_to_add = [
        # Claims for AST 1
        Claim(
            id="CLM-01",
            asset_id=ast1.id,
            claim_text="2-year warranty",
            claim_type="numeric",
            exact_source_sentence="Every watch comes backed by our peace-of-mind 2-year warranty.",
            location_start=170,
            location_end=228,
            matched_fact_id=fact_wty.id,
            matched_fact_name=fact_wty.name,
            verification_status="supported",
            confidence=0.99,
            reason="Matches Hardware Warranty Policy v3.0 Section 1.",
            quoted_passage=fact_wty.source_passage,
            source_document_title=doc1.title
        ),
        Claim(
            id="CLM-02",
            asset_id=ast1.id,
            claim_text="Available in Midnight Blue",
            claim_type="other",
            exact_source_sentence="Available in Midnight Blue.",
            location_start=141,
            location_end=168,
            matched_fact_id=fact_col.id,
            matched_fact_name=fact_col.name,
            verification_status="supported",
            confidence=0.98,
            reason="Matches Technical Specification Sheet v1.4 Section 3.",
            quoted_passage=fact_col.source_passage,
            source_document_title=doc2.title
        ),
        Claim(
            id="CLM-03",
            asset_id=ast1.id,
            claim_text="Best battery in the world",
            claim_type="promotional",
            exact_source_sentence="features our revolutionary titanium bezel and the best battery in the world.",
            location_start=68,
            location_end=140,
            matched_fact_id=None,
            verification_status="unsupported",
            confidence=0.91,
            reason="Unsubstantiated superlative: Brand guidelines strictly prohibit unqualified superiority claims.",
            quoted_passage="NovaWear Brand Guidelines Section 4.2",
            source_document_title="Brand Guidelines v2.0",
            suggested_correction="Replace with: 'Up to 7 days of typical battery life'."
        ),

        # Claims for AST 2
        Claim(
            id="CLM-04",
            asset_id=ast2.id,
            claim_text="Two-year warranty",
            claim_type="numeric",
            exact_source_sentence="Features include a two-year warranty with express replacements,",
            location_start=47,
            location_end=110,
            matched_fact_id=fact_wty.id,
            matched_fact_name=fact_wty.name,
            verification_status="supported",
            confidence=0.99,
            reason="Matches Hardware Warranty Policy v3.0 Section 1.",
            quoted_passage=fact_wty.source_passage,
            source_document_title=doc1.title
        ),
        Claim(
            id="CLM-05",
            asset_id=ast2.id,
            claim_text="Waterproof to 100m",
            claim_type="numeric",
            exact_source_sentence="and an ultra-rugged housing waterproof to 100m.",
            location_start=111,
            location_end=158,
            matched_fact_id=fact_wtr.id,
            matched_fact_name=fact_wtr.name,
            verification_status="contradicted",
            confidence=0.97,
            reason="Direct technical contradiction: Specification certifies 50m (5 ATM), not 100m.",
            quoted_passage=fact_wtr.source_passage,
            source_document_title=doc2.title,
            suggested_correction="Update water resistance to '50m (5 ATM)'."
        ),

        # Claims for AST 3
        Claim(
            id="CLM-06",
            asset_id=ast3.id,
            claim_text="Two years of coverage",
            claim_type="numeric",
            exact_source_sentence="and two years of coverage so you're always protected.",
            location_start=81,
            location_end=135,
            matched_fact_id=fact_wty.id,
            matched_fact_name=fact_wty.name,
            verification_status="supported",
            confidence=0.98,
            reason="Matches Hardware Warranty Policy v3.0 Section 1.",
            quoted_passage=fact_wty.source_passage,
            source_document_title=doc1.title
        ),

        # Claims for AST 4 (Unaffected item)
        Claim(
            id="CLM-07",
            asset_id=ast4.id,
            claim_text="Midnight Blue option",
            claim_type="other",
            exact_source_sentence="SmartWatch X is available in Midnight Blue and Silver finishes.",
            location_start=33,
            location_end=96,
            matched_fact_id=fact_col.id,
            matched_fact_name=fact_col.name,
            verification_status="supported",
            confidence=0.99,
            reason="Matches Technical Specification Sheet v1.4 Section 3.",
            quoted_passage=fact_col.source_passage,
            source_document_title=doc2.title
        )
    ]

    for c in claims_to_add:
        db.add_claim(c)

    # Initial Audit Entries
    db.record_audit(
        actor="System",
        role="system",
        action="WORKSPACE_INITIALIZED",
        target_entity="workspace",
        target_id=None,
        diff_payload={"brand": "NovaWear", "product": "SmartWatch X"},
        notes="Loaded NovaWear SmartWatch X demo workspace with 3 documents, 4 facts, and 4 assets."
    )
    return True
