"""Phase 2 tests: Featured-placement offline-payment orders + auto-expiry."""
import os
import uuid
import time
import asyncio
import requests
import pytest
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://spread-map.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@tartan.app"
ADMIN_PW = "TartanAdmin2026!"


def _rand_email(prefix="creator"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:10]}@tartan.test"


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    last = None
    for _ in range(3):
        try:
            r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=30)
            assert r.status_code == 200, r.text
            return s
        except requests.exceptions.RequestException as e:
            last = e
            time.sleep(1)
    raise last


def _new_creator_with_tartan(title="TEST Phase2 Chain"):
    s = requests.Session()
    email = _rand_email("creator")
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "CreatorPass123!", "account_type": "creator"
    }, timeout=15)
    assert r.status_code in (200, 201), r.text
    r = s.post(f"{API}/tartans", json={
        "title": title, "goal": "spread", "nickname": "Owner",
        "category": "cause", "target": "50 members",
    }, timeout=15)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    token = body.get("tartan", {}).get("token") or body.get("token")
    assert token, body
    return s, email, token


@pytest.fixture(scope="module")
def creator_ctx():
    s, email, token = _new_creator_with_tartan()
    return {"session": s, "email": email, "token": token}


# ---------------- feature-plans ----------------
class TestFeaturePlans:
    def test_list_plans(self):
        r = requests.get(f"{API}/feature-plans", timeout=10)
        assert r.status_code == 200
        plans = r.json()
        assert isinstance(plans, list) and len(plans) >= 2
        by_id = {p["id"]: p for p in plans}
        assert "7d" in by_id and "30d" in by_id
        assert by_id["7d"]["days"] == 7 and by_id["7d"]["price"] == 19
        assert by_id["30d"]["days"] == 30 and by_id["30d"]["price"] == 49
        assert by_id["30d"].get("best_value") is True


# ---------------- order create / ownership ----------------
class TestOrderCreate:
    def test_owner_can_create_pending_order(self, creator_ctx):
        r = creator_ctx["session"].post(
            f"{API}/tartans/{creator_ctx['token']}/feature-order",
            json={"plan": "7d"}, timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        o = r.json()["order"]
        assert o["status"] == "pending"
        assert o["plan"] == "7d"
        assert o["days"] == 7
        assert o["amount"] == 19
        assert o["tartan_token"] == creator_ctx["token"]
        creator_ctx["order_id"] = o["id"]

    def test_duplicate_pending_returns_409(self, creator_ctx):
        r = creator_ctx["session"].post(
            f"{API}/tartans/{creator_ctx['token']}/feature-order",
            json={"plan": "30d"}, timeout=15,
        )
        assert r.status_code == 409, r.text

    def test_non_owner_forbidden_403(self, creator_ctx):
        s2, _, _ = _new_creator_with_tartan(title="TEST Other Chain")
        r = s2.post(
            f"{API}/tartans/{creator_ctx['token']}/feature-order",
            json={"plan": "7d"}, timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_unknown_plan_400(self, creator_ctx):
        s, _, token = _new_creator_with_tartan(title="TEST Unknown Plan Chain")
        r = s.post(f"{API}/tartans/{token}/feature-order", json={"plan": "bogus"}, timeout=15)
        assert r.status_code == 400, r.text

    def test_my_orders_contains_pending(self, creator_ctx):
        r = creator_ctx["session"].get(f"{API}/my/orders", timeout=10)
        assert r.status_code == 200
        orders = r.json()
        assert any(o["id"] == creator_ctx["order_id"] and o["status"] == "pending" for o in orders)


# ---------------- admin activate / reject ----------------
class TestAdminOrders:
    def test_admin_orders_lists_pending(self, admin_session, creator_ctx):
        r = admin_session.get(f"{API}/admin/orders", timeout=10)
        assert r.status_code == 200
        orders = r.json()
        assert any(o["id"] == creator_ctx["order_id"] for o in orders)

    def test_activate_sets_featured_and_expires(self, admin_session, creator_ctx):
        oid = creator_ctx["order_id"]
        r = admin_session.post(f"{API}/admin/orders/{oid}/activate", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("expires_at")

        # order becomes active
        r2 = admin_session.get(f"{API}/admin/orders", timeout=10)
        o = next((x for x in r2.json() if x["id"] == oid), None)
        assert o and o["status"] == "active" and o["expires_at"] and o["activated_at"]

        # tartan is featured with featured_until in list
        r3 = requests.get(f"{API}/tartans", timeout=10)
        rows = r3.json() if isinstance(r3.json(), list) else r3.json().get("items", [])
        tartan_row = next((x for x in rows if x.get("token") == creator_ctx["token"]), None)
        assert tartan_row, "Featured tartan not present in public /api/tartans"
        assert tartan_row.get("featured") is True
        assert tartan_row.get("featured_until") is not None

    def test_cannot_activate_non_pending(self, admin_session, creator_ctx):
        r = admin_session.post(f"{API}/admin/orders/{creator_ctx['order_id']}/activate", timeout=10)
        assert r.status_code == 400

    def test_reject_flow(self, admin_session):
        # New order to reject
        s, _, token = _new_creator_with_tartan(title="TEST Reject Chain")
        r = s.post(f"{API}/tartans/{token}/feature-order", json={"plan": "7d"}, timeout=15)
        assert r.status_code in (200, 201)
        oid = r.json()["order"]["id"]

        r2 = admin_session.post(f"{API}/admin/orders/{oid}/reject", timeout=10)
        assert r2.status_code == 200, r2.text

        # Order rejected
        r3 = admin_session.get(f"{API}/admin/orders", params={"status": "rejected"}, timeout=10)
        assert any(o["id"] == oid and o["status"] == "rejected" for o in r3.json())

        # feature_requested cleared on tartan
        r4 = requests.get(f"{API}/tartans/{token}", timeout=10)
        t = r4.json().get("tartan", r4.json())
        assert t.get("feature_requested") in (False, None)


# ---------------- overview ----------------
class TestOverviewStats:
    def test_revenue_and_pending_present(self, admin_session):
        r = admin_session.get(f"{API}/admin/overview", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "revenue" in d and "pending_orders" in d
        assert isinstance(d["revenue"], (int, float))
        # After Phase 2 activation, revenue should be >= 19
        assert d["revenue"] >= 19


# ---------------- auto-expiry regression ----------------
class TestAutoExpiry:
    def test_expired_feature_un_features_but_puntland_stays(self, admin_session):
        """Create a tartan+active order with featured_until in the past via mongo, then
        GET /api/tartans and confirm it un-features, while puntland (no featured_until)
        remains featured."""
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]

        async def _setup_and_check():
            # Create a featured tartan with past expiry
            token = f"TEST_expired_{uuid.uuid4().hex[:8]}"
            past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
            await db.tartans.insert_one({
                "id": uuid.uuid4().hex, "token": token, "title": "TEST Expired Chain",
                "goal": "g", "category": "cause",
                "initiator_share_token": uuid.uuid4().hex[:10],
                "featured": True, "featured_until": past,
                "hidden": False, "total_members": 0, "verified_members": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            await db.orders.insert_one({
                "id": uuid.uuid4().hex, "tartan_token": token, "tartan_title": "TEST Expired Chain",
                "owner_user_id": "irrelevant", "plan": "7d", "days": 7, "amount": 19,
                "currency": "USD", "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "activated_at": (datetime.now(timezone.utc) - timedelta(days=8)).isoformat(),
                "expires_at": past,
            })
            return token

        token = asyncio.get_event_loop().run_until_complete(_setup_and_check())

        # Trigger the sweep by hitting the public list
        r = requests.get(f"{API}/tartans", timeout=10)
        assert r.status_code == 200
        rows = r.json() if isinstance(r.json(), list) else r.json().get("items", [])

        # Expired chain must not be in featured list; verify via GET /api/tartans/{token}
        r2 = requests.get(f"{API}/tartans/{token}", timeout=10)
        assert r2.status_code == 200
        t = r2.json().get("tartan", r2.json())
        assert t.get("featured") in (False, None), f"expired chain still featured: {t}"

        # Puntland (no featured_until) must still be featured
        rp = requests.get(f"{API}/tartans/puntland", timeout=10)
        assert rp.status_code == 200
        pt = rp.json().get("tartan", rp.json())
        assert pt.get("featured") is True, f"puntland lost featured: {pt}"

        # The associated order must have flipped to expired
        r3 = admin_session.get(f"{API}/admin/orders", params={"status": "expired"}, timeout=10)
        assert any(o["tartan_token"] == token for o in r3.json())
