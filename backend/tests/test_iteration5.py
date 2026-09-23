"""
Iteration 5 backend tests: leaderboard, notifications, streak, recap, profile,
goal_target, verified_organizer, milestone SSE, share context inviter rank.
"""
import os
import time
import json
import threading
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or ""
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

PUNTLAND = "puntland"
AMINA = "j4atawQ7lw"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# --- Leaderboard ---
class TestLeaderboard:
    def test_puntland_leaderboard(self, s):
        r = s.get(f"{API}/tartans/{PUNTLAND}/leaderboard")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert 0 < len(data) <= 20
        # sorted by downstream_count desc
        downs = [m["downstream_count"] for m in data]
        assert downs == sorted(downs, reverse=True)
        # ranks are 1..N
        assert [m["rank"] for m in data] == list(range(1, len(data) + 1))
        # spark_number present
        assert all("spark_number" in m for m in data)

    def test_leaderboard_404(self, s):
        r = s.get(f"{API}/tartans/nonexistent_xyz/leaderboard")
        assert r.status_code == 404


# --- tartan_public: verified_organizer + goal_target ---
class TestTartanPublic:
    def test_puntland_verified_organizer(self, s):
        r = s.get(f"{API}/tartans/{PUNTLAND}")
        assert r.status_code == 200
        t = r.json()["tartan"]
        assert "verified_organizer" in t
        assert t["verified_organizer"] is True  # >=25 verified
        assert "goal_target" in t  # may be None


# --- Create tartan with goal_target ---
class TestCreateWithGoal:
    def test_create_with_goal_target(self, s):
        payload = {
            "title": "TEST_goal_chain",
            "goal": "TEST goal",
            "city": "Garowe",
            "nickname": "TEST_init",
            "goal_target": 50,
        }
        r = requests.post(f"{API}/tartans", json=payload)
        assert r.status_code == 200
        t = r.json()["tartan"]
        assert t["goal_target"] == 50
        assert t["verified_organizer"] is False
        # store token for milestone test via pytest attr
        TestCreateWithGoal.token = t["token"]
        TestCreateWithGoal.initiator = r.json()["member"]["share_token"]


# --- Share context: inviter rank/percentile ---
class TestShareContext:
    def test_amina_share_context(self, s):
        r = s.get(f"{API}/share/{AMINA}")
        assert r.status_code == 200
        d = r.json()
        assert "inviter" in d and "tartan" in d and "stats" in d
        inv = d["inviter"]
        assert "rank" in inv and isinstance(inv["rank"], int)
        assert "percentile" in inv and 1 <= inv["percentile"] <= 100
        assert d["tartan"]["verified_organizer"] is True


# --- Chain (streak) ---
class TestChain:
    def test_amina_chain_has_streak(self, s):
        r = s.get(f"{API}/members/{AMINA}/chain")
        assert r.status_code == 200
        d = r.json()
        assert "streak" in d and isinstance(d["streak"], int)
        assert d["streak"] >= 0
        assert "rank" in d and "total_in_chain" in d


# --- Notifications + join creates them ---
class TestNotifications:
    def test_join_creates_notifications(self):
        # Create fresh chain
        sess = requests.Session()
        payload = {"title": "TEST_notif", "goal": "notif test", "nickname": "TEST_PARENT"}
        r = sess.post(f"{API}/tartans", json=payload)
        assert r.status_code == 200
        token = r.json()["tartan"]["token"]
        parent_share = r.json()["member"]["share_token"]

        # Different device joins via parent
        sess2 = requests.Session()
        r2 = sess2.post(f"{API}/tartans/{token}/join", json={
            "nickname": "TEST_KID", "parent_share_token": parent_share,
        })
        assert r2.status_code == 200
        kid_share = r2.json()["member"]["share_token"]

        # Parent should have a notification of type 'direct'
        n = sess.get(f"{API}/members/{parent_share}/notifications")
        assert n.status_code == 200
        nd = n.json()
        assert nd["unread"] >= 1
        assert any(x["type"] == "direct" for x in nd["notifications"])

        # A branch-level: grandchild join
        sess3 = requests.Session()
        r3 = sess3.post(f"{API}/tartans/{token}/join", json={
            "nickname": "TEST_GRANDKID", "parent_share_token": kid_share,
        })
        assert r3.status_code == 200
        # parent should now have a branch notification
        n2 = sess.get(f"{API}/members/{parent_share}/notifications").json()
        types = [x["type"] for x in n2["notifications"]]
        assert "branch" in types

        # Mark read
        mr = sess.post(f"{API}/members/{parent_share}/notifications/read")
        assert mr.status_code == 200
        n3 = sess.get(f"{API}/members/{parent_share}/notifications").json()
        assert n3["unread"] == 0

        TestNotifications.token = token
        TestNotifications.parent_share = parent_share


# --- Recap ---
class TestRecap:
    def test_amina_recap(self, s):
        r = s.get(f"{API}/members/{AMINA}/recap")
        assert r.status_code == 200
        d = r.json()
        for k in ("invited_this_week", "total_reached", "rank", "percentile", "spark_number"):
            assert k in d
        assert isinstance(d["invited_this_week"], int)


# --- Profile ---
class TestProfile:
    def test_amina_profile(self, s):
        r = s.get(f"{API}/profile/{AMINA}")
        assert r.status_code == 200
        d = r.json()
        assert d["member"]["share_token"] == AMINA
        assert d["member"]["spark_number"] == 1  # initiator
        assert "rank" in d["member"]
        assert d["verified_organizer"] is True
        assert d["tartan"]["token"] == PUNTLAND

    def test_profile_404(self, s):
        r = s.get(f"{API}/profile/does_not_exist")
        assert r.status_code == 404


# --- Milestone SSE ---
class TestMilestoneSSE:
    def test_milestone_event_on_crossing_10(self):
        # Fresh chain (initiator=1). Need 9 more joins to reach 10.
        sess = requests.Session()
        r = sess.post(f"{API}/tartans", json={
            "title": "TEST_milestone", "goal": "milestone test", "nickname": "TEST_MI"
        })
        assert r.status_code == 200
        token = r.json()["tartan"]["token"]
        init_share = r.json()["member"]["share_token"]

        events = []
        stop = threading.Event()

        def listen():
            try:
                with requests.get(f"{API}/tartans/{token}/stream", stream=True, timeout=45) as resp:
                    cur_event = None
                    for raw in resp.iter_lines(decode_unicode=True):
                        if stop.is_set():
                            break
                        if raw is None:
                            continue
                        if raw.startswith("event:"):
                            cur_event = raw.split(":", 1)[1].strip()
                        elif raw.startswith("data:"):
                            data = raw.split(":", 1)[1].strip()
                            events.append((cur_event, data))
                            if cur_event == "milestone":
                                stop.set()
                                break
            except Exception as e:
                print(f"listener error: {e}")

        t = threading.Thread(target=listen, daemon=True)
        t.start()
        time.sleep(1.5)  # let stream connect + initial stats

        # 9 fresh-device joins to cross 10
        for i in range(9):
            js = requests.Session()  # fresh device cookie
            jr = js.post(f"{API}/tartans/{token}/join", json={
                "nickname": f"TEST_J{i}", "parent_share_token": init_share,
            })
            assert jr.status_code == 200, jr.text
            time.sleep(0.15)

        # wait up to 8s for milestone event
        for _ in range(80):
            if stop.is_set():
                break
            time.sleep(0.1)
        stop.set()

        milestone_events = [e for e in events if e[0] == "milestone"]
        assert milestone_events, f"No milestone event. Got: {events[:20]}"
        payload = json.loads(milestone_events[0][1])
        assert payload["value"] == 10
