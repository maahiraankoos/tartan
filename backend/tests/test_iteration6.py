"""Iteration 6 tests: Push, Team Battles, Invite Rewards."""
import os
import re
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Push ----------
class TestPush:
    def test_vapid_public_key(self, sess):
        r = sess.get(f"{API}/push/vapid-public-key")
        assert r.status_code == 200
        key = r.json().get("key")
        assert isinstance(key, str)
        # base64url, uncompressed EC public key ~ 65 bytes -> ~87 chars
        assert 80 <= len(key) <= 100, f"unexpected key len {len(key)}"
        assert re.match(r"^[A-Za-z0-9_\-]+$", key), "not base64url"

    def test_subscribe_valid(self, sess):
        # Amina share
        r = sess.post(f"{API}/push/subscribe", json={
            "share_token": "j4atawQ7lw",
            "subscription": {
                "endpoint": f"https://fcm.example/test-{int(time.time())}",
                "keys": {"p256dh": "AAA", "auth": "BBB"},
            },
        })
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_subscribe_invalid_no_endpoint(self, sess):
        r = sess.post(f"{API}/push/subscribe", json={
            "share_token": "j4atawQ7lw",
            "subscription": {"keys": {"p256dh": "AAA", "auth": "BBB"}},
        })
        assert r.status_code == 400

    def test_subscribe_unknown_share(self, sess):
        r = sess.post(f"{API}/push/subscribe", json={
            "share_token": "nonexistent_xyz",
            "subscription": {"endpoint": "https://fcm.example/x", "keys": {}},
        })
        assert r.status_code == 404


# ---------- Team Battles ----------
@pytest.fixture(scope="module")
def team_chain(sess):
    r = sess.post(f"{API}/tartans", json={
        "title": "TEST_teams_" + str(int(time.time())),
        "goal": "Test team battle chain",
        "city": "Garowe",
        "goal_target": 20,
        "teams": ["Garowe Crew", "Bosaso Crew"],
        "nickname": "TEST_initiator",
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["tartan"]["token"], "initiator_share": d["member"]["share_token"]}


class TestTeams:
    def test_tartan_public_lists_teams(self, sess, team_chain):
        token = team_chain["token"]
        r = sess.get(f"{API}/tartans/{token}")
        assert r.status_code == 200
        data = r.json()
        assert data["tartan"]["teams"] == ["Garowe Crew", "Bosaso Crew"]

    def test_join_with_valid_team(self, sess, team_chain):
        token = team_chain["token"]
        s = requests.Session()  # fresh cookies
        r = s.post(f"{API}/tartans/{token}/join", json={
            "parent_share_token": team_chain["initiator_share"],
            "nickname": "TEST_bosaso",
            "city": "Bosaso",
            "team": "Bosaso Crew",
        })
        assert r.status_code == 200, r.text
        assert r.json()["member"]["team"] == "Bosaso Crew"

    def test_join_with_invalid_team_stores_null(self, sess, team_chain):
        token = team_chain["token"]
        s = requests.Session()
        r = s.post(f"{API}/tartans/{token}/join", json={
            "parent_share_token": team_chain["initiator_share"],
            "nickname": "TEST_noteam",
            "city": "Garowe",
            "team": "NotARealTeam",
        })
        assert r.status_code == 200, r.text
        assert r.json()["member"]["team"] is None

    def test_join_with_garowe(self, sess, team_chain):
        token = team_chain["token"]
        s = requests.Session()
        r = s.post(f"{API}/tartans/{token}/join", json={
            "parent_share_token": team_chain["initiator_share"],
            "nickname": "TEST_garowe",
            "city": "Garowe",
            "team": "Garowe Crew",
        })
        assert r.status_code == 200, r.text

    def test_scoreboard(self, sess, team_chain):
        token = team_chain["token"]
        r = sess.get(f"{API}/tartans/{token}/teams")
        assert r.status_code == 200
        data = r.json()
        assert data["teams"] == ["Garowe Crew", "Bosaso Crew"]
        board = data["scoreboard"]
        team_names = {row["team"] for row in board}
        assert "Bosaso Crew" in team_names
        assert "Garowe Crew" in team_names
        # sorted by reach desc
        reaches = [r["reach"] for r in board]
        assert reaches == sorted(reaches, reverse=True)

    def test_scoreboard_unknown_tartan_404(self, sess):
        r = sess.get(f"{API}/tartans/no_such_token_xyz/teams")
        assert r.status_code == 404


# ---------- Invite Rewards ----------
class TestRewards:
    def test_amina_reward_tier(self, sess):
        r = sess.get(f"{API}/profile/j4atawQ7lw")
        assert r.status_code == 200
        m = r.json()["member"]
        dc = m["direct_count"]
        reward = m["reward"]
        if dc >= 100:
            assert reward["tier"] == 3 and reward["name"] == "Igniter"
        elif dc >= 50:
            assert reward["tier"] == 2 and reward["name"] == "Connector"
        elif dc >= 10:
            assert reward["tier"] == 1 and reward["name"] == "Starter"
        else:
            assert reward["tier"] == 0
        print(f"Amina direct_count={dc} tier={reward['tier']} name={reward['name']}")

    def test_reward_tier_boundaries(self):
        # Direct helper import
        import sys
        sys.path.insert(0, "/app/backend")
        from server import reward_for
        assert reward_for(0)["tier"] == 0
        assert reward_for(9)["tier"] == 0
        assert reward_for(10)["tier"] == 1
        assert reward_for(49)["tier"] == 1
        assert reward_for(50)["tier"] == 2
        assert reward_for(99)["tier"] == 2
        assert reward_for(100)["tier"] == 3
        assert reward_for(100)["name"] == "Igniter"


# ---------- Reward on join / notifications ----------
class TestRewardJoinNotif:
    def test_join_creates_direct_notification_and_no_500(self, sess):
        # Create small chain, join once, check parent's notifications
        r = sess.post(f"{API}/tartans", json={
            "title": "TEST_reward_notif_" + str(int(time.time())),
            "goal": "reward+notif test",
            "city": "Garowe",
            "nickname": "TEST_parent",
        })
        assert r.status_code == 200, r.text
        parent_share = r.json()["member"]["share_token"]
        token = r.json()["tartan"]["token"]

        s2 = requests.Session()
        j = s2.post(f"{API}/tartans/{token}/join", json={
            "parent_share_token": parent_share,
            "nickname": "TEST_child",
            "city": "Bosaso",
        })
        assert j.status_code == 200, j.text
        time.sleep(0.5)

        n = sess.get(f"{API}/members/{parent_share}/notifications")
        assert n.status_code == 200
        notifs = n.json().get("notifications", [])
        assert any(x.get("type") == "direct" for x in notifs), notifs


# ---------- Regression sanity ----------
class TestRegression:
    def test_puntland_public(self, sess):
        r = sess.get(f"{API}/tartans/puntland")
        assert r.status_code == 200
        d = r.json()
        assert d["tartan"]["token"] == "puntland"
        assert "teams" in d["tartan"]  # new field present

    def test_amina_profile(self, sess):
        r = sess.get(f"{API}/profile/j4atawQ7lw")
        assert r.status_code == 200

    def test_leaderboard(self, sess):
        r = sess.get(f"{API}/tartans/puntland/leaderboard")
        assert r.status_code == 200
        # leaderboard returns list directly
        assert isinstance(r.json(), list)
