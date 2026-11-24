import sys
import types
import unittest
from unittest.mock import patch

from .guest_verification import (
    GuestClaim,
    GuestProcessingError,
    GuestProductRequest,
    assess_guest_claims,
    extract_guest_pdf,
    extract_guest_text,
    retrieve_guest_evidence,
)


class GuestVerificationTests(unittest.TestCase):
    def setUp(self):
        self.product = GuestProductRequest(
            name="NovaWear SmartWatch X",
            brand="NovaWear",
        )

    def test_text_extraction_finds_product_and_claims(self):
        result = extract_guest_text(
            "NovaWear SmartWatch X includes a 3-year warranty and offers 7 days of battery life."
        )

        self.assertEqual(result["product"].name, "NovaWear SmartWatch X")
        self.assertEqual(result["product"].brand, "NovaWear")
        self.assertEqual(len(result["claims"]), 2)
        self.assertEqual({claim.claim_type for claim in result["claims"]}, {"warranty", "battery"})

    def test_pdf_text_is_extracted_and_scanned_pdf_is_rejected(self):
        class FakePage:
            def __init__(self, text):
                self.text = text

            def get_text(self):
                return self.text

        class FakeDocument:
            page_count = 1

            def __init__(self, text):
                self.pages = [FakePage(text)]

            def __iter__(self):
                return iter(self.pages)

            def close(self):
                pass

        with patch.dict(sys.modules, {"fitz": types.SimpleNamespace(open=lambda **_: FakeDocument("NovaWear SmartWatch X includes a 2-year warranty."))}):
            self.assertIn("2-year warranty", extract_guest_pdf(b"%PDF-test"))

        with patch.dict(sys.modules, {"fitz": types.SimpleNamespace(open=lambda **_: FakeDocument(""))}):
            with self.assertRaisesRegex(GuestProcessingError, "No readable text"):
                extract_guest_pdf(b"%PDF-test")

    def test_warranty_numeric_comparison_and_battery_context(self):
        warranty = GuestClaim(
            id="warranty",
            text="NovaWear SmartWatch X includes a 3-year warranty",
            normalized="NovaWear SmartWatch X includes a 3-year warranty",
        )
        warranty_result = assess_guest_claims(self.product, [warranty], input_method="pdf")
        self.assertEqual(warranty_result.findings[0].status, "contradicted")
        self.assertEqual(warranty_result.findings[0].evidence[0].topic, "warranty")
        self.assertEqual(warranty_result.input_method, "pdf")

        standby = GuestClaim(
            id="standby",
            text="NovaWear SmartWatch X has 48-hour standby",
            normalized="NovaWear SmartWatch X has 48-hour standby",
        )
        standby_result = assess_guest_claims(self.product, [standby])
        self.assertEqual(standby_result.findings[0].status, "supported")
        self.assertEqual(
            [item.topic for item in standby_result.findings[0].evidence],
            ["battery"],
        )

        battery_life = GuestClaim(
            id="battery-life",
            text="NovaWear SmartWatch X has 48 hours of battery life",
            normalized="NovaWear SmartWatch X has 48 hours of battery life",
        )
        battery_result = assess_guest_claims(self.product, [battery_life])
        self.assertEqual(battery_result.findings[0].status, "contradicted")
        self.assertNotIn("standby", battery_result.findings[0].evidence[0].passage.lower())

    def test_unrelated_references_do_not_become_claim_evidence(self):
        claim = GuestClaim(
            id="claim",
            text="A different product has a 3-year warranty",
            normalized="A different product has a 3-year warranty",
        )
        evidence = retrieve_guest_evidence(
            GuestProductRequest(name="Different Product", brand="Different"),
            [claim],
            "NovaWear SmartWatch X is available in Midnight Blue.",
        )
        self.assertEqual(evidence[0].evidence, [])

    def test_guest_assessment_does_not_read_office_facts(self):
        claim = GuestClaim(
            id="claim",
            text="NovaWear SmartWatch X includes a 2-year warranty",
            normalized="NovaWear SmartWatch X includes a 2-year warranty",
        )
        with patch("backend.database.db.list_facts", side_effect=AssertionError("Office DB accessed")):
            result = assess_guest_claims(self.product, [claim])
        self.assertEqual(result.findings[0].status, "supported")

    def test_battery_demo_evidence_ids_are_unique(self):
        claim = GuestClaim(
            id="battery",
            text="NovaWear SmartWatch X has 48-hour standby",
            normalized="NovaWear SmartWatch X has 48-hour standby",
        )
        evidence = retrieve_guest_evidence(self.product, [claim])[0].evidence
        ids = [item.id for item in evidence]
        self.assertEqual(len(ids), len(set(ids)))


if __name__ == "__main__":
    unittest.main()
