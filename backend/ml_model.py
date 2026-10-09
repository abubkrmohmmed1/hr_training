"""Lightweight Ridge model that estimates training impact with evaluation metrics and explainability.

Trains on synthetic baseline dataset with proper train/test evaluation (R², MAE, RMSE)
and HMAC signature verification for artifact integrity.
"""
from __future__ import annotations

import os
import hashlib
import hmac
import warnings

import joblib
import numpy as np
from sklearn import __version__ as SKLEARN_VERSION
from sklearn.exceptions import InconsistentVersionWarning
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from config import MODEL_SIGNING_KEY

MODEL_PATH = os.path.join(os.path.dirname(__file__), "ml_impact_model.joblib")
MODEL_SIGNATURE_PATH = f"{MODEL_PATH}.sig"

FEATURE_NAMES = [
    "current_level",
    "gap",
    "course_level",
    "duration_hours",
    "cost",
    "level_match",
]


def _synthetic_dataset(n: int = 600, seed: int = 42):
    rng = np.random.default_rng(seed)
    current = rng.integers(1, 5, n).astype(float)
    gap = rng.integers(1, 4, n).astype(float)
    gap = np.minimum(gap, 5 - current)
    gap = np.maximum(gap, 1)
    course_level = rng.integers(1, 6, n).astype(float)
    duration = rng.choice([10, 12, 15, 20, 25, 30, 35, 40, 50, 60], n).astype(float)
    cost = rng.choice([0, 50, 80, 100, 150, 200, 250, 300, 400, 500], n).astype(float)
    level_match = 1 - np.abs(course_level - (current + gap / 2)) / 5.0
    gain = (
        0.18 * gap
        + 0.008 * duration
        + 0.7 * np.clip(level_match, 0, 1)
        + rng.normal(0, 0.12, n)
    )
    gain = np.clip(gain, 0.1, gap)
    X = np.column_stack([current, gap, course_level, duration, cost, level_match])
    return X, gain


class ImpactModel:
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = Ridge(alpha=1.0)
        self.r2 = 0.0
        self.mae = 0.0
        self.rmse = 0.0
        self.feature_importances: dict[str, float] = {}
        self.trained = False

    def train(self):
        X, y = _synthetic_dataset()
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        xs_train = self.scaler.fit_transform(X_train)
        xs_test = self.scaler.transform(X_test)

        self.model.fit(xs_train, y_train)
        y_pred = self.model.predict(xs_test)

        self.r2 = round(float(r2_score(y_test, y_pred)), 3)
        self.mae = round(float(mean_absolute_error(y_test, y_pred)), 3)
        self.rmse = round(float(root_mean_squared_error(y_test, y_pred)), 3)

        self.feature_importances = {
            name: round(float(coef), 4)
            for name, coef in zip(FEATURE_NAMES, self.model.coef_)
        }
        self.trained = True

        data = {
            "scaler": self.scaler,
            "model": self.model,
            "r2": self.r2,
            "mae": self.mae,
            "rmse": self.rmse,
            "feature_importances": self.feature_importances,
            "sklearn_version": SKLEARN_VERSION,
        }
        joblib.dump(data, MODEL_PATH)
        self._write_signature()

    def _signature(self) -> str:
        digest = hashlib.sha256()
        with open(MODEL_PATH, "rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return hmac.new(MODEL_SIGNING_KEY.encode(), digest.hexdigest().encode(), hashlib.sha256).hexdigest()

    def _write_signature(self) -> None:
        with open(MODEL_SIGNATURE_PATH, "w", encoding="ascii") as handle:
            handle.write(self._signature())

    def load(self) -> bool:
        if not os.path.exists(MODEL_PATH) or not os.path.exists(MODEL_SIGNATURE_PATH):
            return False
        with open(MODEL_SIGNATURE_PATH, encoding="ascii") as handle:
            expected_signature = handle.read().strip()
        if not hmac.compare_digest(expected_signature, self._signature()):
            raise RuntimeError("The ML model signature is invalid")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", InconsistentVersionWarning)
                data = joblib.load(MODEL_PATH)
        except InconsistentVersionWarning:
            return False
        if data.get("sklearn_version") != SKLEARN_VERSION:
            return False
        self.scaler = data["scaler"]
        self.model = data["model"]
        self.r2 = data.get("r2", 0.0)
        self.mae = data.get("mae", 0.0)
        self.rmse = data.get("rmse", 0.0)
        self.feature_importances = data.get("feature_importances", {})
        self.trained = True
        return True

    def predict_gain(self, current: float, gap: float, course_level: float, duration: float, cost: float) -> float:
        if gap <= 0:
            return 0.0
        level_match = 1 - abs(course_level - (current + gap / 2)) / 5.0
        row = np.array([[current, gap, course_level, duration, cost, level_match]])
        pred = float(self.model.predict(self.scaler.transform(row))[0])
        return round(max(0.0, min(float(gap), pred)), 2)

    def explain(self, current: float, gap: float, course_level: float, duration: float, cost: float) -> dict:
        predicted = self.predict_gain(current, gap, course_level, duration, cost)
        level_match = max(0.0, min(1.0, 1 - abs(course_level - (current + gap / 2)) / 5.0))
        return {
            "predicted_gain": predicted,
            "is_heuristic": True,
            "disclaimer": "تقدير تجريبي استرشادي: يعتمد على خوارزمية Ridge الخطية ومحاكاة المعايير، وتعتمد الترقية الفعلية على موافقة المدير المباشر.",
            "factors": {
                "skill_gap": gap,
                "level_alignment_percent": round(level_match * 100),
                "duration_hours": duration,
                "cost": cost,
            },
            "summary_ar": f"من المتوقع تحسن مستوى المهارة بنحو {predicted} درجة عند إتمام الدورة بنجاح وموافقة المدير."
        }


_impact = ImpactModel()


def get_impact_model() -> ImpactModel:
    if not _impact.trained:
        if not _impact.load():
            _impact.train()
    return _impact


def predict_course_impact(current: float, gap: float, course_level: float, duration: float, cost: float) -> float:
    try:
        return get_impact_model().predict_gain(current, gap, course_level, duration, cost)
    except Exception:
        return round(min(float(gap), 0.2 * float(gap) + 0.01 * float(duration)), 2)


def explain_course_impact(current: float, gap: float, course_level: float, duration: float, cost: float) -> dict:
    try:
        return get_impact_model().explain(current, gap, course_level, duration, cost)
    except Exception:
        gain = round(min(float(gap), 0.2 * float(gap) + 0.01 * float(duration)), 2)
        return {
            "predicted_gain": gain,
            "is_heuristic": True,
            "disclaimer": "تقدير تجريبي استرشادي.",
            "factors": {"skill_gap": gap, "duration_hours": duration, "cost": cost},
            "summary_ar": f"تحسن متوقع بنحو {gain} درجات."
        }


def model_info() -> dict:
    model = get_impact_model()
    return {
        "algorithm": "Ridge Regression",
        "features": FEATURE_NAMES,
        "r2": model.r2,
        "mae": model.mae,
        "rmse": model.rmse,
        "feature_importances": model.feature_importances,
        "trained": model.trained,
        "note": "تقدير تجريبي: يتوقع مقدار تحسن مستوى المهارة بعد إكمال الدورة. خاضع لاعتماد المدير المباشر.",
    }
