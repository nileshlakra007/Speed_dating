# 1. Recommended Architecture

## Stack decisions and why

| Layer | Choice | Why (vs. alternatives) |
|---|---|---|
| Mobile | **React Native + Expo** | One codebase for iOS + Android; Expo gives camera/QR scanning, push notifications, and OTA updates out of the box — critical for hot-fixing bugs *during live events* without app-store review. Flutter is comparable but the TypeScript-everywhere story (shared types with the backend) is faster for a small team. Native iOS/Android doubles the work for no MVP benefit. |
| Backend | **Node.js + TypeScript (NestJS), modular monolith** | One language across stack; NestJS gives structured modules, DI, guards (RBAC), and first-class WebSocket gateways. A monolith with clean module boundaries is the right call at MVP: matching, slots, and check-in are transactionally coupled to the same DB. Split into services later only if a module's load profile demands it. Go/Kotlin are fine choices but slower to iterate for this team profile. |
| Database | **PostgreSQL** | The slot system demands ACID: atomic conditional updates, row locks, unique constraints, and transactional waitlist promotion. Document stores (Mongo/Dynamo) make "atomically decrement a category counter and insert a registration" a distributed-systems problem; Postgres makes it one statement. Also gives us `EXCLUDE`/partial unique indexes for "one active registration per user per event". |
| Cache / coordination | **Redis** | Short-lived QR nonces, rate limiting, WebSocket pub/sub across instances, and BullMQ delayed jobs for round timers ("start round 2 at 8:20", "close feedback at 8:45"). |
| Realtime | **WebSockets (Socket.IO)** with HTTP polling fallback | Venues have bad Wi-Fi/congested LTE. Socket.IO's automatic fallback + reconnection beats raw WS. Realtime is used for *nudges* (round started, match assigned, counts changed); every nudge is also fetchable via REST, so a dropped socket never strands a user — reconnect → `GET /events/:id/state` resyncs. |
| Push | **Expo Notifications → FCM + APNs** | Match assignment and round transitions must reach phones that are locked/backgrounded. Push is the trigger; the app fetches authoritative state on open. |
| Auth | **Firebase Auth (phone OTP + email/password + Apple/Google sign-in)** | Offloads OTP delivery, token rotation, and account recovery. Backend verifies Firebase ID tokens and maintains its own `users` table + roles. Swappable later (auth is isolated behind one guard). |
| Storage | **S3 (+ CloudFront)** for profile photos | Pre-signed upload URLs; images never transit our API. |
| Deploy | **Docker → AWS ECS Fargate** (Fly.io/Render acceptable for pre-launch) | See doc 10. |

## System diagram

```
┌─────────────────────────────┐
│  React Native app (Expo)    │  attendee / organizer / staff modes
│  iOS + Android              │  admin = separate web console (React)
└──────┬───────────┬──────────┘
       │ HTTPS/REST│ WebSocket (Socket.IO)
       ▼           ▼
┌────────────────────────────────────────────┐
│  API service (NestJS, N stateless replicas)│
│  modules: auth, users, events, slots,      │
│  checkin, rounds, matching, feedback,      │
│  safety, notifications, admin, analytics   │
└──┬──────────┬──────────┬───────────────────┘
   │          │          │
   ▼          ▼          ▼
PostgreSQL   Redis      Worker process (BullMQ)
(RDS)        (pub/sub,  - round scheduler / timers
             locks,     - matching engine runs
             QR nonces, - waitlist promotion
             queues)    - push fan-out (FCM/APNs)
                        - analytics rollups
   │
   ▼
S3 (photos)   Firebase Auth (token verify)   FCM/APNs
```

## Key architectural principles

1. **Postgres is the source of truth; realtime is advisory.** Sockets and push tell clients "something changed"; clients confirm via REST. This makes weak-network venues survivable — nothing critical depends on a socket staying up.
2. **All capacity mutations are single-statement atomic or serialized transactions** (doc 02). No counter lives only in Redis or app memory.
3. **The matching engine is a pure function**: `(eligible users, constraint graph, config, seed) → pairs`. Deterministic given a seed, fully audited (doc 06), runs in the worker, writes results transactionally.
4. **Event-scoped rooms.** Each live event is a Socket.IO room (`event:{id}` for attendees, `event:{id}:staff`, `event:{id}:organizer`). Fan-out per event is bounded by event capacity (~hundreds), so thousands of simultaneous events scale horizontally by adding API replicas with Redis pub/sub adapter.
5. **Workers own time.** Round start/end, feedback-window close, QR expiry sweeps, and waitlist expiry are BullMQ delayed jobs — not client timers. Clients render countdowns from server-sent `ends_at` timestamps (never their own clocks).
6. **Idempotency everywhere it hurts.** Registration, check-in, feedback submission, and match confirmation accept an `Idempotency-Key`; retries on flaky venue networks are safe.
7. **Audit log as a first-class table.** Every state transition (registration status, check-in, override, match decision, moderation action) appends to `audit_log` — required for live-event debugging and abuse review.

## Role model

One mobile app, four roles (RBAC enforced server-side per endpoint, not just in UI):

- **Attendee** — default role.
- **Organizer** — granted per account; scoped to events they own.
- **Staff** — granted per event by the organizer (invite code/email); scoped to check-in + escalation for that event only.
- **Admin** — platform staff; separate web console, separate stricter auth (SSO + 2FA), no access from the mobile app.

## Scale posture

MVP target: 200 concurrent events × 200 attendees = 40k concurrent users. Stateless API replicas behind an ALB; Postgres is the bottleneck by design and is comfortably sufficient (slot writes are ~1 row each; matching is a per-event batch every 10–20 min). Read-heavy live dashboards are served from short-TTL Redis caches. No microservices, no Kafka, until metrics prove the need.
