# twyn — find your twin in the room ✨

Event-based IRL matching. Hosts create an event with capacity-controlled groups; friends join with a 5-letter code, check in at the door, and every timed round each person gets matched with someone in the room. Both matches see the **same color + icon + short code** — find the person showing your symbol. After each round: private vibe check, and mutual-consent connections revealed at the end.

Why "twyn"? For one round, you and your match are twins — same symbol, same code. Find your twin. 👯

This repo contains a **working web prototype** (Next.js, deployable to Vercel) plus the full product/architecture design for the production mobile app in [`docs/`](docs/).

## Run it locally (zero setup)

```bash
npm install
npm run dev
```

Open http://localhost:3000 — state is kept in memory, perfect for local testing.

## Deploy to Vercel (to test with friends)

1. Push this folder to a GitHub repo and import it in Vercel (or run `npx vercel`).
2. Add a storage backend in the Vercel dashboard → your project → **Storage** (free tiers):
   - **Neon (Postgres)** — recommended. Auto-injects `DATABASE_URL`, picked up automatically; the `twyn_events` table is created on first use.
   - **Upstash for Redis** — also supported (`UPSTASH_REDIS_REST_*` / `KV_REST_API_*`).

   If both are configured, Neon wins.
3. Redeploy. Done — share `https://your-app.vercel.app` with friends.

> ⚠️ A storage backend is required on Vercel: serverless functions don't share memory, so without one every request would see an empty store. Locally it's optional (in-memory store).

**Data retention:** events are deleted automatically ~6 months after their last activity — Redis via native key TTL, Neon via an indexed sweep (`DELETE … WHERE updated_at < now() - interval '6 months'`) that runs on cold starts and event creation, so no cron job is needed.

## How a test night works

1. One person taps **Host an event** → picks vibe (💘 dating / 🪩 mixer / 💼 networking), groups + slot caps, round length (use 3 min for testing) → gets an **invite code** and a **door code**.
2. Friends open the link, enter a name + emoji, pick their group. Full group → automatic waitlist.
3. Everyone "arrives" by entering the 4-digit **door code** (host's screen) — or the host checks them in manually.
4. Host taps **Start round** → everyone gets a match + shared symbol (e.g. 🔥 K7 on Hot Pink). Find your twin, tap **I found them**, use the icebreaker.
5. Round ends → private feedback (met? rating? connect after? never again?).
6. Host runs more rounds (no repeat pairs; standby users get priority), then **End event** → mutual connections revealed.

## Code layout

```
app/                     # Next.js App Router
  page.tsx               # landing (join by code / host)
  create/                # event creation
  host/[code]/           # live host dashboard (polls)
  e/[code]/              # attendee flow: join → check-in → match → feedback → mutuals
  api/events/...         # REST endpoints (create, state, join, me-actions, host-actions)
components/              # Logo (SVG mark), Countdown (server-clock corrected)
lib/
  types.ts               # domain model
  store.ts               # EventStore repository: in-memory + Upstash Redis (CAS-safe)
  matching.ts            # MatchingStrategy registry (random now; interest/smart later)
  identifiers.ts         # color × icon × code generator, icebreakers
  views.ts               # role-scoped serializers (host / attendee / anon)
  waitlist.ts            # promotion rule
docs/                    # production architecture & design docs
```

### Extension points (by design)

- **Storage** — `EventStore` interface in `lib/store.ts`; add a Postgres/Prisma implementation without touching routes.
- **Matching** — `MatchingStrategy` in `lib/matching.ts`; register `interest`/`networking` strategies keyed by `matchingMode`.
- **Views** — role-scoped serializers in `lib/views.ts` keep private data (door code, feedback, tokens) out of the wrong client.

## Prototype vs. production

This prototype trades a few things for speed: door-code check-in instead of scanned QR, 2.5s polling instead of WebSockets, name-only identity instead of real auth, single-JSON-per-event storage instead of the relational schema. The production design in [`docs/`](docs/) covers the real thing (React Native app, NestJS + Postgres, atomic slot control, push notifications, safety/moderation, admin).
