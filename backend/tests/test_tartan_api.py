"""Backend tests for Tartan API - CRUD, join flow, idempotency, verified split, reports."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://spread-map.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health / basic ---
def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert "Tartan" in r.json().get("message", "")


# --- Tartan list / featured ---
def test_list_tartans_includes_puntland(session):
    r = session.get(f"{API}/tartans")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) >= 1
    puntland = next((t for t in data if t["token"] == "puntland"), None)
    assert puntland is not None
    assert puntland["featured"] is True
    assert puntland["total_members"] >= 20


def test_get_puntland_tartan_stats(session):
    r = session.get(f"{API}/tartans/puntland")
    assert r.status_code == 200
    body = r.json()
    assert body["tartan"]["token"] == "puntland"
    stats = body["stats"]
    for k in ("total_members", "verified_members", "unverified_members", "max_depth",
              "active_cities", "velocity_1h", "velocity_24h"):
        assert k in stats


def test_get_puntland_map(session):
    r = session.get(f"{API}/tartans/puntland/map")
    assert r.status_code == 200
    body = r.json()
    assert "nodes" in body and "hub" in body
    assert len(body["nodes"]) >= 1
    for n in body["nodes"]:
        assert "city" in n and "count" in n and "x" in n and "y" in n


def test_get_tartan_404(session):
    r = session.get(f"{API}/tartans/does_not_exist_xyz")
    assert r.status_code == 404


# --- Share/invite landing ---
def test_share_context_flagship_initiator(session):
    r = session.get(f"{API}/share/j4atawQ7lw")
    # If seed regenerated with different token, this may 404. Test flexibly.
    if r.status_code == 404:
        # find flagship initiator via list
        pytest.skip("Seed initiator share token differs from expected j4atawQ7lw")
    assert r.status_code == 200
    body = r.json()
    assert body["inviter"]["nickname"] == "Amina"
    assert body["tartan"]["token"] == "puntland"


def test_share_context_404(session):
    r = session.get(f"{API}/share/nonexistent999")
    assert r.status_code == 404


# --- Create tartan ---
def test_create_tartan_and_persist(session):
    payload = {
        "title": "TEST_Chain_" + uuid.uuid4().hex[:6],
        "goal": "TEST goal for testing",
        "nickname": "TESTNICK",
        "city": "Nairobi",
    }
    r = session.post(f"{API}/tartans", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["tartan"]["title"] == payload["title"]
    assert body["member"]["is_initiator"] is True
    assert body["member"]["verified"] is True
    token = body["tartan"]["token"]
    # verify persistence
    r2 = session.get(f"{API}/tartans/{token}")
    assert r2.status_code == 200
    assert r2.json()["tartan"]["title"] == payload["title"]
    assert r2.json()["stats"]["total_members"] == 1


# --- Join flow, parent attribution, chain lineage ---
def test_join_puntland_under_initiator_and_chain(session):
    # get flagship initiator share token dynamically
    tartan_r = session.get(f"{API}/tartans/puntland")
    # need initiator share token; not exposed in tartan_public. Use members list via join preview
    # Use the known one; else fetch via share/{j4atawQ7lw}
    share_r = session.get(f"{API}/share/j4atawQ7lw")
    if share_r.status_code != 200:
        pytest.skip("Flagship initiator share unknown")
    parent_share = "j4atawQ7lw"

    idem = uuid.uuid4().hex
    payload = {
        "nickname": "TEST_Joiner",
        "city": "Bosaso",
        "parent_share_token": parent_share,
        "idempotency_key": idem,
    }
    r = session.post(f"{API}/tartans/puntland/join", json=payload)
    assert r.status_code == 200
    m1 = r.json()["member"]
    assert m1["nickname"] == "TEST_Joiner"
    assert m1["verified"] is True  # first join on this device
    st1 = m1["share_token"]

    # chain endpoint - inviter should be Amina
    chain_r = session.get(f"{API}/members/{st1}/chain")
    assert chain_r.status_code == 200
    chain = chain_r.json()
    assert chain["inviter"] is not None
    assert chain["inviter"]["nickname"] == "Amina"
    assert chain["me"]["share_token"] == st1

    # idempotency: same device, same idem => same member
    r2 = session.post(f"{API}/tartans/puntland/join", json=payload)
    assert r2.status_code == 200
    assert r2.json()["member"]["share_token"] == st1

    # Second join same device, different idem => unverified
    payload2 = dict(payload)
    payload2["idempotency_key"] = uuid.uuid4().hex
    payload2["nickname"] = "TEST_Joiner2"
    r3 = session.post(f"{API}/tartans/puntland/join", json=payload2)
    assert r3.status_code == 200
    m3 = r3.json()["member"]
    assert m3["verified"] is False, "Second join from same device should be unverified"


def test_join_without_parent_attaches_to_initiator(session):
    s = requests.Session()  # fresh device
    s.headers.update({"Content-Type": "application/json"})
    payload = {
        "nickname": "TEST_NoParent",
        "city": "London",
        "idempotency_key": uuid.uuid4().hex,
    }
    r = s.post(f"{API}/tartans/puntland/join", json=payload)
    assert r.status_code == 200
    m = r.json()["member"]
    chain = s.get(f"{API}/members/{m['share_token']}/chain").json()
    assert chain["inviter"] is not None
    # should attach to flagship initiator (Amina)
    assert chain["inviter"]["is_initiator"] is True


def test_join_404_bad_tartan(session):
    r = session.post(f"{API}/tartans/nonexistent_xyz/join",
                     json={"nickname": "x", "idempotency_key": uuid.uuid4().hex})
    assert r.status_code == 404


# --- Reports ---
def test_create_report(session):
    r = session.post(f"{API}/reports", json={
        "tartan_token": "puntland",
        "reason": "TEST_spam report",
        "kind": "report",
    })
    assert r.status_code == 200
    assert r.json()["ok"] is True


# --- Verified split at tartan level (fresh device) ---
def test_verified_split_new_device_increments_verified(session):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    before = s.get(f"{API}/tartans/puntland").json()["stats"]
    r = s.post(f"{API}/tartans/puntland/join", json={
        "nickname": "TEST_Verif",
        "city": "Dubai",
        "idempotency_key": uuid.uuid4().hex,
    })
    assert r.status_code == 200
    after = s.get(f"{API}/tartans/puntland").json()["stats"]
    assert after["total_members"] == before["total_members"] + 1
    assert after["verified_members"] == before["verified_members"] + 1
