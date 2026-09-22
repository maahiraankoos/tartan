"""Iteration 2 tests: SSE stream, avatars (upload/attach/serve/ownership), organizer analytics."""
import io
import os
import json
import time
import uuid
import threading
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

# 1x1 transparent PNG
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
    b"\xc0\xf0\x1f\x00\x05\x00\x01\xff\xa5\xc0\xa9\xa5\x00\x00\x00\x00IEND"
    b"\xaeB`\x82"
)


@pytest.fixture
def session():
    s = requests.Session()
    return s


# ---------------------- Analytics / Organizer ----------------------

def test_analytics_initiator_ok(session):
    r = session.get(f"{API}/tartans/puntland/analytics", params={"owner": "j4atawQ7lw"})
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ("tartan", "stats", "timeline", "depth_distribution", "geography", "top_branches"):
        assert k in body, f"missing {k}"
    assert isinstance(body["timeline"], list)
    assert isinstance(body["depth_distribution"], list) and len(body["depth_distribution"]) >= 1
    assert isinstance(body["geography"], list) and len(body["geography"]) >= 1
    assert isinstance(body["top_branches"], list)


def test_analytics_non_initiator_forbidden(session):
    # create a fresh non-initiator member and try
    s = requests.Session()
    r = s.post(f"{API}/tartans/puntland/join", json={
        "nickname": "TEST_NonInit", "city": "Bosaso", "idempotency_key": uuid.uuid4().hex,
    })
    assert r.status_code == 200
    st = r.json()["member"]["share_token"]
    r2 = session.get(f"{API}/tartans/puntland/analytics", params={"owner": st})
    assert r2.status_code == 403


def test_analytics_unknown_owner_forbidden(session):
    r = session.get(f"{API}/tartans/puntland/analytics", params={"owner": "unknown_xyz"})
    assert r.status_code == 403


# ---------------------- Avatars ----------------------

def test_avatar_upload_and_attach_and_serve(session):
    # Upload avatar
    files = {"file": ("a.png", io.BytesIO(PNG_BYTES), "image/png")}
    r = session.post(f"{API}/avatars", files=files)
    assert r.status_code == 200, r.text
    fid = r.json()["avatar_file_id"]
    assert isinstance(fid, str) and len(fid) > 0

    # Join with avatar_file_id
    r2 = session.post(f"{API}/tartans/puntland/join", json={
        "nickname": "TEST_Avatar", "city": "Garowe",
        "avatar_file_id": fid, "idempotency_key": uuid.uuid4().hex,
    })
    assert r2.status_code == 200
    m = r2.json()["member"]
    assert m["avatar_url"] == f"/api/avatar/{m['share_token']}"

    # Serve avatar
    r3 = requests.get(f"{API}/avatar/{m['share_token']}")
    assert r3.status_code == 200
    assert r3.headers.get("Content-Type", "").startswith("image/")
    assert len(r3.content) > 0


def test_member_avatar_update_and_ownership_403():
    owner = requests.Session()
    r = owner.post(f"{API}/tartans/puntland/join", json={
        "nickname": "TEST_AvOwn", "city": "London", "idempotency_key": uuid.uuid4().hex,
    })
    assert r.status_code == 200
    st = r.json()["member"]["share_token"]

    # Same device (session) updates avatar - OK
    files = {"file": ("a.png", io.BytesIO(PNG_BYTES), "image/png")}
    r2 = owner.post(f"{API}/members/{st}/avatar", files=files)
    assert r2.status_code == 200, r2.text
    assert r2.json().get("ok") is True

    # Different device (fresh session) - 403
    stranger = requests.Session()
    files2 = {"file": ("a.png", io.BytesIO(PNG_BYTES), "image/png")}
    r3 = stranger.post(f"{API}/members/{st}/avatar", files=files2)
    assert r3.status_code == 403


def test_avatar_rejects_non_image(session):
    files = {"file": ("a.txt", io.BytesIO(b"hello"), "text/plain")}
    r = session.post(f"{API}/avatars", files=files)
    assert r.status_code == 400


# ---------------------- SSE Stream ----------------------

def test_sse_initial_stats_and_join_event():
    """Open a stream, then trigger a join and observe events."""
    events = []

    def reader():
        with requests.get(f"{API}/tartans/puntland/stream", stream=True, timeout=20) as resp:
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers.get("Content-Type", "")
            cur_event = None
            for raw in resp.iter_lines(decode_unicode=True):
                if raw is None:
                    continue
                if raw.startswith("event:"):
                    cur_event = raw.split(":", 1)[1].strip()
                elif raw.startswith("data:") and cur_event:
                    data = raw.split(":", 1)[1].strip()
                    try:
                        events.append((cur_event, json.loads(data)))
                    except Exception:
                        events.append((cur_event, data))
                    cur_event = None
                    if len(events) >= 3:
                        break

    t = threading.Thread(target=reader, daemon=True)
    t.start()
    time.sleep(1.5)  # let initial stats come through

    # trigger join from separate session
    s = requests.Session()
    r = s.post(f"{API}/tartans/puntland/join", json={
        "nickname": "TEST_SSE", "city": "Dubai", "idempotency_key": uuid.uuid4().hex,
    })
    assert r.status_code == 200

    t.join(timeout=10)
    types = [e[0] for e in events]
    assert "stats" in types, f"no stats event: {events}"
    assert "join" in types, f"no join event: {events}"
    join_ev = next(e for e in events if e[0] == "join")
    assert "nickname" in join_ev[1]
    assert "verified" in join_ev[1]
