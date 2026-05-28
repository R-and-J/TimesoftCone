# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository nature

This is a university software-engineering team project (타임소프트콘, 2-person team). It now contains **both** the design/planning documents (under `docs/`) **and** a working implementation:

- `backend/` — NestJS + TypeScript + Prisma + **SQLite** (file-based; no DB server/container needed). The hexagonal layering from ADR-012 is real here.
- `frontend/` — React 18 + Vite + TypeScript + Tailwind. 11 of 12 screens talk to the live backend.
- `docs/` — the numbered `01_`…`07_` + `99_archive/` document tree (see "Folder convention").

The implementation de-facto settled the stack (NestJS/Prisma/SQLite/React), even though `docs/06_tech/tech-stack.md` is not yet formally updated to mark it decided. **The code is the source of truth for what's built; the docs are the source of truth for *why* and for the invariants.** When they conflict on *behaviour*, trust the code and fix the doc.

The working language of all documents, code comments, and the user is **Korean**. Match that when editing or summarizing.

## What the system actually is

A B2E (Business-to-Employee) annual-leave auction platform. The novel piece — and the source of nearly every design constraint — is the **"Escrow & Dividend"** model: the company never spends its own budget on leave; buyer points accumulate in escrow during the year and are paid out as welfare-card credit to sellers at year-end, prorated by Stake. P2P trading is permanently blocked by design to comply with 근로기준법 (Korean Labor Standards Act).

If you treat this as a generic CRUD/auction app you will violate the architecture. Read `docs/05_handover/handover.md` before suggesting structural changes — it lists the invariants that must never be broken. `backend/README.md` and `frontend/README.md` document the as-built code (routes, the bid transaction, scope cuts).

## Hard invariants — do not violate when proposing changes

These are enforced across SRS, ADRs, and the handover doc. Treat them as load-bearing.

### Policy invariants

1. **Insert-Only ledger** — `LEDGER_ENTRY` (formerly `POINT_TRANSACTION_LOG`) accepts only INSERT. UPDATE/DELETE are blocked at the DB trigger level. Refunds happen as new compensating INSERTs. (SRS DB-RULE-1)
2. **3-flag leave separation** — `REGULAR` / `AUCTION` / `EVENT`. Only `REGULAR` is wage-eligible at year-end and only `REGULAR` feeds the next year's auction pool. Never collapse these. (ADR-002)
3. **Forced deduction priority** — when leave is consumed, always deduct `AUCTION → EVENT → REGULAR`. Users do not choose. (ADR-003)
4. **Escrow ceiling** — total dividends paid in a year must equal (not exceed) the year's escrow balance, **per currency** (`Σ(BID+WIN) − Σ(REFUND+DIVIDEND) = ESCROW.balance`). `CREDIT_ADMIN` entries are excluded from this equation. (SRS NFR-2, DB-RULE-4)
5. **No P2P path** — no API, no UI, no admin tool should enable employee-to-employee direct transfer.
6. **Single transaction for auction settlement** — wallet debit + escrow credit + ledger INSERT + leave grant must be all-or-nothing. With `InternalLeaveAdapter` (the current default) the leave grant is a local INSERT in the same transaction. A future `GroupwareLeaveAdapter` would move the external call behind the Outbox. (ADR-005, ADR-016)

### Structural invariants (ADR-010~015)

7. **Hexagonal layering** — `domain/` has zero external library imports (no NestJS decorators, no ORM annotations, no Redis client). Outbound dependencies flow through `ports/` interfaces, implemented in `adapters/`. Enforced by ESLint boundaries rule. (ADR-012)
8. **Currency abstraction** — `BiddingCurrency` (debit/credit/getBalance) and `PayoutChannel` (payout) are split per ISP. `WelfarePointProvider` is the current single implementation. The core domain must not know which currency is in use. (ADR-010)
9. **Wallet master is this system** — `wallet(user_id, currency, balance)` is the source of truth. Bidding path makes zero external calls. (ADR-011)
9b. **Leave master is this system** — `leave_balance` is owned internally too. Leave granting/deduction goes through `LeaveGrantPort`, default impl `InternalLeaveAdapter`. The leave request/approval (기안/승인) workflow is explicitly out of scope. The year-end pool collection is a *separate bounded context* (`LeavePool`), not part of day-to-day leave management. (ADR-016, ADR-017)
10. **Domain events for side effects** — Use Cases publish `BidPlacedEvent`/`AuctionWonEvent` (`application/events/auction-events.ts`) **after the DB tx commits**; subscribers handle broadcasting/metrics/audit/notifications. Never add a new side effect by editing the Use Case directly. *As built*: the in-process bus is `@nestjs/event-emitter` (`EventEmitter2`), and `NotificationObserver` (`adapters/notification/`) is the first subscriber — it must never throw (a handler failure must not break bid/settle). External-system triggers would go through Outbox, not this bus. (ADR-013)
11. **Auction state** — ADR-014 specifies a State pattern (`OpenState`/`ClosedState`/…). *As built* this was deliberately cut (scope-cuts CUT-3): `Auction` uses an `AuctionStatus` string + guard clauses in `auction.placeBid()`. Keep status-transition logic inside the `Auction` aggregate, not in use cases or controllers. (ADR-014, CUT-3)
12. **Value Objects for core types** — `UserId`, `Point`, `LeaveDays`, `AuctionId`, `LeaveType`, `Year`, `Currency` are classes/enums with invariants enforced at construction. No raw `number` for these in domain signatures. (ADR-015)

## Resolved: ADR-005 (HR API timing)

**ADR-005 is now Accepted.** The decision: Outbox is the *structural* answer, but the current `InternalLeaveAdapter` writes leave grants to the local `leave_balance` table inside the same transaction — so for the school-project scope the auction-settlement path is a single clean DB transaction with no distributed-transaction problem. The Outbox machinery exists but stays dormant until a real `GroupwareLeaveAdapter` is introduced.

This is the same pattern as ADR-011 (wallet) applied to leave — see ADR-016. The three external resources (currency, leave, HR timing) all resolve to: "abstract behind a port, internal adapter as the default impl, real external integration is a later adapter swap."

## Scope cuts — read before assuming a feature exists

`docs/06_tech/scope-cuts.md` tracks what was deliberately cut from the full design to fit school-project scope, and the cost to restore each. The bid/settle code refers to these by number; don't "fix" something that's a documented cut. Notably:

- **CUT-1**: Redis distributed lock → SQLite write lock (`PrismaUnitOfWork.lockAuction`, a no-op `UPDATE`).
- **CUT-3**: State pattern → `AuctionStatus` enum + guard clauses (see invariant #11).
- **CUT-5**: anti-snipe deadline extension → not implemented.
- **CUT-6**: WebSocket realtime → frontend polls.

The in-process domain event bus (CUT-2) and auth/RBAC (CUT-8) have since been **restored** in code (ADR-013 event bus + `NotificationObserver`; ADR-019–022 auth) — confirm against the code rather than the cut list.

## Auth & identity (ADR-019–022)

Auth landed after the original CLAUDE.md. Two deployment modes selected by `AUTH_MODE` (wired in `app.module.ts` via an `AUTH_PROVIDER` factory):
- **delegated** (default) — `EzpassAuthProvider` delegates credential checks to the internal ezpass system; member identity (name/dept/직급/직책/role) syncs from ezpass each login. (ADR-019, ADR-020)
- **`local`** — `LocalAuthProvider` with bcrypt password hashes for a self-contained/portable deployment. (ADR-022)

Identity (who/role) comes from ezpass; **leave balances are owned internally** (`leave_balance`) so settlement stays a single local tx (ADR-020 + ADR-016).

## Remaining open items

- **Operational parameter values** — the *structure* is set in `docs/02_requirements/business-rules.md` but concrete numbers (min bid increment, weekly open quota, first-year starting price) are still ⚙️ team knobs; some have code defaults (e.g. `minIncrement` defaults to 100 in the schema).
- **KPI measurement** — both KPIs (leave-utilization improvement, satisfaction survey) need out-of-system measurement setup (baseline data, survey instrument).
- **Year-end Dividend / LeavePool batch** — both implemented. Dividend payout: `POST /api/admin/dividend/settle` (`PayoutChannel` + `SettleYearEndDividendUseCase`, idempotent, NFR-2 enforced; `GET /api/dividend/me/:userId` still computes the *projection* alongside). LeavePool collection: `POST /api/admin/leave-pool/collect` (`CollectLeavePoolUseCase` + `LeavePoolPort` → REGULAR remaining becomes next-year 1-day auctions + stake, single tx, `leave_pool_run.target_year` UNIQUE for idempotency, `AuctionInventoryCreatedEvent`). Auto-schedule: `YearEndDividendScheduler` (cutoff-gated, idempotent stop).

Domain formulas are resolved in `docs/02_requirements/business-rules.md` (Stake formula, dividend remainder, operational params) and ADR-018 (loser-refund flow, bid cancellation). The canonical API spec is `docs/03_design/openapi.yaml` (`api-spec.md` is narrative-only and defers to the YAML on conflict).

## Folder convention

All design docs live under `docs/`, in folders numbered `01_` through `07_` (plus `99_archive/`) that represent document lifecycle stages, not categories: planning → requirements → design → ADRs → handover → tech/ops → project management. Cross-references between docs use relative paths and rely on this numbering — preserve it when reorganizing. (Note: paths inside docs are relative to `docs/`, so a doc saying `04_decisions/…` resolves to `docs/04_decisions/…` from the repo root.)

`README.md` at the repo root is the navigation index and tracks per-document status (✅ / 🟡 / 🔴 / ⚪). When you change a document's completeness, update its status row there.

## Reading order for new context

`docs/05_handover/handover.md` §6 prescribes the canonical read order. If you only have time for the essentials:

1. `docs/01_planning/proposal.md` — why the system exists
2. `docs/02_requirements/SRS.md` — formal requirements, especially §3.4 DB-RULEs and FR-5.x
3. `docs/02_requirements/glossary.md` — the three Leave Types
4. `docs/02_requirements/business-rules.md` — operational parameters, Stake/dividend formulas, KPIs
5. `docs/02_requirements/edge-cases.md` — boundary-case decisions (leavers, mid-year hires, unsold items, etc.)
5b. `docs/02_requirements/permission-matrix.md` — per-feature RBAC + ABAC matrix (EMPLOYEE/ADMIN), with admin COI audit separation
5c. `docs/02_requirements/acceptance-criteria.md` — testable Given/When/Then for each FR; this is the integration-test source-of-truth
5d. `docs/03_design/openapi.yaml` — canonical OpenAPI 3.0 spec; `api-spec.md` is narrative-only and defers to the YAML on conflict
6. **Policy ADRs** (`docs/04_decisions/`): 001 (escrow), 002 (3-flag), 005 (HR timing — resolved), 009 v2 (currency policy), 011 (wallet ownership), 016 (leave ownership), 017 (leave pool context), 018 (auction settlement rules), 019–022 (auth/identity)
7. **Structural ADRs**: 012 (hexagonal), 010 (currency abstraction), 013 (domain events), 014 (state pattern), 015 (value objects)
8. `docs/05_handover/handover.md` — integrated philosophy + Action Items
9. `backend/README.md` — as-built code: routes, the single-tx bid flow, where each invariant is enforced (code vs DB)

The policy/structural split matters: a question about *what* the system does → policy ADRs; a question about *how* it's built → structural ADRs.

## Build / test / run

There is no monorepo root `package.json`; `backend/` and `frontend/` are installed and run separately. **SQLite means no Docker/DB container is needed** (older READMEs mention `docker compose up` — ignore it). The repo ships a committed seed DB (`backend/prisma/dev.db`); after cloning you can run without `db:migrate`/`db:seed` — see `backend/README.md` for the `skip-worktree` onboarding step that keeps that shared DB from causing merge conflicts.

**Backend** (from `backend/`, runs on `http://localhost:3002` — `PORT` in `.env`):
```powershell
npm install
copy .env.example .env
npm run start:dev          # nest watch mode
npm test                   # jest — domain unit specs (no DB)
npm run test:e2e           # jest e2e config
npm run lint               # eslint --fix; enforces the ADR-012 boundary rule
npm run db:migrate         # prisma migrate dev (only when starting from an empty DB)
npm run db:seed            # tsx prisma/seed.ts
npm run db:studio          # prisma studio
npm run db:reset           # migrate reset (no seed)
```
Run a single test file: `npx jest src/domain/auction/auction.spec.ts`. Tests live next to source as `*.spec.ts` (jest `rootDir` is `src`); the `@/` import alias maps to `src/`.

> Prisma SQLite gotcha (documented in `schema.prisma`): autoincrement BigInt PKs cause `migrate dev` to report drift on id columns. Use `migrate deploy` / `migrate reset` to replay migrations as-is, or keep id columns `INTEGER` when hand-editing a new migration.

**Frontend** (from `frontend/`, runs on `http://localhost:5173`):
```powershell
npm install
npm run dev                # vite; proxies /api → 127.0.0.1:3002
npm run build              # tsc -b && vite build
npm run lint
```

### Backend layout (ADR-012 hexagonal — enforced by `eslint-plugin-boundaries`)

```
backend/src/
  domain/        — pure TypeScript, zero external deps (no @nestjs/@prisma/rxjs imports)
                   sub-foldered by context: shared/value-objects, wallet, ledger, auction
  application/   — Use Cases (PlaceBid, SettleAuction, …) + events/auction-events.ts
  ports/         — outbound interfaces + DI symbols (BIDDING_CURRENCY, UNIT_OF_WORK, AUTH_PROVIDER, …)
  adapters/      — concrete impls: persistence (Prisma*), currency, auth, directory, notification, scheduling
  interfaces/http/ — controllers + zod.pipe + json-bigint.interceptor
  app.module.ts  — the ONLY file allowed to wire across all layers (composition root)
```

Dependency rule (eslint `boundaries/element-types`): `domain → domain` only; `application → domain, ports`; `adapters → domain, ports`; `interfaces → domain, ports, application`. A boundary violation almost always means code is in the wrong layer — move it, don't silence the rule. Ports are referenced by injection `Symbol` (e.g. `WALLET_REPOSITORY`) and bound to a concrete adapter in `app.module.ts`.

Logical bounded contexts (single deployable for now): **Auction**, **Wallet**, **Leave**, **LeavePool** (year-end batch — ADR-017), **Dividend**.

### Things to know before changing the hot path

- **The bid is one SQLite transaction** via `PrismaUnitOfWork.run()` + `lockAuction()` (a no-op `UPDATE` taking the write lock, CUT-1). Refund-prev-leader + debit-new-bidder + ledger INSERTs + auction save all commit or roll back together. See `application/auction/place-bid.use-case.ts` and `backend/README.md` for the step list.
- **BigInt everywhere for money/ids.** Wallet balances, points, and user ids are `bigint` in the backend; the `json-bigint.interceptor` stringifies them on the wire, so the frontend receives amounts as **strings** (`lib/api.ts`) and converts with `Number()` at display time.
- **Auto-settlement** runs on a timer (`SettleDueAuctionsScheduler`, every `SETTLE_INTERVAL_MS`, default 60s; `0` disables). Manual trigger: `POST /api/admin/auctions/settle-due`.
- **`/api/admin/*` routes are guarded by `@Roles("ADMIN")`** (CUT-8 restored, ADR-019–022). Three global guards run in order — `JwtAuthGuard` → `RolesGuard` → `SelfOrAdminGuard` (`interfaces/http/auth/`); the login-issued JWT carries `sub`/`role`/`empId`, so RBAC is decided from the token without a per-request DB lookup.

## Git

Branch strategy is GitHub Flow with Conventional Commits (`docs/06_tech/git-workflow.md`). Scope tokens for commit subjects are domain-specific: `auction`, `bid`, `escrow`, `hr-api`, `leave`, `dividend`, `auth`, `db`, `infra`, `notification`, `http`, `backend`. Commit messages are written in **Korean** (see `git log`). Squash-and-merge into `main`.

Do not commit `backend/prisma/dev.db` unless you are the designated seed owner — it's a shared test seed guarded by `.gitattributes merge=ours` + a `skip-worktree` onboarding step (`backend/README.md`).
