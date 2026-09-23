from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Header, Query
from fastapi.responses import StreamingResponse, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import hmac
import hashlib
import secrets
import logging
import time
import json
import uuid
import base64
import asyncio
import requests
import bcrypt
import jwt
import html as html_lib
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Annotated, Any
from datetime import datetime, timezone, timedelta
from collections import defaultdict


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SECRET = os.environ.get('TARTAN_SECRET', 'dev_secret').encode()

# ---- Object storage (Emergent) ----
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "tartan"
storage_key = None
MIME_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---- Real-time SSE pub/sub (in-process) ----
_subscribers: dict = defaultdict(set)


async def publish(token: str, event: dict):
    for q in list(_subscribers.get(token, [])):
        try:
            q.put_nowait(event)
        except Exception:
            pass


# ---- Web Push (VAPID) ----
VAPID_SUB = "mailto:admin@tartan.app"


async def get_vapid():
    cfg = await db.config.find_one({"_id": "vapid"})
    if cfg:
        return cfg["private_pem"], cfg["public_key"]
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    priv = ec.generate_private_key(ec.SECP256R1())
    priv_pem = priv.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    pub_bytes = priv.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    public_key = base64.urlsafe_b64encode(pub_bytes).rstrip(b"=").decode()
    await db.config.insert_one({"_id": "vapid", "private_pem": priv_pem, "public_key": public_key})
    return priv_pem, public_key


def _send_webpush(subscription: dict, payload: str, priv_pem: str) -> bool:
    """Returns False if the subscription is dead and should be removed."""
    from pywebpush import webpush, WebPushException
    try:
        webpush(subscription_info=subscription, data=payload, vapid_private_key=priv_pem,
                vapid_claims={"sub": VAPID_SUB})
        return True
    except WebPushException as e:
        code = getattr(getattr(e, "response", None), "status_code", None)
        return code not in (404, 410)
    except Exception:
        return True


async def push_to_member(member_id: str, title: str, body: str, url: str):
    subs = await db.push_subs.find({"member_id": member_id}).to_list(50)
    if not subs:
        return
    priv_pem, _ = await get_vapid()
    payload = json.dumps({"title": title, "body": body, "url": url})
    for s in subs:
        try:
            keep = await asyncio.to_thread(_send_webpush, s["subscription"], payload, priv_pem)
            if not keep:
                await db.push_subs.delete_one({"_id": s["_id"]})
        except Exception as e:
            logger.error("push failed: %s", e)


def reward_for(direct_count: int) -> dict:
    if direct_count >= 100:
        return {"tier": 3, "name": "Igniter", "next": None}
    if direct_count >= 50:
        return {"tier": 2, "name": "Connector", "next": 100}
    if direct_count >= 10:
        return {"tier": 1, "name": "Starter", "next": 50}
    return {"tier": 0, "name": None, "next": 10}


app = FastAPI()
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CITY_COORDS = {
    "Garowe": {"x": 0.58, "y": 0.42, "region": "Puntland"},
    "Bosaso": {"x": 0.60, "y": 0.30, "region": "Puntland"},
    "Galkayo": {"x": 0.55, "y": 0.52, "region": "Puntland"},
    "Mogadishu": {"x": 0.52, "y": 0.66, "region": "Somalia"},
    "Hargeisa": {"x": 0.47, "y": 0.36, "region": "Somaliland"},
    "Nairobi": {"x": 0.45, "y": 0.80, "region": "Kenya"},
    "Dubai": {"x": 0.66, "y": 0.20, "region": "UAE"},
    "London": {"x": 0.18, "y": 0.12, "region": "UK"},
    "Minneapolis": {"x": 0.08, "y": 0.22, "region": "USA"},
    "Toronto": {"x": 0.12, "y": 0.18, "region": "Canada"},
    "Remote": {"x": 0.30, "y": 0.60, "region": "Global"},
}

MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 5000]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sign(value: str) -> str:
    return hmac.new(SECRET, value.encode(), hashlib.sha256).hexdigest()[:32]


def make_token(nbytes: int = 6) -> str:
    return secrets.token_urlsafe(nbytes).rstrip("=").replace("_", "").replace("-", "")[:10]


def get_or_issue_device(request: Request, response: Response) -> str:
    """Read a signed device cookie or issue a fresh one."""
    raw = request.cookies.get("td")
    if raw and "." in raw:
        dev, sig = raw.rsplit(".", 1)
        if hmac.compare_digest(sig, sign(dev)):
            return dev
    dev = secrets.token_urlsafe(12)
    cookie = f"{dev}.{sign(dev)}"
    response.set_cookie(
        "td", cookie, max_age=60 * 60 * 24 * 365, httponly=True,
        samesite="none", secure=True,
    )
    return dev


# very small in-process per-IP window limiter
_ip_hits: dict = defaultdict(list)


def ip_rate_ok(ip: str, limit: int = 20, window: int = 60) -> bool:
    now = time.time()
    hits = [t for t in _ip_hits[ip] if now - t < window]
    hits.append(now)
    _ip_hits[ip] = hits
    return len(hits) <= limit


# ---------------------------------------------------------------------------
# Auth (JWT email/password)
# ---------------------------------------------------------------------------

JWT_ALGORITHM = "HS256"
ACCOUNT_TYPES = {"creator", "company"}


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=60 * 60 * 12, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=60 * 60 * 24 * 30, path="/")


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name"),
        "role": u.get("role", "creator"),
        "org_name": u.get("org_name"),
        "created_at": u.get("created_at"),
    }


async def current_user_optional(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return None
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        u = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        return u
    except jwt.PyJWTError:
        return None


async def require_user(request: Request):
    u = await current_user_optional(request)
    if not u:
        raise HTTPException(status_code=401, detail="Please sign in to continue")
    return u


async def require_admin(request: Request):
    u = await require_user(request)
    if u.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return u


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

CATEGORIES = [
    {"id": "reconnect", "label": "Reconnect", "emoji": "🎓",
     "blurb": "Find your people again — school, college, workplace or old crew.",
     "example": "Reconnect the Class of 2010, Lincoln High"},
    {"id": "cause", "label": "Cause & Awareness", "emoji": "📣",
     "blurb": "Rally people behind an idea that matters.",
     "example": "Clean water for every village"},
    {"id": "event", "label": "Event", "emoji": "🎉",
     "blurb": "Spread the word and fill the room.",
     "example": "Garowe Tech Meetup — August"},
    {"id": "fundraiser", "label": "Fundraiser", "emoji": "💛",
     "blurb": "Grow the chain of givers, person to person.",
     "example": "Help rebuild the community library"},
    {"id": "brand", "label": "Brand & Company", "emoji": "🚀",
     "blurb": "Launch a referral wave for your product or brand.",
     "example": "Refer friends to our new app"},
    {"id": "challenge", "label": "Challenge", "emoji": "🔥",
     "blurb": "Start a movement people can't help but pass on.",
     "example": "The 7-day kindness challenge"},
]
CATEGORY_IDS = {c["id"] for c in CATEGORIES}
CATEGORY_LABEL = {c["id"]: c["label"] for c in CATEGORIES}

from og_card import render_card, palette_for


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class TartanCreate(BaseModel):
    title: str
    goal: str
    city: Optional[str] = None
    nickname: str
    real_name: Optional[str] = None
    goal_target: Optional[int] = None
    teams: Optional[List[str]] = None
    category: Optional[str] = None
    target: Optional[str] = None


class RegisterCreate(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    account_type: str = "creator"
    org_name: Optional[str] = None


class LoginCreate(BaseModel):
    email: str
    password: str


class AdminFlag(BaseModel):
    value: bool



class JoinCreate(BaseModel):
    nickname: str
    city: Optional[str] = None
    real_name: Optional[str] = None
    parent_share_token: Optional[str] = None
    idempotency_key: Optional[str] = None
    avatar_file_id: Optional[str] = None
    team: Optional[str] = None


class ReportCreate(BaseModel):
    tartan_token: str
    target_share_token: Optional[str] = None
    reason: str
    kind: str = "report"  # report | block


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def member_public(m: dict) -> dict:
    return {
        "id": m["id"],
        "share_token": m["share_token"],
        "nickname": m["nickname"],
        "real_name": m.get("real_name"),
        "city": m.get("city") or "Remote",
        "verified": m.get("verified", False),
        "depth": m.get("depth", 0),
        "direct_count": m.get("direct_count", 0),
        "downstream_count": m.get("downstream_count", 0),
        "created_at": m.get("created_at"),
        "is_initiator": m.get("is_initiator", False),
        "avatar_url": f"/api/avatar/{m['share_token']}" if m.get("avatar_path") else None,
        "spark_number": m.get("spark_number"),
        "team": m.get("team"),
        "reward": reward_for(m.get("direct_count", 0)),
    }


def tartan_public(t: dict) -> dict:
    return {
        "id": t["id"],
        "token": t["token"],
        "title": t["title"],
        "goal": t["goal"],
        "city": t.get("city") or "Remote",
        "initiator_share_token": t.get("initiator_share_token"),
        "initiator_nickname": t.get("initiator_nickname"),
        "featured": t.get("featured", False),
        "featured_until": t.get("featured_until"),
        "total_members": t.get("total_members", 0),
        "verified_members": t.get("verified_members", 0),
        "max_depth": t.get("max_depth", 0),
        "goal_target": t.get("goal_target"),
        "verified_organizer": t.get("verified_members", 0) >= 25,
        "teams": t.get("teams") or [],
        "category": t.get("category"),
        "target": t.get("target"),
        "hidden": t.get("hidden", False),
        "feature_requested": t.get("feature_requested", False),
        "owner_user_id": t.get("owner_user_id"),
        "owner_name": t.get("owner_name"),
        "created_at": t.get("created_at"),
    }


async def member_rank(tartan_id: str, downstream: int):
    ahead = await db.members.count_documents({"tartan_id": tartan_id, "downstream_count": {"$gt": downstream}})
    total = await db.members.count_documents({"tartan_id": tartan_id})
    rank = ahead + 1
    pct = max(1, round((1 - (rank - 1) / max(1, total)) * 100))
    return rank, total, pct


async def compute_stats(t: dict) -> dict:
    token = t["token"]
    since_1h = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    since_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    velocity_1h = await db.members.count_documents({"tartan_id": token, "created_at": {"$gte": since_1h}})
    velocity_24h = await db.members.count_documents({"tartan_id": token, "created_at": {"$gte": since_24h}})
    cities = await db.members.distinct("city", {"tartan_id": token})
    cities = [c for c in cities if c]
    return {
        "total_members": t.get("total_members", 0),
        "verified_members": t.get("verified_members", 0),
        "unverified_members": max(0, t.get("total_members", 0) - t.get("verified_members", 0)),
        "max_depth": t.get("max_depth", 0),
        "active_cities": len(cities),
        "velocity_1h": velocity_1h,
        "velocity_24h": velocity_24h,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@api_router.get("/")
async def root():
    return {"message": "Tartan API"}


@api_router.get("/tartans")
async def list_tartans(category: Optional[str] = Query(None)):
    await expire_featured()
    q: dict = {"hidden": {"$ne": True}}
    if category and category in CATEGORY_IDS:
        q["category"] = category
    docs = await db.tartans.find(q, {"_id": 0}).sort([("featured", -1), ("total_members", -1)]).to_list(200)
    return [tartan_public(d) for d in docs]


@api_router.get("/categories")
async def list_categories():
    counts = await db.tartans.aggregate([
        {"$match": {"hidden": {"$ne": True}}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]).to_list(100)
    cmap = {c["_id"]: c["count"] for c in counts}
    return [{**c, "count": cmap.get(c["id"], 0)} for c in CATEGORIES]


@api_router.post("/tartans")
async def create_tartan(payload: TartanCreate, request: Request, response: Response):
    device = get_or_issue_device(request, response)
    ip = request.client.host if request.client else "?"
    if not ip_rate_ok(ip, limit=10):
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")

    owner = await current_user_optional(request)

    token = make_token()
    while await db.tartans.find_one({"token": token}):
        token = make_token()

    initiator_share = make_token(8)
    ts = now_iso()

    tartan = {
        "id": secrets.token_hex(12),
        "token": token,
        "title": payload.title.strip()[:80],
        "goal": payload.goal.strip()[:140],
        "city": (payload.city or "").strip()[:40] or None,
        "initiator_share_token": initiator_share,
        "initiator_nickname": payload.nickname.strip()[:18],
        "featured": False,
        "hidden": False,
        "feature_requested": False,
        "category": (payload.category if payload.category in CATEGORY_IDS else "other"),
        "target": (payload.target or "").strip()[:120] or None,
        "owner_user_id": owner["id"] if owner else None,
        "owner_name": (owner.get("org_name") or owner.get("name") or owner.get("email")) if owner else None,
        "total_members": 1,
        "verified_members": 1,
        "max_depth": 0,
        "goal_target": (payload.goal_target if payload.goal_target and payload.goal_target > 0 else None),
        "teams": [x.strip()[:24] for x in (payload.teams or []) if x and x.strip()][:6],
        "created_at": ts,
    }
    await db.tartans.insert_one(dict(tartan))

    initiator = {
        "id": secrets.token_hex(12),
        "tartan_id": token,
        "share_token": initiator_share,
        "nickname": payload.nickname.strip()[:18],
        "real_name": (payload.real_name or "").strip()[:40] or None,
        "city": (payload.city or "").strip()[:40] or "Remote",
        "parent_share_token": None,
        "parent_id": None,
        "device": device,
        "verified": True,
        "is_initiator": True,
        "depth": 0,
        "direct_count": 0,
        "downstream_count": 0,
        "spark_number": 1,
        "created_at": ts,
    }
    await db.members.insert_one(dict(initiator))

    return {"tartan": tartan_public(tartan), "member": member_public(initiator)}


@api_router.get("/tartans/{token}")
async def get_tartan(token: str):
    t = await db.tartans.find_one({"token": token}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tartan not found")
    stats = await compute_stats(t)
    return {"tartan": tartan_public(t), "stats": stats}


@api_router.get("/tartans/{token}/map")
async def get_map(token: str):
    t = await db.tartans.find_one({"token": token}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tartan not found")
    pipeline = [
        {"$match": {"tartan_id": token}},
        {"$group": {
            "_id": {"$ifNull": ["$city", "Remote"]},
            "count": {"$sum": 1},
            "verified": {"$sum": {"$cond": ["$verified", 1, 0]}},
        }},
        {"$sort": {"count": -1}},
    ]
    rows = await db.members.aggregate(pipeline).to_list(100)
    nodes = []
    for r in rows:
        city = r["_id"] or "Remote"
        coord = CITY_COORDS.get(city, CITY_COORDS["Remote"])
        nodes.append({
            "city": city,
            "count": r["count"],
            "verified": r["verified"],
            "x": coord["x"],
            "y": coord["y"],
            "region": coord["region"],
        })
    hub_city = t.get("city") if t.get("city") in CITY_COORDS else "Garowe"
    return {"nodes": nodes, "hub": hub_city}


@api_router.get("/share/{share_token}")
async def get_share_context(share_token: str):
    """Landing context: who invited you + tartan preview."""
    m = await db.members.find_one({"share_token": share_token}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Invite link not found")
    t = await db.tartans.find_one({"token": m["tartan_id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tartan not found")
    stats = await compute_stats(t)
    inv_rank, _, inv_pct = await member_rank(t["token"], m.get("downstream_count", 0))
    inviter = member_public(m)
    inviter["rank"] = inv_rank
    inviter["percentile"] = inv_pct
    return {
        "inviter": inviter,
        "tartan": tartan_public(t),
        "stats": stats,
    }


@api_router.get("/og/{token}.png")
async def og_image(token: str):
    m = await db.members.find_one({"share_token": token}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Not found")
    t = await db.tartans.find_one({"token": m["tartan_id"]}, {"_id": 0})
    rank, total, pct = await member_rank(m["tartan_id"], m.get("downstream_count", 0))
    directs = await db.members.find({"parent_share_token": token}, {"nickname": 1}).limit(8).to_list(8)
    initials = [(d.get("nickname") or "?").strip()[:1].upper() for d in directs]
    primary, secondary = palette_for((t or {}).get("token") or token)
    data = {
        "nickname": m.get("nickname"),
        "reach": m.get("downstream_count", 0),
        "spark_number": m.get("spark_number"),
        "rank": rank,
        "percentile": pct,
        "title": (t or {}).get("title") or "Tartan chain",
        "category_label": CATEGORY_LABEL.get((t or {}).get("category")),
        "primary": primary,
        "secondary": secondary,
    }
    png = await asyncio.to_thread(render_card, data, initials)
    return Response(content=png, media_type="image/png",
                    headers={"Cache-Control": "public, max-age=300"})


def _public_base(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "localhost"
    scheme = request.headers.get("x-forwarded-proto", "https")
    return f"{scheme}://{host}"


@api_router.get("/s/{token}")
async def share_landing(token: str, request: Request):
    """HTML wrapper that unfurls into the share card, then bounces real
    browsers into the SPA invite page."""
    m = await db.members.find_one({"share_token": token}, {"_id": 0})
    base = _public_base(request)
    frontend_base = os.environ.get("FRONTEND_URL", "").rstrip("/")
    app_url = f"{frontend_base}/j/{token}" if frontend_base else f"/j/{token}"
    if not m:
        title, desc, image = "Tartan — the living human chain", "Join a chain and watch one idea travel person to person.", f"{base}/api/og/none.png"
    else:
        t = await db.tartans.find_one({"token": m["tartan_id"]}, {"_id": 0})
        nick = m.get("nickname") or "Someone"
        reach = m.get("downstream_count", 0)
        ttitle = (t or {}).get("title") or "a Tartan chain"
        title = f"{nick} invited you to a Tartan"
        desc = f"{nick}'s chain has reached {reach:,} people. Tap to join \u201c{ttitle}\u201d and keep it moving."
        image = f"{base}/api/og/{token}.png"
    e = html_lib.escape
    html_doc = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Tartan"/>
<meta property="og:title" content="{e(title)}"/>
<meta property="og:description" content="{e(desc)}"/>
<meta property="og:image" content="{e(image)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="{e(base + '/api/s/' + token)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="{e(title)}"/>
<meta name="twitter:description" content="{e(desc)}"/>
<meta name="twitter:image" content="{e(image)}"/>
<meta http-equiv="refresh" content="0; url={e(app_url)}"/>
<style>html,body{{margin:0;height:100%;background:#070B14;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center}}.d{{text-align:center}}.p{{width:34px;height:34px;border:3px solid rgba(0,240,255,.25);border-top-color:#00F0FF;border-radius:50%;margin:0 auto 14px;animation:s .8s linear infinite}}@keyframes s{{to{{transform:rotate(360deg)}}}}a{{color:#00F0FF}}</style>
</head><body>
<div class="d"><div class="p"></div>Opening Tartan… <br/><a href="{e(app_url)}">Continue</a></div>
<script>window.location.replace({app_url!r});</script>
</body></html>"""
    return HTMLResponse(content=html_doc, headers={"Cache-Control": "public, max-age=60"})


@api_router.post("/tartans/{token}/join")
async def join_tartan(token: str, payload: JoinCreate, request: Request, response: Response):
    device = get_or_issue_device(request, response)
    ip = request.client.host if request.client else "?"
    if not ip_rate_ok(ip, limit=20):
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")

    t = await db.tartans.find_one({"token": token})
    if not t:
        raise HTTPException(status_code=404, detail="Tartan not found")

    # idempotency: same device + same key returns the existing node
    if payload.idempotency_key:
        existing = await db.members.find_one(
            {"tartan_id": token, "device": device, "idem": payload.idempotency_key}, {"_id": 0}
        )
        if existing:
            return {"member": member_public(existing)}

    # resolve parent
    parent = None
    parent_share = payload.parent_share_token
    if parent_share:
        parent = await db.members.find_one({"tartan_id": token, "share_token": parent_share})
    if not parent:
        parent = await db.members.find_one({"tartan_id": token, "share_token": t["initiator_share_token"]})
    if not parent:
        raise HTTPException(status_code=400, detail="No parent to attach to")

    # verified = first membership from this device in this tartan
    prior = await db.members.count_documents({"tartan_id": token, "device": device})
    if prior >= 25:
        raise HTTPException(status_code=429, detail="This device has joined too many times.")
    verified = prior == 0

    share = make_token(8)
    while await db.members.find_one({"share_token": share}):
        share = make_token(8)

    # resolve optional avatar
    avatar_path = None
    if payload.avatar_file_id:
        f = await db.files.find_one({"id": payload.avatar_file_id, "device": device})
        if f:
            avatar_path = f["storage_path"]

    ts = now_iso()
    depth = parent.get("depth", 0) + 1
    member = {
        "id": secrets.token_hex(12),
        "tartan_id": token,
        "share_token": share,
        "nickname": payload.nickname.strip()[:18] or "Anonymous",
        "real_name": (payload.real_name or "").strip()[:40] or None,
        "city": (payload.city or "").strip()[:40] or "Remote",
        "parent_share_token": parent["share_token"],
        "parent_id": parent["id"],
        "device": device,
        "idem": payload.idempotency_key,
        "verified": verified,
        "is_initiator": False,
        "depth": depth,
        "direct_count": 0,
        "downstream_count": 0,
        "verified_downstream": 0,
        "avatar_path": avatar_path,
        "spark_number": (t.get("total_members", 0) + 1),
        "team": (payload.team.strip()[:24] if payload.team and payload.team.strip() and payload.team in (t.get("teams") or []) else None),
        "created_at": ts,
    }
    await db.members.insert_one(dict(member))

    # denormalized updates: direct parent +1 direct; all ancestors +1 downstream
    await db.members.update_one({"id": parent["id"]}, {"$inc": {"direct_count": 1}})
    inc_verified = 1 if verified else 0
    ancestor_id = parent["id"]
    idx = 0
    notif_docs = []
    while ancestor_id:
        anc = await db.members.find_one({"id": ancestor_id}, {"parent_id": 1, "id": 1})
        if not anc:
            break
        await db.members.update_one(
            {"id": ancestor_id},
            {"$inc": {"downstream_count": 1, "verified_downstream": inc_verified}},
        )
        if idx < 3:
            notif_docs.append({
                "id": secrets.token_hex(12),
                "member_id": ancestor_id,
                "tartan_id": token,
                "type": "direct" if idx == 0 else "branch",
                "joiner_nickname": member["nickname"],
                "joiner_city": member["city"],
                "created_at": ts,
                "read": False,
            })
        idx += 1
        ancestor_id = anc.get("parent_id")
    if notif_docs:
        await db.notifications.insert_many(notif_docs)

    # push the direct parent (fire and forget)
    asyncio.create_task(push_to_member(
        parent["id"], "Someone joined through you! ⚡",
        f"{member['nickname']} · {member['city']} joined your chain",
        f"/me/{parent['share_token']}",
    ))
    # invite reward crossing
    new_direct = parent.get("direct_count", 0) + 1
    if new_direct in (10, 50, 100):
        r = reward_for(new_direct)
        asyncio.create_task(push_to_member(
            parent["id"], f"Reward unlocked: {r['name']}! 🏆",
            f"You've invited {new_direct} people. New badge and aura unlocked.",
            f"/me/{parent['share_token']}",
        ))

    prev_total = t.get("total_members", 0)
    await db.tartans.update_one(
        {"token": token},
        {"$inc": {"total_members": 1, "verified_members": inc_verified},
         "$max": {"max_depth": depth}},
    )
    new_total = prev_total + 1
    crossed = [m for m in MILESTONES if prev_total < m <= new_total]

    # real-time fan-out
    t2 = await db.tartans.find_one({"token": token}, {"_id": 0})
    if t2:
        await publish(token, {"type": "stats", "data": await compute_stats(t2)})
    await publish(token, {"type": "join", "data": {
        "nickname": member["nickname"], "city": member["city"], "verified": verified,
    }})
    if crossed:
        await publish(token, {"type": "milestone", "data": {"value": crossed[0], "title": t.get("title")}})

    return {"member": member_public(member)}


@api_router.get("/members/{share_token}/chain")
async def get_chain(share_token: str):
    me = await db.members.find_one({"share_token": share_token}, {"_id": 0})
    if not me:
        raise HTTPException(status_code=404, detail="Member not found")
    t = await db.tartans.find_one({"token": me["tartan_id"]}, {"_id": 0})

    inviter = None
    if me.get("parent_share_token"):
        p = await db.members.find_one({"share_token": me["parent_share_token"]}, {"_id": 0})
        if p:
            inviter = member_public(p)

    directs = await db.members.find(
        {"parent_share_token": share_token}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)

    dc = me.get("downstream_count", 0)
    reached = [m for m in MILESTONES if dc >= m]
    next_milestone = next((m for m in MILESTONES if m > dc), None)

    total_in_chain = t.get("total_members", 1) if t else 1
    ahead = await db.members.count_documents(
        {"tartan_id": me["tartan_id"], "downstream_count": {"$gt": dc}}
    )
    rank = ahead + 1
    percentile = max(1, round((1 - (rank - 1) / max(1, total_in_chain)) * 100))

    # share streak: consecutive days (ending today) the member invited someone
    direct_dates = set((d.get("created_at") or "")[:10] for d in directs)
    streak = 0
    cur = datetime.now(timezone.utc).date()
    while cur.isoformat() in direct_dates:
        streak += 1
        cur = cur - timedelta(days=1)

    return {
        "me": member_public(me),
        "inviter": inviter,
        "directs": [member_public(d) for d in directs],
        "tartan": tartan_public(t) if t else None,
        "milestones_reached": reached,
        "next_milestone": next_milestone,
        "rank": rank,
        "total_in_chain": total_in_chain,
        "percentile": percentile,
        "streak": streak,
    }


@api_router.post("/avatars")
async def upload_avatar(request: Request, response: Response, file: UploadFile = File(...)):
    device = get_or_issue_device(request, response)
    ext = (file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png")
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    path = f"{APP_NAME}/avatars/{device}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, MIME_TYPES[ext])
    except Exception as e:
        logger.error("avatar upload failed: %s", e)
        raise HTTPException(status_code=502, detail="Upload failed, please try again")
    fid = uuid.uuid4().hex
    await db.files.insert_one({
        "id": fid, "storage_path": result["path"], "content_type": MIME_TYPES[ext],
        "device": device, "created_at": now_iso(),
    })
    return {"avatar_file_id": fid}


@api_router.post("/members/{share_token}/avatar")
async def set_member_avatar(share_token: str, request: Request, response: Response, file: UploadFile = File(...)):
    device = get_or_issue_device(request, response)
    m = await db.members.find_one({"share_token": share_token})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    if m.get("device") != device:
        raise HTTPException(status_code=403, detail="Not your membership")
    ext = (file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png")
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    path = f"{APP_NAME}/avatars/{device}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, MIME_TYPES[ext])
    except Exception as e:
        logger.error("avatar upload failed: %s", e)
        raise HTTPException(status_code=502, detail="Upload failed, please try again")
    await db.members.update_one({"share_token": share_token}, {"$set": {"avatar_path": result["path"]}})
    return {"ok": True, "avatar_url": f"/api/avatar/{share_token}"}


@api_router.get("/avatar/{share_token}")
async def get_avatar(share_token: str):
    m = await db.members.find_one({"share_token": share_token}, {"avatar_path": 1})
    if not m or not m.get("avatar_path"):
        raise HTTPException(status_code=404, detail="No avatar")
    try:
        content, ctype = get_object(m["avatar_path"])
    except Exception:
        raise HTTPException(status_code=404, detail="No avatar")
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=3600"})


@api_router.get("/tartans/{token}/stream")
async def stream(token: str, request: Request):
    q: asyncio.Queue = asyncio.Queue()
    _subscribers[token].add(q)

    async def gen():
        try:
            t = await db.tartans.find_one({"token": token}, {"_id": 0})
            if t:
                yield f"event: stats\ndata: {json.dumps(await compute_stats(t))}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"event: {ev['type']}\ndata: {json.dumps(ev['data'])}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            _subscribers[token].discard(q)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no",
    })


@api_router.get("/tartans/{token}/analytics")
async def analytics(token: str, owner: str = Query(...)):
    t = await db.tartans.find_one({"token": token}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tartan not found")
    initiator = await db.members.find_one({"tartan_id": token, "share_token": owner})
    if not initiator or not initiator.get("is_initiator"):
        raise HTTPException(status_code=403, detail="Only the initiator can view analytics")

    members = await db.members.find({"tartan_id": token}, {"_id": 0}).to_list(100000)

    # reach timeline (last 14 days, by day)
    day_counts: dict = defaultdict(lambda: {"joins": 0, "verified": 0})
    for m in members:
        ca = m.get("created_at")
        if not ca:
            continue
        day = ca[:10]
        day_counts[day]["joins"] += 1
        if m.get("verified"):
            day_counts[day]["verified"] += 1
    today = datetime.now(timezone.utc).date()
    timeline = []
    cumulative = 0
    days_sorted = sorted(day_counts.keys())
    for d in days_sorted:
        cumulative += day_counts[d]["joins"]
        timeline.append({"date": d, "joins": day_counts[d]["joins"],
                         "verified": day_counts[d]["verified"], "cumulative": cumulative})

    # depth distribution
    depth_map: dict = defaultdict(int)
    for m in members:
        depth_map[m.get("depth", 0)] += 1
    depth_distribution = [{"depth": k, "count": depth_map[k]} for k in sorted(depth_map.keys())]

    # geography
    geo_map: dict = defaultdict(lambda: {"count": 0, "verified": 0})
    for m in members:
        c = m.get("city") or "Remote"
        geo_map[c]["count"] += 1
        if m.get("verified"):
            geo_map[c]["verified"] += 1
    geography = sorted(
        [{"city": k, "count": v["count"], "verified": v["verified"]} for k, v in geo_map.items()],
        key=lambda x: -x["count"],
    )

    # top branches = direct children of initiator, by downstream reach
    branches = [m for m in members if m.get("parent_id") == initiator["id"]]
    branches.sort(key=lambda x: -(x.get("downstream_count", 0)))
    top_branches = [{
        "nickname": b["nickname"], "city": b.get("city") or "Remote",
        "share_token": b["share_token"], "direct_count": b.get("direct_count", 0),
        "downstream_count": b.get("downstream_count", 0),
    } for b in branches[:8]]

    return {
        "tartan": tartan_public(t),
        "stats": await compute_stats(t),
        "timeline": timeline,
        "depth_distribution": depth_distribution,
        "geography": geography,
        "top_branches": top_branches,
    }


@api_router.get("/tartans/{token}/leaderboard")
async def leaderboard(token: str):
    t = await db.tartans.find_one({"token": token})
    if not t:
        raise HTTPException(status_code=404, detail="Tartan not found")
    docs = await db.members.find({"tartan_id": token}, {"_id": 0}).sort(
        [("downstream_count", -1), ("direct_count", -1), ("created_at", 1)]
    ).limit(20).to_list(20)
    out = []
    for i, m in enumerate(docs):
        pm = member_public(m)
        pm["rank"] = i + 1
        out.append(pm)
    return out


@api_router.get("/members/{share_token}/notifications")
async def get_notifications(share_token: str):
    me = await db.members.find_one({"share_token": share_token}, {"id": 1})
    if not me:
        raise HTTPException(status_code=404, detail="Member not found")
    docs = await db.notifications.find({"member_id": me["id"]}, {"_id": 0}).sort("created_at", -1).limit(30).to_list(30)
    unread = await db.notifications.count_documents({"member_id": me["id"], "read": False})
    return {"notifications": docs, "unread": unread}


@api_router.post("/members/{share_token}/notifications/read")
async def read_notifications(share_token: str):
    me = await db.members.find_one({"share_token": share_token}, {"id": 1})
    if not me:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.notifications.update_many({"member_id": me["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@api_router.get("/members/{share_token}/recap")
async def recap(share_token: str):
    me = await db.members.find_one({"share_token": share_token}, {"_id": 0})
    if not me:
        raise HTTPException(status_code=404, detail="Member not found")
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    invited_week = await db.members.count_documents({"parent_id": me["id"], "created_at": {"$gte": week_ago}})
    rank, total, pct = await member_rank(me["tartan_id"], me.get("downstream_count", 0))
    return {
        "invited_this_week": invited_week,
        "total_reached": me.get("downstream_count", 0),
        "direct_count": me.get("direct_count", 0),
        "rank": rank,
        "percentile": pct,
        "spark_number": me.get("spark_number"),
    }


@api_router.get("/profile/{share_token}")
async def profile(share_token: str):
    me = await db.members.find_one({"share_token": share_token}, {"_id": 0})
    if not me:
        raise HTTPException(status_code=404, detail="Member not found")
    t = await db.tartans.find_one({"token": me["tartan_id"]}, {"_id": 0})
    rank, total, pct = await member_rank(me["tartan_id"], me.get("downstream_count", 0))
    pm = member_public(me)
    pm["rank"] = rank
    pm["percentile"] = pct
    return {
        "member": pm,
        "tartan": tartan_public(t) if t else None,
        "verified_organizer": (t.get("verified_members", 0) >= 25) if t else False,
    }


class PushSub(BaseModel):
    share_token: str
    subscription: dict


@api_router.get("/push/vapid-public-key")
async def vapid_public():
    _, pub = await get_vapid()
    return {"key": pub}


@api_router.post("/push/subscribe")
async def push_subscribe(payload: PushSub):
    me = await db.members.find_one({"share_token": payload.share_token}, {"id": 1})
    if not me:
        raise HTTPException(status_code=404, detail="Member not found")
    endpoint = payload.subscription.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Invalid subscription")
    await db.push_subs.update_one(
        {"endpoint": endpoint},
        {"$set": {"member_id": me["id"], "subscription": payload.subscription,
                  "endpoint": endpoint, "created_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/tartans/{token}/teams")
async def team_scoreboard(token: str):
    t = await db.tartans.find_one({"token": token})
    if not t:
        raise HTTPException(status_code=404, detail="Tartan not found")
    pipeline = [
        {"$match": {"tartan_id": token, "team": {"$ne": None}}},
        {"$group": {"_id": "$team", "members": {"$sum": 1},
                    "verified": {"$sum": {"$cond": ["$verified", 1, 0]}},
                    "reach": {"$sum": "$downstream_count"}}},
        {"$sort": {"reach": -1, "members": -1}},
    ]
    rows = await db.members.aggregate(pipeline).to_list(50)
    return {
        "teams": t.get("teams") or [],
        "scoreboard": [{"team": r["_id"], "members": r["members"], "verified": r["verified"], "reach": r["reach"]} for r in rows],
    }


@api_router.post("/reports")
async def create_report(payload: ReportCreate, request: Request, response: Response):
    device = get_or_issue_device(request, response)
    doc = {
        "id": secrets.token_hex(12),
        "tartan_token": payload.tartan_token,
        "target_share_token": payload.target_share_token,
        "reason": payload.reason.strip()[:300],
        "kind": payload.kind,
        "device": device,
        "created_at": now_iso(),
    }
    await db.reports.insert_one(dict(doc))
    return {"ok": True, "id": doc["id"]}


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@api_router.post("/auth/register")
async def register(payload: RegisterCreate, response: Response):
    email = payload.email.strip().lower()
    if "@" not in email or len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Enter a valid email and a password of at least 6 characters")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    account_type = payload.account_type if payload.account_type in ACCOUNT_TYPES else "creator"
    user = {
        "id": secrets.token_hex(12),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": (payload.name or "").strip()[:60] or None,
        "role": account_type,
        "org_name": (payload.org_name or "").strip()[:80] or None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": user_public(user), "token": access}


@api_router.post("/auth/login")
async def login(payload: LoginCreate, request: Request, response: Response):
    email = payload.email.strip().lower()
    ip = request.client.host if request.client else "?"
    ident = f"{ip}:{email}"
    rec = await db.login_attempts.find_one({"identifier": ident})
    if rec and rec.get("count", 0) >= 5:
        locked_until = rec.get("locked_until")
        if locked_until and locked_until > now_iso():
            raise HTTPException(status_code=429, detail="Too many attempts. Try again in a few minutes.")
    u = await db.users.find_one({"email": email})
    if not u or not verify_password(payload.password, u["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$inc": {"count": 1},
             "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Wrong email or password")
    await db.login_attempts.delete_one({"identifier": ident})
    access = create_access_token(u["id"], email)
    refresh = create_refresh_token(u["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": user_public(u), "token": access}


@api_router.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api_router.get("/auth/me")
async def auth_me(request: Request):
    u = await require_user(request)
    return {"user": user_public(u)}


@api_router.post("/auth/refresh")
async def auth_refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
        u = await db.users.find_one({"id": payload["sub"]})
        if not u:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(u["id"], u["email"])
        response.set_cookie("access_token", access, httponly=True, secure=True,
                            samesite="none", max_age=60 * 60 * 12, path="/")
        return {"user": user_public(u), "token": access}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Creator endpoints
# ---------------------------------------------------------------------------

@api_router.get("/my/tartans")
async def my_tartans(request: Request):
    u = await require_user(request)
    await expire_featured()
    docs = await db.tartans.find({"owner_user_id": u["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [tartan_public(d) for d in docs]


@api_router.post("/tartans/{token}/feature-request")
async def request_feature(token: str, request: Request):
    u = await require_user(request)
    t = await db.tartans.find_one({"token": token})
    if not t:
        raise HTTPException(status_code=404, detail="Tartan not found")
    if t.get("owner_user_id") != u["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can request featuring")
    await db.tartans.update_one({"token": token}, {"$set": {"feature_requested": True, "feature_requested_at": now_iso()}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Featured placement (offline payment) — plans, orders, auto-expiry
# ---------------------------------------------------------------------------

FEATURE_PLANS = [
    {"id": "7d", "label": "7 days", "days": 7, "price": 19, "currency": "USD",
     "blurb": "A week on the home page & top of your category."},
    {"id": "30d", "label": "30 days", "days": 30, "price": 49, "currency": "USD",
     "blurb": "A full month of prime visibility — best value.", "best_value": True},
]
PLAN_MAP = {p["id"]: p for p in FEATURE_PLANS}


class FeatureOrderCreate(BaseModel):
    plan: str


def order_public(o: dict) -> dict:
    return {
        "id": o["id"],
        "tartan_token": o["tartan_token"],
        "tartan_title": o.get("tartan_title"),
        "plan": o["plan"],
        "days": o.get("days"),
        "amount": o.get("amount"),
        "currency": o.get("currency", "USD"),
        "status": o.get("status"),
        "owner_name": o.get("owner_name"),
        "owner_user_id": o.get("owner_user_id"),
        "created_at": o.get("created_at"),
        "activated_at": o.get("activated_at"),
        "expires_at": o.get("expires_at"),
    }


async def expire_featured():
    now = now_iso()
    expired = await db.tartans.find(
        {"featured": True, "featured_until": {"$exists": True, "$ne": None, "$lt": now}},
        {"token": 1},
    ).to_list(500)
    for t in expired:
        await db.tartans.update_one({"token": t["token"]}, {"$set": {"featured": False}})
        await db.orders.update_many(
            {"tartan_token": t["token"], "status": "active"}, {"$set": {"status": "expired"}}
        )


@api_router.get("/feature-plans")
async def feature_plans():
    return FEATURE_PLANS


@api_router.post("/tartans/{token}/feature-order")
async def create_feature_order(token: str, payload: FeatureOrderCreate, request: Request):
    u = await require_user(request)
    plan = PLAN_MAP.get(payload.plan)
    if not plan:
        raise HTTPException(status_code=400, detail="Unknown plan")
    t = await db.tartans.find_one({"token": token})
    if not t:
        raise HTTPException(status_code=404, detail="Tartan not found")
    if t.get("owner_user_id") != u["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can feature this chain")
    existing = await db.orders.find_one({"tartan_token": token, "status": "pending"})
    if existing:
        raise HTTPException(status_code=409, detail="You already have a pending order for this chain")
    order = {
        "id": secrets.token_hex(12),
        "tartan_token": token,
        "tartan_title": t.get("title"),
        "owner_user_id": u["id"],
        "owner_name": u.get("org_name") or u.get("name") or u.get("email"),
        "plan": plan["id"],
        "days": plan["days"],
        "amount": plan["price"],
        "currency": plan["currency"],
        "status": "pending",
        "created_at": now_iso(),
        "activated_at": None,
        "expires_at": None,
    }
    await db.orders.insert_one(dict(order))
    await db.tartans.update_one({"token": token}, {"$set": {"feature_requested": True, "feature_requested_at": now_iso()}})
    return {"order": order_public(order)}


@api_router.get("/my/orders")
async def my_orders(request: Request):
    u = await require_user(request)
    docs = await db.orders.find({"owner_user_id": u["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [order_public(o) for o in docs]


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

@api_router.get("/admin/overview")
async def admin_overview(request: Request):
    await require_admin(request)
    await expire_featured()
    total_tartans = await db.tartans.count_documents({})
    hidden = await db.tartans.count_documents({"hidden": True})
    featured = await db.tartans.count_documents({"featured": True})
    feature_reqs = await db.tartans.count_documents({"feature_requested": True, "featured": {"$ne": True}})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    revenue = await db.orders.aggregate([
        {"$match": {"status": {"$in": ["active", "expired"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    total_revenue = revenue[0]["total"] if revenue else 0
    total_members = await db.members.count_documents({})
    verified_members = await db.members.count_documents({"verified": True})
    total_users = await db.users.count_documents({})
    companies = await db.users.count_documents({"role": "company"})
    creators = await db.users.count_documents({"role": "creator"})
    reports = await db.reports.count_documents({})
    by_cat_raw = await db.tartans.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]).to_list(50)
    merged: dict = defaultdict(int)
    for c in by_cat_raw:
        key = c["_id"] if c["_id"] in CATEGORY_IDS else "other"
        merged[key] += c["count"]
    by_cat = sorted(
        [{"category": k, "count": v} for k, v in merged.items()],
        key=lambda x: -x["count"],
    )
    return {
        "tartans": total_tartans, "hidden": hidden, "featured": featured,
        "feature_requests": feature_reqs, "pending_orders": pending_orders,
        "revenue": total_revenue, "members": total_members,
        "verified_members": verified_members, "users": total_users,
        "companies": companies, "creators": creators, "reports": reports,
        "by_category": by_cat,
    }


@api_router.get("/admin/tartans")
async def admin_tartans(request: Request, q: Optional[str] = Query(None), filter: Optional[str] = Query(None)):
    await require_admin(request)
    await expire_featured()
    query: dict = {}
    if filter == "featured":
        query["featured"] = True
    elif filter == "hidden":
        query["hidden"] = True
    elif filter == "requests":
        query["feature_requested"] = True
    if q:
        query["title"] = {"$regex": q, "$options": "i"}
    docs = await db.tartans.find(query, {"_id": 0}).sort([("feature_requested", -1), ("total_members", -1)]).to_list(500)
    return [tartan_public(d) for d in docs]


@api_router.post("/admin/tartans/{token}/feature")
async def admin_feature(token: str, payload: AdminFlag, request: Request):
    await require_admin(request)
    t = await db.tartans.find_one({"token": token})
    if not t:
        raise HTTPException(status_code=404, detail="Tartan not found")
    update = {"featured": payload.value}
    if payload.value:
        update["feature_requested"] = False
    await db.tartans.update_one({"token": token}, {"$set": update})
    return {"ok": True, "featured": payload.value}


@api_router.post("/admin/tartans/{token}/hide")
async def admin_hide(token: str, payload: AdminFlag, request: Request):
    await require_admin(request)
    t = await db.tartans.find_one({"token": token})
    if not t:
        raise HTTPException(status_code=404, detail="Tartan not found")
    await db.tartans.update_one({"token": token}, {"$set": {"hidden": payload.value}})
    return {"ok": True, "hidden": payload.value}


@api_router.get("/admin/users")
async def admin_users(request: Request):
    await require_admin(request)
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    out = []
    for u in docs:
        u["tartans"] = await db.tartans.count_documents({"owner_user_id": u["id"]})
        out.append(user_public(u) | {"tartans": u["tartans"]})
    return out


@api_router.get("/admin/reports")
async def admin_reports(request: Request):
    await require_admin(request)
    docs = await db.reports.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)
    return docs


@api_router.get("/admin/orders")
async def admin_orders(request: Request, status: Optional[str] = Query(None)):
    await require_admin(request)
    await expire_featured()
    q: dict = {}
    if status:
        q["status"] = status
    docs = await db.orders.find(q, {"_id": 0}).sort([("status", 1), ("created_at", -1)]).to_list(500)
    return [order_public(o) for o in docs]


@api_router.post("/admin/orders/{order_id}/activate")
async def admin_activate_order(order_id: str, request: Request):
    await require_admin(request)
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if o["status"] not in ("pending",):
        raise HTTPException(status_code=400, detail="Order is not pending")
    days = o.get("days", 7)
    activated = datetime.now(timezone.utc)
    expires = (activated + timedelta(days=days)).isoformat()
    await db.orders.update_one({"id": order_id}, {"$set": {
        "status": "active", "activated_at": activated.isoformat(), "expires_at": expires,
    }})
    await db.tartans.update_one({"token": o["tartan_token"]}, {"$set": {
        "featured": True, "featured_until": expires, "feature_requested": False,
    }})
    return {"ok": True, "expires_at": expires}


@api_router.post("/admin/orders/{order_id}/reject")
async def admin_reject_order(order_id: str, request: Request):
    await require_admin(request)
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "rejected"}})
    await db.tartans.update_one({"token": o["tartan_token"]}, {"$set": {"feature_requested": False}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Seed flagship Tartan
# ---------------------------------------------------------------------------

async def seed_flagship():
    existing = await db.tartans.find_one({"featured": True})
    if existing:
        return
    token = "puntland"
    initiator_share = make_token(8)
    ts = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    tartan = {
        "id": secrets.token_hex(12),
        "token": token,
        "title": "Puntland Tech & Innovation Chain",
        "goal": "Connect every builder, dreamer and doer across Puntland and the diaspora.",
        "city": "Garowe",
        "initiator_share_token": initiator_share,
        "initiator_nickname": "Amina",
        "featured": True,
        "hidden": False,
        "feature_requested": False,
        "category": "cause",
        "target": "Every builder & dreamer across Puntland and the diaspora",
        "owner_user_id": None,
        "owner_name": None,
        "total_members": 0,
        "verified_members": 0,
        "max_depth": 0,
        "created_at": ts,
    }
    await db.tartans.insert_one(dict(tartan))

    root = {
        "id": secrets.token_hex(12), "tartan_id": token, "share_token": initiator_share,
        "nickname": "Amina", "real_name": None, "city": "Garowe",
        "parent_share_token": None, "parent_id": None, "device": "seed", "verified": True,
        "is_initiator": True, "depth": 0, "direct_count": 0, "downstream_count": 0, "created_at": ts,
    }
    await db.members.insert_one(dict(root))

    cities = ["Garowe", "Bosaso", "Galkayo", "Mogadishu", "Hargeisa", "Nairobi", "Dubai", "London", "Minneapolis", "Toronto"]
    names = ["Yusuf", "Fadumo", "Cabdi", "Hodan", "Maxamed", "Sagal", "Ali", "Nasteexo", "Omar", "Deqa",
             "Ismail", "Ubax", "Farah", "Ayaan", "Guled", "Hafsa", "Abdirahman", "Ilhan", "Bashir", "Muna"]
    # build a small chain tree
    frontier = [root]
    all_created = [root]
    import random
    random.seed(7)
    for _ in range(40):
        parent = random.choice(frontier[-8:] if len(frontier) > 8 else frontier)
        depth = parent["depth"] + 1
        share = make_token(8)
        cts = (datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 60))).isoformat()
        m = {
            "id": secrets.token_hex(12), "tartan_id": token, "share_token": share,
            "nickname": random.choice(names), "real_name": None, "city": random.choice(cities),
            "parent_share_token": parent["share_token"], "parent_id": parent["id"], "device": f"seed{secrets.token_hex(3)}",
            "verified": random.random() > 0.15, "is_initiator": False, "depth": depth,
            "direct_count": 0, "downstream_count": 0, "created_at": cts,
        }
        await db.members.insert_one(dict(m))
        all_created.append(m)
        frontier.append(m)

    # recompute denormalized counts
    by_id = {m["id"]: m for m in all_created}
    total = len(all_created)
    verified_total = sum(1 for m in all_created if m["verified"])
    max_depth = max(m["depth"] for m in all_created)
    for m in all_created:
        # direct
        direct = sum(1 for x in all_created if x["parent_id"] == m["id"])
        # downstream (walk subtree)
        stack = [x for x in all_created if x["parent_id"] == m["id"]]
        down = 0
        vdown = 0
        while stack:
            cur = stack.pop()
            down += 1
            if cur["verified"]:
                vdown += 1
            stack.extend([x for x in all_created if x["parent_id"] == cur["id"]])
        await db.members.update_one({"id": m["id"]}, {"$set": {
            "direct_count": direct, "downstream_count": down, "verified_downstream": vdown,
        }})
    await db.tartans.update_one({"token": token}, {"$set": {
        "total_members": total, "verified_members": verified_total, "max_depth": max_depth,
    }})
    logger.info("Seeded flagship Puntland tartan with %d members", total)


async def backfill_sparks():
    tokens = await db.tartans.distinct("token")
    for tok in tokens:
        missing = await db.members.count_documents({"tartan_id": tok, "spark_number": {"$exists": False}})
        if not missing:
            continue
        allm = await db.members.find(
            {"tartan_id": tok}, {"id": 1, "created_at": 1, "spark_number": 1}
        ).sort("created_at", 1).to_list(100000)
        for idx, m in enumerate(allm):
            if m.get("spark_number") is None:
                await db.members.update_one({"id": m["id"]}, {"$set": {"spark_number": idx + 1}})


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@tartan.app").strip().lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": secrets.token_hex(12), "email": admin_email,
            "password_hash": hash_password(admin_password), "name": "Tartan Admin",
            "role": "admin", "org_name": None, "created_at": now_iso(),
        })
        logger.info("Seeded admin account %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})


@app.on_event("startup")
async def on_startup():
    await db.members.create_index("share_token")
    await db.members.create_index([("tartan_id", 1), ("device", 1)])
    await db.members.create_index("parent_share_token")
    await db.members.create_index("parent_id")
    await db.notifications.create_index("member_id")
    await db.push_subs.create_index("member_id")
    await db.push_subs.create_index("endpoint")
    await db.tartans.create_index("token")
    await db.tartans.create_index("owner_user_id")
    await db.tartans.create_index("category")
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.orders.create_index("owner_user_id")
    await db.orders.create_index("tartan_token")
    await db.orders.create_index("status")
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error("storage init failed: %s", e)
    try:
        await seed_admin()
        await seed_flagship()
        await backfill_sparks()
    except Exception as e:
        logger.error("seed failed: %s", e)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
