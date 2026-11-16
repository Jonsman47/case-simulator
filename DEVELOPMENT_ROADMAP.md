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

## Post-release Playtest Fixes — Batch 1

Status: **COMPLETE**

- Expanded the persistent onboarding coach from four terse hints to eight guided, replayable steps covering opening costs, rarity/wear/float/patterns, inventory/selling, Market, Collection, Work/progression, and conservative auto-sell setup.
- Reworked Large Text as a 20–30% utility-scale accessibility mode and added a coherent Light Mode palette with light-safe rarity contrast.
- Added Memory Circuit round countdowns, high-contrast pad activation, deliberate repeated-pad gaps, locked demonstration input, and clearer progress. Added actual-precision Bullseye scoring while retaining the existing reward cap.
- Added the trash-can disposal interaction to Poop Cleaning with drag/drop plus select-and-activate keyboard/touch fallback.
- Added an atomic Achievements Claim All transaction and a deterministic Sell Duplicates — Keep Best policy with locked/favorite/Factory New/exceptional-pattern protection.
- Added a clickable Market wear/edition table and efficient Pattern ID explorer, an offline provider cache, explicit confidence/source/freshness fields, and a documented OpenSkin refresh script. Active asking prices are never labeled as sales.
- Expanded unit and Playwright coverage for the playtest flows.

Exit evidence: 67 unit files/341 tests, lint, TypeScript, production/PWA build, release verification, 2,134 asset validation, and 15 serial Chromium E2E journeys pass. Browser coverage includes tutorial replay/persistence, Light/Large Text responsive checks, Poop Cleaning drag and accessible disposal, Memory/Precision visibility, detailed Market inspection, atomic Claim All, exact-once opening/selling transactions, and four target viewport sizes. Live Supabase proof and exact seed-specific artwork remain documented limitations.

## Post-release CSFloat-Style Virtual Marketplace Overhaul

Status: **COMPLETE FOR LOCAL SIMULATION — LIVE SUPABASE DEPLOYMENT UNVERIFIED**

- Replaced the global 96-listing feed with a catalog of every supported skin. Each skin now has its own dedicated marketplace, lowest ask, complete value range, estimated offer count, wear distribution and paginated seller listings.
- Added an O(1) supply model using rarity, current reference value, source-case/collection breadth, weapon demand and deterministic circulation history. The catalog models millions of offers while explicitly labeling counts as simulator estimates.
- Added stable per-epoch virtual IDs, deterministic seller/item generation, bounded page scans, skin-specific rare-Pattern availability and zero-listing outcomes. Only the requested 24-listing page is allocated.
- Preserved all 18 hidden NPC archetypes and expanded them into a procedurally generated seller population with stable usernames, avatars, reputation, patience, reservation floors and remembered negotiation history.
- Added owned-item marketplace escrow, time-based NPC buyer offers, safe expiry/cancellation restoration, atomic local request-ledger handling, and the shared NEW/Claim acquisition reveal.
- Replaced full-value instant selling with visible 85–95% liquidity quotes while preserving progression modifiers and exact-once statistics.
- Extended duplicate auto-sell to keep a custom N highest-value eligible copies with deterministic comparison and layered locked/favorite/rare Pattern/knife/glove/edition protections.
- Updated trade-ups for current ten-item and October 2025 five-Covert contracts, normalized float mapping, source-weighted outcomes, edition restrictions, current Souvenir stripping, projections and shared acquisition reveal.
- Migrated saves to v32 without rerolling old items. The save stores only virtual epoch metadata, purchased-ID tombstones, interacted listings, escrow and transaction/request ledgers—not the global simulated population. The existing Supabase v31 authority migration remains undeployed and would require a follow-up deployment migration for the v32 virtual fields.
- Added performance and regression coverage for total supply, common/elite divergence, iconic zero-supply Patterns, deterministic regeneration, non-overlapping pagination, sorting/filtering, page 1,001, exact-once purchase, negotiation overrides and save migration.

Exit evidence: 70 unit files/371 tests, zero-error lint, TypeScript, production/PWA build, release verification, 2,134-asset validation and all 16 Chromium journeys pass. The browser suite includes catalog → dedicated market → exact purchase/tombstone persistence. Live Supabase deployment remains unverified because credentials were not provided. See `case-opening-simulator/docs/marketplace-economy.md`.

## Post-release CSWEAR Marketplace Restructure

Status: **IMPLEMENTED — FINAL VERIFICATION RECORDED IN PROJECT_STATUS.md**

- Separated Market (price checker only) from CSWEAR (simulated transactions, negotiation, listings, escrow and history) and added CSWEAR to the existing Market navigation group.
- Added dynamic O(1) per-skin `View offers on CSWEAR` counts and deep links with browser Back support.
- Replaced visible numbered marketplace pagination with lazy catalog batches and a `react-window` listing stream. The stream automatically grows near the bottom, retains bounded generated pages, unmounts distant rows, preserves a per-query scroll index and provides a manual load fallback.
- Added seven-day virtual and player listing lifetimes, timestamp-derived countdown/status UI, efficient epoch expiry, direct long-offline epoch catch-up and expired-purchase rejection.
- Added Pattern classification, credible Best Deals and Expiring Soon filters/sorts while retaining wear, edition, Pattern ID/tier, float, price and seller querying.
- Migrated saves from v32 to v33 without changing inventory, money, Patterns, escrow, negotiation history, transaction history, request IDs or purchased-listing tombstones.

Exit evidence: 71 unit files/387 tests, zero-error lint, TypeScript, production/PWA build, 2,134-asset verification, release verification, and all 16 Chromium journeys pass. Live browser smoke checks also rendered Stats, Trade Ups, CSWEAR, Automation, and Prestige without horizontal overflow or console errors, with visible state preserved across reload.

## Career Overhaul — 8-Prompt Roadmap

The authoritative formulas, reset policy, employee boundaries, migration rules, and dependency graph live in `case-opening-simulator/docs/CAREER_OVERHAUL_MASTER_PLAN.md`.

| Prompt | Scope | Status |
| --- | --- | --- |
| 1. Economy foundation, critical fixes, master design | v34 ledger; honest Stats; Case Farm offline parity; trade-up opportunity cost; marketplace/Auction/sale/max-level/prestige/wear fixes; permanent master plan | **COMPLETE — unit, lint, build, release and browser verification passed** |
| 2. Career ranks and specialization foundation | v35 Career XP event pipeline, anti-farming, six ranks, five specialization foundations, Career dashboard, legacy-safe migration | **COMPLETE — 399 unit tests, lint, build, release and 17 browser journeys passed** |
| 3. Business and employees | v36 five-role Business system, reserved budgets, payroll, shared online/offline scheduler, real operations, legacy conversion and Case Farm retirement | **COMPLETE — 415 unit tests, lint, TypeScript, build, release and 19 browser journeys passed** |
| 4. Upgrade consolidation | v37 migration; 95 typed five-specialization upgrades; legacy Skill Tree/run-upgrade retirement; Career explorer; Business/runtime integration | **COMPLETE — 427 unit tests, lint, TypeScript, build, release and 20 browser journeys passed** |
| 5. Economy simulation and balance | Deterministic production-linked framework; 300,000 careers; 500,000 openings; XP/employee/upgrade/exploit calibration; Prompt-6 Prestige specification | **COMPLETE — 434 unit tests, lint, TypeScript, build, release, full simulations and 20 browser journeys passed** |
| 6. Prestige and legacy systems | v38 five-tier/path score, bounded PP/perks, exact-once recovery-backed reset, Legacy Vault, run archives and All Time/Current Run Collection | **COMPLETE — 438 unit tests, lint, TypeScript, build, release, full simulation and 22 browser journeys passed** |
| 7. Achievements, Stats and navigation | v39 scoped achievements, six-category Career catalog, shared financial/Career/Business/Prestige/Collection reporting, four-destination progression navigation, history and legacy-safe migration | **COMPLETE — 447 unit tests, lint, TypeScript, build, release, simulation and 23 browser journeys passed** |
| 8. Release hardening | Full migration matrix, state-bound Prestige recovery, corruption handling, cloud lineage conflicts, security/performance/accessibility/browser release sweep and rollback documentation | **COMPLETE FOR LOCAL/OFFLINE RELEASE — LIVE SUPABASE VERIFICATION BLOCKED** |
Legacy progression fields remain loadable for migration history, but retired purchase controls and duplicate navigation are no longer player-facing. The eight-prompt Career Overhaul is complete for local/offline release without reviving those systems.

### Prompt 3 implementation notes

- Save v36 makes `TICK_BUSINESS` the only employee automation authority and redirects the former Automation route to Business.
- Five working roles reuse existing authoritative gameplay paths: paid Case Operator openings; protected Sales Assistant sale/escrow management; notify-only deterministic Market Scout searches; honest-EV Trade-Up Specialist contracts; and conservative exact-once Junior Trader purchases.
- Allocated employee funds are reserved out of the wallet; timestamp payroll, daily risk limits, capacity, inventory rules and the 24-hour offline cap apply through the same scheduler online and offline.
- The old free-money Case Farm is retired. Legacy automation receives a one-time, capped, noncash conversion; Warehouse and Auction House remain facilities.
- Full specialization upgrades, calibrated employee economics, final Prestige/Legacy Vault behavior, and final progression navigation remain correctly scheduled for Prompts 4–8.
# Career Overhaul status

- Prompt 1/8 — Economy ledger and critical exploit fixes: complete.
- Prompt 2/8 — Career XP, levels and ranks: complete.
- Prompt 3/8 — Business employees: complete.
- Prompt 4/8 — Career upgrade consolidation: complete.
- Prompt 5/8 — Economy simulation and calibration: complete.
- Prompt 6/8 — Prestige, Legacy Vault, Career History and Collection split: complete and verified.
- Prompt 7/8 — Achievements, Stats, navigation and migration completion: complete and locally verified; GitHub CI result is recorded with the release commit.
- Prompt 8/8 — Release hardening: complete for local/offline release; 463 unit tests, 26 browser journeys, v31–v39 migration matrix, deterministic economy simulation, production/PWA build and production-dependency audit pass. Full audit retains 12 documented low/moderate development-tool findings after all safe updates. Live Supabase deployment remains unverified and blocks a full-cloud verdict.

## Post-Career visual overhaul and Work expansion

Status: **COMPLETE — UNIT, RELEASE, SIMULATION AND BROWSER VERIFICATION PASSED**

- Integrates a small, documented CC0 sprite selection for Work and Business without external hotlinks.
- Fixes the case-opening center marker stacking/contrast issue for single and multi openings.
- Adds a compact responsive density layer plus targeted Inventory, Work, and Business overflow/proportion fixes without changing the established visual identity.
- Improves Poop Cleaning, Sort Boxes, Precision Strike, and Memory Circuit with recognizable local graphics.
- Adds exactly four skill games: Diamond Miner, Package Delivery, Warehouse Rush, and Circuit Repair.
- Preserves the existing exact-once Work reducer, ledger, Career XP, statistics, cooldown, persistence, and accessibility systems.
- Adds deterministic mechanics, balance, asset, component, and browser coverage.

Exit evidence: standalone TypeScript and ESLint passed; 82 Vitest files / 484 tests passed; all 2,134 generated CS2 assets (197.4 MiB), Vite production bundling, PWA generation, and `npm run verify:release` passed; the deterministic 300,000-career / 500,000-opening simulation retained the 781.1-hour five-tier projection; and all 28 serial Chromium journeys passed in 5.1 minutes. Browser coverage includes the eight Work jobs, exact-once expansion-job settlement, roulette-marker geometry, Inventory overflow, route-wide console/overflow checks, and responsive layouts from 1920×1080 through 320×568. Live Supabase deployment remains unverified without credentials.

## Gameplay Fun & Early-Game Overhaul

Status: **COMPLETE — VERIFIED 2026-11-16**

- Opening-first daily objectives, rollback-safe exact-once progress, and capped noncash Opening Credit are implemented without changing official case EV or funding automation.
- The hidden first-opening Special Item odds override is removed; first-open excitement is now presentation-only after authoritative reward selection.
- Single/batch result feedback now surfaces new discoveries and session Career XP while retaining the existing exact-once opening lifecycle.
- Package Delivery keyboard/focus/target usability and solver-backed Circuit Repair readability/hints are complete.
- Owned Inventory items can enter the existing CSWEAR seven-day escrow flow through an exact-instance, fee-aware, two-step listing review.
- Five deterministic 15/30/60/120-minute playstyles and the full Career/case economy model pass. Detailed rules and results live in `case-opening-simulator/docs/CASE_OPENING_EARLY_GAME_REBALANCE.md`.

Exit evidence: TypeScript and ESLint passed; 83 Vitest files / 489 tests passed; 2,134 generated assets verified; production/PWA build and release verification passed; early-game and full Career simulations passed; and 29/29 Chromium journeys passed, including the new Work, opening, CSWEAR escrow, console, responsive, and exact-once regressions. Live Supabase deployment remains the only credential-dependent release boundary.
