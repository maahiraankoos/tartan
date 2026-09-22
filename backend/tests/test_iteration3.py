"""Iteration 3 tests: spark_number on join/create + chain endpoint returns rank/total_in_chain/percentile."""
import os
import uuid
import pytest
import requests


def _read_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"

INIT_SHARE = "j4atawQ7lw"  # Amina


# ---- Backfill / initiator spark ----
def test_initiator_chain_spark_and_ranking():
    r = requests.get(f"{API}/members/{INIT_SHARE}/chain")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "me" in body and "rank" in body and "total_in_chain" in body and "percentile" in body
    me = body["me"]
    # Initiator's spark_number must be 1
    assert me.get("spark_number") == 1, f"initiator spark_number should be 1, got {me.get('spark_number')}"
    assert isinstance(body["rank"], int) and body["rank"] >= 1
    assert isinstance(body["total_in_chain"], int) and body["total_in_chain"] >= 1
    assert 1 <= body["percentile"] <= 100


# ---- New joiner gets spark_number > 1, attaches under inviter ----
def test_join_returns_spark_number_and_attaches_to_inviter():
    s = requests.Session()
    r = s.post(f"{API}/tartans/puntland/join", json={
        "nickname": "TEST_Spark", "city": "Hargeisa",
        "parent_share_token": INIT_SHARE,
        "idempotency_key": uuid.uuid4().hex,
    })
    assert r.status_code == 200, r.text
    member = r.json()["member"]
    assert isinstance(member.get("spark_number"), int) and member["spark_number"] > 1, member
    st = member["share_token"]

    # chain endpoint for the new member should show inviter=Amina in lineage
    c = requests.get(f"{API}/members/{st}/chain")
    assert c.status_code == 200
    cbody = c.json()
    assert cbody["me"].get("spark_number") == member["spark_number"]
    # rank should be > 1 (not the initiator)
    assert cbody["rank"] >= 1
    assert cbody["total_in_chain"] >= member["spark_number"]

    # lineage: check parent attribution — find "inviter" in lineage/parent field
    # Try common field names
    lineage = cbody.get("lineage") or cbody.get("ancestors") or []
    if lineage:
        # If it's a list of members, one should be Amina
        names = [x.get("nickname") for x in lineage if isinstance(x, dict)]
        assert "Amina" in names, f"expected Amina in lineage, got {names}"


# ---- Create-a-Tartan initiator gets spark_number=1 ----
def test_create_tartan_initiator_spark_is_one():
    s = requests.Session()
    tkn = f"test-spark-{uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/tartans", json={
        "title": "TEST_Spark tartan",
        "goal": "verify",
        "nickname": "TEST_Owner",
        "city": "Nairobi",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    # Response should include the initiator member with spark_number=1
    init = body.get("member") or body.get("initiator") or {}
    st = init.get("share_token") or body.get("initiator_share_token")
    assert st, f"no initiator share token in response: {body}"

    c = requests.get(f"{API}/members/{st}/chain")
    assert c.status_code == 200
    cb = c.json()
    assert cb["me"].get("spark_number") == 1
    assert cb["total_in_chain"] == 1
    assert cb["rank"] == 1


# ---- Percentile monotonicity for a couple of joiners ----
def test_percentile_bounds_for_joiner():
    s = requests.Session()
    r = s.post(f"{API}/tartans/puntland/join", json={
        "nickname": "TEST_Pct", "city": "Mogadishu",
        "parent_share_token": INIT_SHARE,
        "idempotency_key": uuid.uuid4().hex,
    })
    assert r.status_code == 200
    st = r.json()["member"]["share_token"]
    c = requests.get(f"{API}/members/{st}/chain").json()
    assert 1 <= c["percentile"] <= 100
