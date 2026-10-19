# CS2 Case Opening Simulator — Six-Stage Development Roadmap

Updated: 2026-10-19

This roadmap reflects the inspected repository after completion of all six planned prompts. Any future maintenance task should still revalidate the code and `PROJECT_STATUS.md` before implementation.

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

Status: **COMPLETE — REAL SUPABASE DEPLOYMENT VERIFICATION BLOCKED**

- Completed guest, local-mock, and Supabase account flows with persistent/refreshable sessions, safe account switching, display-name validation, privacy controls, and sanitized errors.
- Replaced automatic state merging with revision-aware synchronization and a visible conflict choice. Both versions are backed up before a player chooses local or cloud progress.
- Added an atomic, owner-scoped save RPC and hardened migrations with RLS, explicit grants, security-invoker public views, and public-summary tables that never expose email or raw save data.
- Activated seven leaderboard categories, personal ranking, pagination, public profiles, responsive trophy showcases, and account/profile navigation.
- Kept local-only play fully functional and clearly labeled local mock rankings separately from configured global rankings.
- Documented that rankings are client-reported and not cheat-proof without an authoritative game server.
- Added automated coverage for accounts, privacy, stale revisions, scoped saves, item identity, leaderboards, public trophies, UI conflicts, and migration security invariants.
- Removed a reproduced autosave quota failure by compacting persistence and bounding chart-only market history without truncating gameplay identity or economy progress.

Exit evidence: local/mock automation and browser UI verification pass. A real Supabase project was not configured, so deployed Auth/RLS/RPC, email delivery, and physical multi-device testing remain explicitly blocked rather than claimed.

## Stage 5 — Data, Performance & Browser E2E Hardening

Status: **COMPLETE**

- Changed player-facing Seed terminology to Pattern without changing the v29 `paintSeed` identity field.
- Added separated, numbered multi-open roulette/reveal containers and repaired non-wrapping opening quantity controls and tall-summary scrolling.
- Rebuilt the Work page and existing jobs; added Precision Strike and Memory Circuit with skill scoring, persistent cooldowns, exact-once rewards, and schema v30 statistics.
- Improved price coverage from 2,071 to 2,087 of 2,092 skins and reduced condition fallbacks from 250 to 75, with explicit market/fallback/estimate labels.
- Generated pattern coverage at build time and compacted price data. Pattern transfer size fell about 321 kB gzip and price data about 44 kB gzip; budgets are documented in `case-opening-simulator/docs/performance-budget.md`.
- Added Playwright Chromium coverage and visual baselines for opening quantities, exact deductions/inventory additions, Work jobs, selling/reload, images, core navigation/console errors, and responsive overflow at 1920×1080, 1366×768, and 390×844.
- Added root-level GitHub Actions CI for clean install, asset sync, generated-data verification, browser installation, typecheck, lint, unit tests, build, E2E, and PWA verification.

Exit evidence: recorded in `PROJECT_STATUS.md`. Five source-rate-limited price entries, deeper deployed-cloud E2E, and controlled low-end device profiling remain documented limitations rather than hidden failures.

## Stage 6 — Final UI Polish, Accessibility, Balance & Release

Status: **COMPLETE**

- Preserved the dark visual identity while replacing the scrolling Work stack with compact job cards and viewport-bounded focused games.
- Kept Memory Circuit demonstration, feedback, and input controls visible together; added unambiguous flash/gap timing and transition input locks. Kept Precision Strike's timing bar, attempts, and score together.
- Added shared focus trapping/restoration, safe Escape behavior, background scroll locking, visible focus, touch affordances, and reduced-motion support to critical overlays.
- Removed misleading Music and Language controls while retaining old save fields for compatibility.
- Deferred charts and split stable vendor/generated-data chunks. Startup app/framework transfer fell from 623.85 kB raw/194.90 kB gzip to 461.73 kB raw/138.08 kB gzip.
- Added repeatable early/mid/late economy bounds and 100,000-opening simulations. No speculative balance change was made without supporting evidence.
- Removed the confirmed-unused case simulation worker, refreshed setup/deployment/performance/economy documentation, and expanded Playwright to 10 release journeys and four target viewport sizes.

Exit evidence: 66 unit files/335 tests, lint, TypeScript, production/PWA build, release verification, and 10 Chromium E2E tests pass. Live Supabase deployment remains explicitly blocked on credentials and is not claimed as verified.

## Current snapshot

| Stage | Status |
| --- | --- |
| 1. Foundation/build/assets/runtime/UI stability | **COMPLETE** |
| 2. Events/market events/automation/progression | **COMPLETE** |
| 3. Paint seeds/pattern identity | **COMPLETE** |
| 4. Cloud/leaderboards/social | **COMPLETE — deployment verification blocked** |
| 5. Data/performance/browser E2E | **COMPLETE** |
| 6. Final UI/accessibility/balance/release | **COMPLETE** |

Estimated overall completion after Stage 6: **99%**. The remaining 1% is credential-dependent Supabase proof, five source-rate-limited price matches, exact seed-specific artwork limitations, and controlled physical-device profiling—not unfinished core gameplay.
