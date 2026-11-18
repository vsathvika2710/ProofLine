import os
import json
from pathlib import Path
from .claim_intelligence import claim_engine, ExtractedClaimSchema
from .database import db
from .seed_data import load_seed_workspace

def evaluate_test_set():
    eval_dir = Path(__file__).resolve().parent.parent / "eval"
    test_file = eval_dir / "test_claims.json"
    if not test_file.exists():
        return {"error": "test_claims.json not found"}

    with open(test_file, "r", encoding="utf-8") as f:
        test_claims = json.load(f)

    # Make sure workspace is seeded
    if not db.list_facts():
        load_seed_workspace()

    correct = 0
    total = len(test_claims)
    tp, fp, tn, fn = 0, 0, 0, 0
    detailed_results = []

    for tc in test_claims:
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

        verified = claim_engine.match_and_verify_claim(extracted, asset_id="EVAL")
        pred = verified.verification_status
        is_match = (pred == expected)
        if is_match:
            correct += 1

        is_expected_prob = (expected != "supported")
        is_pred_prob = (pred != "supported")
        if is_expected_prob and is_pred_prob:
            tp += 1
        elif not is_expected_prob and is_pred_prob:
            fp += 1
        elif not is_expected_prob and not is_pred_prob:
            tn += 1
        elif is_expected_prob and not is_pred_prob:
            fn += 1

        detailed_results.append({
            "id": tc["id"],
            "claim_text": c_text,
            "expected": expected,
            "predicted": pred,
            "is_correct": is_match,
            "reason": verified.reason,
            "confidence": verified.confidence
        })

    accuracy = (correct / total) * 100
    precision = (tp / (tp + fp)) * 100 if (tp + fp) > 0 else 100.0
    recall = (tp / (tp + fn)) * 100 if (tp + fn) > 0 else 100.0
    fpr = (fp / (fp + tn)) * 100 if (fp + tn) > 0 else 0.0

    return {
        "total_claims": total,
        "correct_predictions": correct,
        "accuracy_pct": round(accuracy, 2),
        "precision_pct": round(precision, 2),
        "recall_pct": round(recall, 2),
        "false_positive_rate_pct": round(fpr, 2),
        "results": detailed_results
    }
