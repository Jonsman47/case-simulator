# CS2 Case Opening Simulator — Six-Stage Development Roadmap

Updated: 2026-10-16

This roadmap reflects the inspected repository after Prompt 3. Every later stage must revalidate the code and `PROJECT_STATUS.md` before implementation.

## Stage 1 — Foundation, Critical Bugs, Production Build & Asset Reliability

Status: **COMPLETE**

- Preserved and regression-tested the repaired case-opening session lifecycle.
- Fixed `workbox-window`, npm dependency/lock consistency, TypeScript, lint, Vite, and PWA generation.
- Added manifest-backed sync/verification for all 2,134 ignored generated images.
- Made asset URLs deployment-base aware and added shared fallback/aspect handling.
- Stabilized global responsive containers, navigation, dropdowns, cards, modal scrolling, and Market imagery.

Exit evidence: release checks and production browser smoke tests passed in Prompt 1.

## Stage 2 — Events, Market Events, Automation & Progression Completion

Status: **COMPLETE**

- Restored gameplay-event generation, scheduling, activation, expiration, conflicts, effects, history, UI, notifications, admin controls, persistence, and offline ticking.
- Restored autonomous and gameplay-derived market events, category pricing, banner/Events screen, charts, safe bounded values, persistence, and offline ticking.
- Implemented live Warehouse capacity with safe full-inventory behavior and legacy-save grandfathering.
- Implemented simulated Auction House offers, timers, upgrades, exact-once purchases, persistence, statistics, achievement, images, and capacity checks.
- Audited online/offline Auto Opener, Opening Desk, Case Farm, Trading Bot, Market Analyst, Warehouse, and Auction House behavior.
- Connected advertised upgrade, skill, prestige, and event effects to runtime gameplay.
- Migrated saves to schema v28 and added/updated regression tests.

Exit evidence: TypeScript and lint pass; full suite passes 60 files/293 tests; production build verifies 2,134 assets and generates the PWA. Final release/browser checks are recorded in `PROJECT_STATUS.md`.

## Stage 3 — Paint Seeds, Valuable Patterns & Item Identity

Status: **COMPLETE**

- Added immutable paint seeds from 0 through 1000 inclusive to the centralized item-generation pipeline.
- Added skin/finish-specific deterministic profiles instead of universal seed premiums.
- Implemented conservative Case Hardened/Heat Treated tiers and blue coverage, model-specific Fade percentages, paint-kit-driven Doppler/Gamma phases and gems, and selected Marble Fade patterns.
- Kept ordinary patterns neutral while applying documented, finite, bounded premiums to supported special patterns.
- Centralized pattern valuation and integrated openings, automation/offline rewards, Auction, trade-ups, inventory, selling protection, collection, trophies, statistics, achievements, local saves, and cloud merges.
- Added schema v29 with a non-rerolling legacy migration.
- Added pattern details, filters, sorting, warnings, and thumbnail limitations across relevant UI surfaces.
- Rebuilt multi-case opening presentation into adaptive single/showcase/grid/dashboard layouts for 1–10 simultaneous openings without changing transaction or drop logic.
- Added known-seed, ordinary-seed, generation, pricing, migration, cloud, protection, filter, and 1/2/3/5/10 opening-layout tests.

Exit evidence: TypeScript and lint pass; full suite passes 61 files/310 tests; production/PWA build and `verify:release` pass. Actual browser flows verified seed persistence, 1/2/3/5/10 layouts, full natural animation, exact-once cost/rewards, images, mobile scrolling, and a clean console.

## Stage 4 — Cloud Sync, Leaderboards & Social Features

Status: **PLANNED**

- Configure and test a real Supabase environment.
- Verify authentication, revision conflicts, stale devices, auth expiry, and offline recovery.
- Activate leaderboards and decide public/cloud trophy behavior.
- Harden access control where it must be a real server-side security boundary.

Exit: repeatable multi-device E2E passes; leaderboards work; local-only mode remains fully playable.

## Stage 5 — Data, Performance & Browser E2E Hardening

Status: **PLANNED**

- Resolve remaining price gaps and document snapshot freshness.
- Split/defer large skin/price data and establish performance budgets.
- Profile startup, large inventories, long saves, offline catch-up, and low-end mobile use.
- Add Playwright coverage for openings, rapid clicks, case switching, exact economy deltas, events, Auction, capacity, selling, persistence, assets, PWA behavior, and responsive layouts.
- Add clean-checkout CI that syncs/verifies assets before test/build/release verification.

Exit: critical production journeys run automatically and clean checkout → sync → test → build → verify is reproducible.

## Stage 6 — Final UI Polish, Accessibility, Balance & Release

Status: **PLANNED**

- Complete the full-site visual pass without changing the dark identity.
- Remove clipping/overlap, normalize spacing/icons/tooltips/states, and finish desktop/mobile layout polish.
- Audit keyboard/focus, reduced motion, contrast, text scaling, and screen-reader labels.
- Decide and implement or remove unfulfilled music/localization settings.
- Run economy simulations and human progression/event/Auction playtests.
- Remove or route dead views/workers, reconcile documentation, and complete deployment/offline/update sign-off.
- Organize the accumulated working tree into reviewable commits without losing user work.

Exit: no clipped/overlapping/broken-image surfaces; accessibility/performance/economy targets have evidence; deployment passes the release checklist.

## Current snapshot

| Stage | Status |
| --- | --- |
| 1. Foundation/build/assets/runtime/UI stability | **COMPLETE** |
| 2. Events/market events/automation/progression | **COMPLETE** |
| 3. Paint seeds/pattern identity | **COMPLETE** |
| 4. Cloud/leaderboards/social | **PLANNED** |
| 5. Data/performance/browser E2E | **PLANNED** |
| 6. Final UI/accessibility/balance/release | **PLANNED** |

Estimated overall completion after Stage 3: **95%**.
