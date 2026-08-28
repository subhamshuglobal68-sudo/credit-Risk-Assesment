"""GET /api/history: pagination math, config-driven defaults, cap."""

import pytest

from app.extensions import db
from conftest import make_record, seed_records


class TestHistoryEndpoint:
    def test_pagination_math(self, app, client):
        with app.app_context():
            seed_records(25)
        # per_page=20 is clamped to the cap (10) -> ceil(25 / 10) = 3 pages
        resp = client.get("/api/history?page=2&per_page=20")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total_items"] == 25
        assert body["total_pages"] == 3
        assert body["page"] == 2
        assert len(body["items"]) == 10

    def test_empty_table_shape(self, client):
        body = client.get("/api/history").get_json()
        assert body == {"items": [], "page": 1, "total_pages": 1,
                        "total_items": 0}

    def test_default_per_page_comes_from_config(self, app, client):
        with app.app_context():
            seed_records(12)
        # TestConfig sets HISTORY_DEFAULT_PER_PAGE = 5
        body = client.get("/api/history").get_json()
        assert len(body["items"]) == 5

    def test_per_page_capped(self, app, client):
        with app.app_context():
            seed_records(15)
        # TestConfig sets HISTORY_PER_PAGE_CAP = 10; ask for far more
        body = client.get("/api/history?per_page=500").get_json()
        assert len(body["items"]) == 10

    def test_newest_first_ordering(self, app, client):
        with app.app_context():
            seed_records(7)
        items = client.get("/api/history").get_json()["items"]
        ids = [item["id"] for item in items]
        assert ids == sorted(ids, reverse=True)

    def test_item_projection_excludes_variable_shaped_columns(self, app, client):
        with app.app_context():
            db.session.add(make_record(1))
            db.session.commit()
        item = client.get("/api/history").get_json()["items"][0]
        expected = {
            "id", "request_id", "record_type", "created_at", "age", "job",
            "credit_amount", "duration", "existing_credits", "risk_category",
            "probability", "is_anomalous", "model_version",
        }
        assert set(item) == expected
        assert "input_payload" not in item
        assert "explanation" not in item


@pytest.mark.parametrize(
    "query",
    ["?page=0", "?per_page=0", "?per_page=abc", "?bogus=1"],
)
def test_bad_query_params_are_400(client, query):
    assert client.get(f"/api/history{query}").status_code == 400
