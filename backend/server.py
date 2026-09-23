from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Header, Query
from fastapi.responses import StreamingResponse
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
import asyncio
import requests
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
# Models
# ---------------------------------------------------------------------------

class TartanCreate(BaseModel):
    title: str
    goal: str
    city: Optional[str] = None
    nickname: str
    real_name: Optional[str] = None
    goal_target: Optional[int] = None


class JoinCreate(BaseModel):
    nickname: str
    city: Optional[str] = None
    real_name: Optional[str] = None
    parent_share_token: Optional[str] = None
    idempotency_key: Optional[str] = None
    avatar_file_id: Optional[str] = None


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
    }


def tartan_public(t: dict) -> dict:
    return {
        "id": t["id"],
        "token": t["token"],
        "title": t["title"],
        "goal": t["goal"],
        "city": t.get("city") or "Remote",
        "initiator_share_token": t["initiator_share_token"],
        "initiator_nickname": t.get("initiator_nickname"),
        "featured": t.get("featured", False),
        "total_members": t.get("total_members", 0),
        "verified_members": t.get("verified_members", 0),
        "max_depth": t.get("max_depth", 0),
        "goal_target": t.get("goal_target"),
        "verified_organizer": t.get("verified_members", 0) >= 25,
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
async def list_tartans():
    docs = await db.tartans.find({}, {"_id": 0}).sort("total_members", -1).to_list(100)
    return [tartan_public(d) for d in docs]


@api_router.post("/tartans")
async def create_tartan(payload: TartanCreate, request: Request, response: Response):
    device = get_or_issue_device(request, response)
    ip = request.client.host if request.client else "?"
    if not ip_rate_ok(ip, limit=10):
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")

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
        "total_members": 1,
        "verified_members": 1,
        "max_depth": 0,
        "goal_target": (payload.goal_target if payload.goal_target and payload.goal_target > 0 else None),
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


@app.on_event("startup")
async def on_startup():
    await db.members.create_index("share_token")
    await db.members.create_index([("tartan_id", 1), ("device", 1)])
    await db.members.create_index("parent_share_token")
    await db.members.create_index("parent_id")
    await db.notifications.create_index("member_id")
    await db.tartans.create_index("token")
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error("storage init failed: %s", e)
    try:
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
