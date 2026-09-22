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
- ✅ Live polling refresh (~6s); PWA manifest + dark theme
- ✅ Tested: 13/13 backend pytest, 100% frontend flows

## Backlog (prioritized)
- P1: Hide initiator_share_token from public list; add DialogDescription for a11y
- P1: Real-time push (WebSocket/SSE) instead of polling
- P2: Optional avatar uploads (object storage)
- P2: Passkey for initiators; ancestor batch-update optimization for deep trees
- P2: Org/creator analytics dashboard tier (monetization)
- P2: Chain templates (fundraiser, event, challenge); verified initiator badges

## Next Tasks
- Gather user feedback on the core loop and map UX before deepening features.
