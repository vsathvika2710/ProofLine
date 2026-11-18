import os
import sys
import json
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from backend.database import db
from backend.seed_data import load_seed_workspace
from backend.claim_intelligence import claim_engine, ExtractedClaimSchema

def run_evaluation():
    print("=" * 70)
    print("PROOFLINE EVALUATION SUITE · 30-CLAIM BENCHMARK (Round 2)")
    print("=" * 70)

    # Ensure workspace is seeded
    load_seed_workspace()

    test_file = Path(__file__).resolve().parent / "test_claims.json"
    if not test_file.exists():
        print(f"Error: Test file not found at {test_file}")
        sys.exit(1)

    with open(test_file, "r", encoding="utf-8") as f:
        test_claims = json.load(f)

    print(f"Loaded {len(test_claims)} labelled test claims from {test_file.name}\n")

    correct = 0
    total = len(test_claims)

    # For binary detection metrics: Positive = Problematic (contradicted, unsupported, outdated, needs_review), Negative = Supported
    tp = 0  # Flagged problematic & was problematic
    fp = 0  # Flagged problematic & was actually supported
    tn = 0  # Marked supported & was supported
    fn = 0  # Marked supported & was actually problematic

    class_counts = {"supported": 0, "contradicted": 0, "unsupported": 0, "outdated": 0, "needs_human_review": 0}
    class_correct = {"supported": 0, "contradicted": 0, "unsupported": 0, "outdated": 0, "needs_human_review": 0}

    print(f"{'ID':<6} | {'CLAIM':<42} | {'EXPECTED':<18} | {'PREDICTED':<18} | {'MATCH'}")
    print("-" * 95)

    for tc in test_claims:
        cid = tc["id"]
        c_text = tc["claim_text"]
        expected = tc["ground_truth_status"]
        c_type = tc.get("expected_type", "numeric")

        extracted = ExtractedClaimSchema(
            claim_text=c_text,
            claim_type=c_type,
            exact_source_sentence=c_text,
            location_start=0,
            location_end=len(c_text)
        )

        verified = claim_engine.match_and_verify_claim(extracted, asset_id="EVAL-SUITE")
        pred = verified.verification_status

        # Normalize predicted vs expected for metrics
        is_match = (pred == expected)
        if expected in class_counts:
            class_counts[expected] += 1
            if is_match:
                class_correct[expected] += 1

        if is_match:
            correct += 1

        # Binary confusion matrix for anomaly/issue detection
        is_expected_problem = (expected != "supported")
        is_pred_problem = (pred != "supported")

        if is_expected_problem and is_pred_problem:
            tp += 1
        elif not is_expected_problem and is_pred_problem:
            fp += 1
        elif not is_expected_problem and not is_pred_problem:
            tn += 1
        elif is_expected_problem and not is_pred_problem:
            fn += 1

        match_str = "[OK]" if is_match else "[FAIL]"
        display_claim = c_text if len(c_text) <= 40 else c_text[:37] + "..."
        print(f"{cid:<6} | {display_claim:<42} | {expected:<18} | {pred:<18} | {match_str}")

    accuracy = (correct / total) * 100
    precision = (tp / (tp + fp)) * 100 if (tp + fp) > 0 else 100.0
    recall = (tp / (tp + fn)) * 100 if (tp + fn) > 0 else 100.0
    fpr = (fp / (fp + tn)) * 100 if (fp + tn) > 0 else 0.0

    print("\n" + "=" * 70)
    print("EVALUATION RESULTS & PERFORMANCE BENCHMARK")
    print("=" * 70)
    print(f"Total Test Claims Evaluated: {total}")
    print(f"Overall Exact Categorization Accuracy: {accuracy:.1f}% ({correct}/{total})")
    print(f"Problem Detection Precision:            {precision:.1f}%")
    print(f"Problem Detection Recall:               {recall:.1f}%")
    print(f"False-Positive Rate (FPR):              {fpr:.1f}%")

    print("\nCategory Breakdown:")
    for cat in ["supported", "contradicted", "unsupported", "outdated", "needs_human_review"]:
        c_tot = class_counts.get(cat, 0)
        c_ok = class_correct.get(cat, 0)
        pct = (c_ok / c_tot * 100) if c_tot > 0 else 0.0
        print(f"  • {cat.replace('_', ' ').capitalize():<20}: {c_ok}/{c_tot} ({pct:.1f}%)")

    print("=" * 70)
    return {
        "total": total,
        "accuracy": round(accuracy, 2),
        "precision": round(precision, 2),
        "recall": round(recall, 2),
        "false_positive_rate": round(fpr, 2),
        "class_breakdown": {
            cat: {"correct": class_correct[cat], "total": class_counts[cat]}
            for cat in class_counts
        }
    }

if __name__ == "__main__":
    run_evaluation()
