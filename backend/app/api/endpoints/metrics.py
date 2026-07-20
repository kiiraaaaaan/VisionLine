from fastapi import APIRouter

router = APIRouter()

# ── Model Training Metrics ──────────────────────────────────────────────────
# These are the evaluated performance metrics of industry_defect.keras
# (MobileNetV2 fine-tuned binary classifier) on the held-out test set.
# Test set size: 6,815 labeled samples (6,571 normal + 244 defective).
# ─────────────────────────────────────────────────────────────────────────────
MODEL_METRICS = {
    "model_name": "MobileNetV2",
    "model_file": "industry_defect_v2(cm).keras",
    "task": "Binary Defect Classification",
    "test_set_size": 6815,
    "normal_test_samples": 6571,
    "defective_test_samples": 244,
    "threshold": 0.5,
    # Confusion matrix counts
    "true_positive": 214,   # AI: DEFECTIVE, Actual: DEFECTIVE ✓
    "false_positive": 8,    # AI: DEFECTIVE, Actual: NORMAL ✗
    "true_negative": 6563,  # AI: NORMAL,    Actual: NORMAL ✓
    "false_negative": 30,   # AI: NORMAL,    Actual: DEFECTIVE ✗
    # Derived metrics (pre-computed for performance)
    "accuracy": 99.4,
    "precision": 96.4,
    "recall": 87.7,
    "f1_score": 91.8,
    "specificity": 99.9,
    "roc_auc": 99.1,
}


@router.get("/model-performance")
def get_model_performance():
    """Return the pre-computed training evaluation metrics and confusion matrix for the deployed Keras classifier."""
    return MODEL_METRICS
