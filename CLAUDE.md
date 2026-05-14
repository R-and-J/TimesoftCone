# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository nature

This repository currently contains **only design and planning documentation** — no source code, no `package.json`, no build system. It is the documentation phase of a university software-engineering team project (타임소프트콘, 2-person team). When code lands, the chosen stack will be NestJS + TypeScript + PostgreSQL 16 + Redis 7 (see `06_tech/tech-stack.md`), but the stack is **not yet finalized**.

The working language of all documents (and the user) is **Korean**. Match that when editing or summarizing docs.

## What the system actually is

A B2E (Business-to-Employee) annual-leave auction platform. The novel piece — and the source of nearly every design constraint — is the **"Escrow & Dividend"** model: the company never spends its own budget on leave; buyer points accumulate in escrow during the year and are paid out as welfare-card credit to sellers at year-end, prorated by Stake. P2P trading is permanently blocked by design to comply with 근로기준법 (Korean Labor Standards Act).

If you treat this as a generic CRUD/auction app you will violate the architecture. Read `05_handover/handover.md` before suggesting structural changes — it lists the invariants that must never be broken.

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
10. **Domain events for side effects** — Use Cases publish `BidPlacedEvent`/`AuctionWonEvent`/etc.; broadcasting, metrics, audit logging are subscriber-side. Never add a new side effect by editing the Use Case directly. External-system triggers go through Outbox, not the in-process bus. (ADR-013)
11. **Auction state via State pattern** — `OpenState` / `ClosedState` / `AwardedState` / `UnsoldState` / `ExpiredState` / `CreatedState` objects. `auction.status` enum exists in DB but is mapped at the adapter boundary. No `if (status === ...)` branches in domain methods. (ADR-014)
12. **Value Objects for core types** — `UserId`, `Point`, `LeaveDays`, `AuctionId`, `LeaveType`, `Year`, `Currency` are classes/enums with invariants enforced at construction. No raw `number` for these in domain signatures. (ADR-015)

## Resolved: ADR-005 (HR API timing)

**ADR-005 is now Accepted.** The decision: Outbox is the *structural* answer, but the current `InternalLeaveAdapter` writes leave grants to the local `leave_balance` table inside the same transaction — so for the school-project scope the auction-settlement path is a single clean DB transaction with no distributed-transaction problem. The Outbox machinery exists but stays dormant until a real `GroupwareLeaveAdapter` is introduced.

This is the same pattern as ADR-011 (wallet) applied to leave — see ADR-016. The three external resources (currency, leave, HR timing) all resolve to: "abstract behind a port, internal adapter as the default impl, real external integration is a later adapter swap."

## Remaining open items (not blockers, but needed before "mindless" implementation)

- **tech-stack.md** — NestJS vs Spring not voted, ORM (Prisma/TypeORM) undecided
- **Operational parameter values** — the *structure* is set in `business-rules.md` but the concrete numbers (min bid increment amount, weekly open quota, first-year starting price) are still ⚙️ knobs to be set by the team
- **No UI wireframes**, api-spec still draft-level, dev-setup is ⚪ TODO
- **KPI measurement** — both KPIs (leave-utilization improvement, satisfaction survey) need out-of-system measurement setup (baseline data, survey instrument)

Domain formulas are now resolved: `02_requirements/business-rules.md` (Stake formula, dividend remainder, operational params) and ADR-018 (loser-refund flow, bid cancellation).

## Folder convention

Top-level folders are numbered `01_` through `07_` (plus `99_archive/`) and represent the document lifecycle stages, not categories: planning → requirements → design → ADRs → handover → tech/ops → project management. Cross-references between docs use relative paths and rely on this numbering — preserve it when reorganizing.

`README.md` at the repo root is the navigation index and tracks per-document status (✅ / 🟡 / 🔴 / ⚪). When you change a document's completeness, update its status row there.

## Reading order for new context

`05_handover/handover.md` §6 prescribes the canonical read order. If you only have time for the essentials:

1. `01_planning/proposal.md` — why the system exists
2. `02_requirements/SRS.md` (v1.3) — formal requirements, especially §3.4 DB-RULEs and FR-5.x
3. `02_requirements/glossary.md` — the three Leave Types
4. `02_requirements/business-rules.md` — operational parameters, Stake/dividend formulas, KPIs
5. `02_requirements/edge-cases.md` — boundary-case decisions (leavers, mid-year hires, unsold items, etc.)
6. **Policy ADRs**: 001 (escrow), 002 (3-flag), 005 (HR timing — resolved), 009 v2 (currency policy), 011 (wallet ownership), 016 (leave ownership), 017 (leave pool context), 018 (auction settlement rules)
7. **Structural ADRs**: 012 (hexagonal), 010 (currency abstraction), 013 (domain events), 014 (state pattern), 015 (value objects)
8. `05_handover/handover.md` — integrated philosophy + Action Items

The policy/structural split matters: a question about *what* the system does → policy ADRs; a question about *how* it's built → structural ADRs.

## Build / test / run

There is nothing to build or run yet. Once code is added the planned commands (per `06_tech/dev-setup.md`) will be `npm install`, `docker compose up -d`, `npm run db:migrate`, `npm run dev`, `npm run test` / `test:e2e` — but none of these are wired up. Do not invent or fabricate commands; if asked to run something, check whether the tooling actually exists first.

When implementation starts, the planned layout (ADR-012) is:

```
src/domain/        — pure TypeScript, zero external deps
src/application/   — Use Cases (PlaceBid, SettleAuction, …)
src/ports/         — outbound interfaces (incl. LeaveGrantPort, BiddingCurrency, …)
src/adapters/      — concrete implementations (persistence, redis, leave, notification)
src/interfaces/    — inbound adapters (http, websocket, cli)
```

The dependency rule `domain → nothing`, `application → domain`, `adapters → ports → domain` should be enforced by `eslint-plugin-boundaries` or `dependency-cruiser`.

Logical bounded contexts (single deployable for now): **Auction**, **Wallet**, **Leave**, **LeavePool** (year-end batch — ADR-017), **Dividend**. `domain/` is sub-foldered by context.

## Git

Branch strategy is GitHub Flow with Conventional Commits (`06_tech/git-workflow.md`). Scope tokens for commit subjects are domain-specific: `auction`, `bid`, `escrow`, `hr-api`, `leave`, `dividend`, `auth`, `db`, `infra`. Squash-and-merge into `main`.
