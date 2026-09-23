"""Phase 1 tests: JWT auth, categories, featured chains, admin panel, regressions."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://spread-map.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@tartan.app"
ADMIN_PW = "TartanAdmin2026!"


def _rand_email(prefix="creator"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:10]}@tartan.test"


# --------------- fixtures ---------------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("user", {}).get("role") == "admin"
    return s


@pytest.fixture(scope="module")
def creator_ctx():
    """Creator session + created tartan token, shared across the class."""
    s = requests.Session()
    email = _rand_email("creator")
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "CreatorPass123!", "account_type": "creator"
    }, timeout=15)
    assert r.status_code in (200, 201), r.text
    # create a categorized tartan
    r = s.post(f"{API}/tartans", json={
        "title": "TEST Reconnect Chain",
        "goal": "reach 100 friends",
        "nickname": "TestOwner",
        "category": "reconnect",
        "target": "100 friends",
    }, timeout=15)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    token = body.get("tartan", {}).get("token") or body.get("token") or body.get("share_token")
    assert token, f"no token in create response: {body}"
    return {"session": s, "email": email, "token": token}


# --------------- auth ---------------
class TestAuth:
    def test_admin_login_and_me(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        u = r.json().get("user", r.json())
        assert u["email"] == ADMIN_EMAIL and u["role"] == "admin"

    def test_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WrongPass!"}, timeout=10)
        assert r.status_code == 401

    def test_unauth_admin_endpoint(self):
        r = requests.get(f"{API}/admin/overview", timeout=10)
        assert r.status_code == 401

    def test_non_admin_forbidden(self, creator_ctx):
        r = creator_ctx["session"].get(f"{API}/admin/overview", timeout=10)
        assert r.status_code == 403

    def test_register_duplicate(self, creator_ctx):
        r = requests.post(f"{API}/auth/register", json={
            "email": creator_ctx["email"], "password": "AnotherPass1!", "account_type": "creator"
        }, timeout=10)
        assert r.status_code == 409

    def test_company_register(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": _rand_email("company"), "password": "CompanyPass1!", "account_type": "company",
            "org_name": "TEST Org Ltd"
        }, timeout=15)
        assert r.status_code in (200, 201), r.text
        u = r.json()["user"]
        assert u["role"] == "company"
        assert u.get("org_name") == "TEST Org Ltd"

    def test_logout_clears_session(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=10)
        assert r.status_code == 200
        r = s.post(f"{API}/auth/logout", timeout=10)
        assert r.status_code in (200, 204)
        r = s.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# --------------- categories ---------------
class TestCategories:
    def test_list_categories(self):
        r = requests.get(f"{API}/categories", timeout=10)
        assert r.status_code == 200
        cats = r.json()
        rows = cats if isinstance(cats, list) else cats.get("categories", [])
        ids = {c["id"] for c in rows}
        assert {"reconnect", "cause", "event", "fundraiser", "brand", "challenge"}.issubset(ids)


# --------------- creator flow ---------------
class TestCreatorFlow:
    def test_created_tartan_has_category_and_target(self, creator_ctx):
        token = creator_ctx["token"]
        r = requests.get(f"{API}/tartans/{token}", timeout=10)
        assert r.status_code == 200
        body = r.json()
        t = body.get("tartan", body)
        assert t.get("category") == "reconnect"
        assert t.get("target") is not None

    def test_my_tartans_linked(self, creator_ctx):
        r = creator_ctx["session"].get(f"{API}/my/tartans", timeout=10)
        assert r.status_code == 200
        data = r.json()
        rows = data if isinstance(data, list) else data.get("items", data.get("tartans", []))
        tokens = [x.get("share_token") or x.get("token") for x in rows]
        assert creator_ctx["token"] in tokens

    def test_feature_request(self, creator_ctx):
        r = creator_ctx["session"].post(f"{API}/tartans/{creator_ctx['token']}/feature-request", timeout=10)
        assert r.status_code in (200, 201), r.text

    def test_category_filter_in_list(self, creator_ctx):
        r = requests.get(f"{API}/tartans", params={"category": "reconnect"}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        rows = data if isinstance(data, list) else data.get("items", data.get("tartans", []))
        assert any((x.get("share_token") or x.get("token")) == creator_ctx["token"] for x in rows)


# --------------- admin actions ---------------
class TestAdmin:
    def test_overview(self, admin_session):
        r = admin_session.get(f"{API}/admin/overview", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("tartans", "featured", "feature_requests", "users"):
            assert k in d, f"missing {k} in overview: {d}"

    def test_feature_toggle_and_visibility(self, admin_session, creator_ctx):
        token = creator_ctx["token"]
        r = admin_session.post(f"{API}/admin/tartans/{token}/feature", json={"value": True}, timeout=10)
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/tartans/{token}", timeout=10)
        body = r2.json()
        t = body.get("tartan", body)
        assert t.get("featured") is True

    def test_hide_toggle_excludes_from_public_list(self, admin_session, creator_ctx):
        token = creator_ctx["token"]
        r = admin_session.post(f"{API}/admin/tartans/{token}/hide", json={"value": True}, timeout=10)
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/tartans", timeout=10)
        data = r2.json()
        rows = data if isinstance(data, list) else data.get("items", data.get("tartans", []))
        assert not any((x.get("share_token") or x.get("token")) == token for x in rows)
        admin_session.post(f"{API}/admin/tartans/{token}/hide", json={"value": False}, timeout=10)

    def test_users_list(self, admin_session):
        r = admin_session.get(f"{API}/admin/users", timeout=10)
        assert r.status_code == 200

    def test_reports_list(self, admin_session):
        r = admin_session.get(f"{API}/admin/reports", timeout=10)
        assert r.status_code == 200


# --------------- regression ---------------
class TestRegression:
    def test_puntland_loads(self):
        r = requests.get(f"{API}/tartans/puntland", timeout=10)
        assert r.status_code == 200
        body = r.json()
        t = body.get("tartan", body)
        assert t.get("token") == "puntland" or t.get("share_token") == "puntland"

    def test_anonymous_create(self):
        s = requests.Session()
        r = s.post(f"{API}/tartans", json={
            "title": "TEST Anonymous Chain",
            "goal": "spread anon",
            "nickname": "AnonOwner",
        }, timeout=15)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert "tartan" in body or "share_token" in body or "token" in body
