"""AI Engine, weighted skill gaps, and ML model evaluation metrics tests."""
from tests.conftest import login_client


def test_ai_skill_gaps_weighted_priority(client):
    login_client(client, "employee@test.com")
    res = client.get("/api/ai/skill-gaps/2")
    assert res.status_code == 200
    gaps = res.json()
    assert len(gaps) >= 1
    # Check weighted gap calculation
    first_gap = gaps[0]
    assert "weighted_gap" in first_gap
    assert "weight" in first_gap
    assert first_gap["weighted_gap"] == round(first_gap["gap"] * first_gap["weight"], 2)


def test_ai_model_metrics_returns_mae_r2_rmse(client):
    login_client(client, "hr@test.com")
    res = client.get("/api/ai/model-metrics")
    assert res.status_code == 200
    metrics = res.json()
    assert metrics["algorithm"] == "Ridge Regression"
    assert "r2" in metrics
    assert "mae" in metrics
    assert "rmse" in metrics
    assert "feature_importances" in metrics
    assert "تقدير تجريبي" in metrics["note"]
