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
- ✅ Core loop, device-cookie verified/unverified split, rate limits, idempotent joins
- ✅ Personal lineage + milestones, global stats + canvas chain map, invite landing, share panel, report, EN/SO toggle, flagship Puntland seed, PWA shell
- ✅ Real-Time Pulse (SSE), Milestone Moments (confetti + shareable card), Organizer Dashboard (charts), Avatar Uploads (object storage)
- ✅ **WOW / "Living Synapse" redesign (iteration 3)**:
  - Immersive generative living-chain canvas hero (SSE-fed bursts, FPS fallback) + Unbounded display type + "Ignite your spark"
  - Cinematic Join Reveal (spark #N count-up, chain sigil, node-activated pill, share launchpad) on join AND create
  - Deterministic chain Aura + SVG Sigil identity per chain (lib/aura.js, ChainSigil)
  - Personal Ripple SVG viz + spreader Rank/percentile + spark number on dashboard
  - Backend: member.spark_number + chain rank/total_in_chain/percentile
- ✅ Tested: 24/24 backend pytest, 100% of frontend flows across 3 iterations

## Implemented (2026-06) — Phase 1: Platform, Accounts, Admin, Categories
- ✅ **JWT email/password auth** (register/login/logout/me/refresh), httpOnly cookies, bcrypt, brute-force lockout. Account types: `creator`, `company`. Seeded super-admin (`admin@tartan.app`).
- ✅ **Admin backoffice** at `/admin` (role=admin): Overview stats + chains-by-category, Chains management (search + filters, feature/unfeature toggle, hide/restore toggle), Users list, Reports list.
- ✅ **Creator Studio** at `/studio`: lists a logged-in owner's chains, links to analytics/manage, and "Get featured" request flow.
- ✅ **Categories + targeting**: reconnect / cause / event / fundraiser / brand / challenge, each chain has a `target`. Home page category filter chips + category badges on cards. `GET /api/categories`.
- ✅ **Featured placement mechanic** (monetization groundwork): creator requests featuring → admin approves. Payment handled offline for now.
- ✅ Chains created while logged in link to the account (`owner_user_id`); anonymous create still works (regression preserved).
- ✅ Tested: 19/19 backend pytest + 100% frontend critical flows (iteration_7).

## Roadmap
- **Phase 2 — Monetization**: online payments for Featured placement (user chose offline for now; revisit Stripe when ready); Creator Pro / Company sponsored-chain tiers.
- **Paused team features** (requested earlier, deferred for this platform work): Team Join Reveal (team color + rank in celebration), Team Invites (captain link auto-assigns team), Daily Push Digest (evening summary, needs a scheduler).
- P2: split server.py into modules (auth/admin/tartans); SSE multi-worker via Redis; passkey for initiators.

## Backlog (prioritized)
- P1: Hide initiator_share_token from public list response
- P2: SSE across multiple workers (needs Redis pub/sub); debounce stats emission
- P2: Offload avatar byte reads off the event loop
