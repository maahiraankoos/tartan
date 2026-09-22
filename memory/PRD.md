# Tartan — PRD

## Original Problem Statement
A shareable, no-download human referral chain (mobile-first PWA). People start or join a "Tartan," pass a link, and watch a living map of how far a real idea travels. Frictionless join with a nickname (no email/phone/account); a signed anonymous device cookie backs a verified-vs-unverified count split. Parent attribution = the sharer's unique link token. Multi-campaign with a flagship "Puntland" chain featured. Bilingual EN + Somali. Dark neon UI.

## Architecture
- **Frontend:** React (CRA) + Tailwind + shadcn/ui, react-router, framer-less CSS animations, canvas chain map, qrcode.react. Dark neon PWA (manifest + theme). Bilingual via `src/i18n.js` + `AppContext`.
- **Backend:** FastAPI + Motor (MongoDB). All routes under `/api`. HMAC-signed httponly device cookie (`td`) for verified/unverified split + per-IP in-process rate limits. Denormalized `direct_count` / `downstream_count` updated on join by walking ancestors.
- **DB:** MongoDB collections: `tartans`, `members`, `reports`. Indexes on share_token, (tartan_id, device), parent_share_token, token.

## User Personas
- Community organizers / event hosts running awareness campaigns
- Creators wanting to see the *path* an idea travels
- Everyday participants who join in ~5s and share onward

## Core Requirements (static)
- Start a Tartan (title, goal, optional city)
- Join in ~5s with nickname → personal share link + QR
- Share to WhatsApp / SMS / native / copy / QR
- Personal branch view (inviter → you → direct joins → downstream, depth, milestones)
- Live global stats (verified reach, velocity, active cities, depth)
- Clustered chain map with zoom
- Report/block; verified vs unverified count integrity
- EN + Somali toggle

## Implemented (2026-06)
- ✅ Full core loop: create → join (parent attribution via share token) → personal dashboard → share
- ✅ Signed device cookie, verified/unverified split, per-IP rate limit, idempotent joins
- ✅ Personal lineage view with milestones + progress
- ✅ Global stats + animated canvas chain map (city clusters, glowing arcs, zoom)
- ✅ Invite landing "/j/{share}" with "X sent this to you" + live preview
- ✅ WhatsApp/SMS/native/copy/QR share panel
- ✅ Report dialog; EN/SO bilingual toggle (persisted)
- ✅ Flagship "Puntland" seeded chain (~40 members)
- ✅ PWA manifest + dark theme
- ✅ **Real-Time Pulse**: SSE stream (`/api/tartans/{token}/stream`) pushes live stats + join events; counters update instantly, incoming-join toasts (iteration 2)
- ✅ **Milestone Moments**: confetti burst + downloadable/shareable canvas card on crossing 10/25/50/100/... (iteration 2)
- ✅ **Organizer Dashboard**: initiator-only analytics at `/dashboard/{share}` — cumulative reach area chart, depth-distribution bars, geographic spread, top branches (iteration 2)
- ✅ **Avatar Uploads**: optional profile photo via Emergent object storage; generated gradient icon fallback; owner-only update via device cookie (iteration 2)
- ✅ Tested: 20/20 backend pytest, 100% frontend flows across both iterations

## Backlog (prioritized)
- P1: Hide initiator_share_token from public list response
- P2: SSE across multiple workers (needs Redis pub/sub for scale-out); debounce stats emission
- P2: Offload avatar byte reads off the event loop (threadpool/aiohttp)
- P2: Passkey for initiators; ancestor batch-update optimization for deep trees
- P2: Org/creator paid analytics tier; chain templates; verified initiator badges

## Next Tasks
- Gather user feedback on the core loop and map UX before deepening features.
