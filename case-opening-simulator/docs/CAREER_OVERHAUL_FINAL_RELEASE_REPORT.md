# Career Overhaul Final Release Report

Audit date: 2026-11-14
Baseline: `fefb376949e5052b9d0568502e59a74a1dee3224`
Save schema: v39

## Verdict

**READY FOR LOCAL/OFFLINE RELEASE.** Live cloud release remains blocked until a real Supabase project is used to verify Auth, RLS, the optimistic-revision RPC, token refresh, and physical multi-device conflicts. Local/mock cloud tests and static SQL policy tests are not presented as deployed-cloud proof.

## Method

The audit checked source, reducers, migrations, gameplay tests, browser journeys, CI, release scripts, generated assets, dependency advisories, and the deterministic Career economy model. It focused on destructive Prestige, save identity, exact-once boundaries, cross-device revisions, item protection, employee scheduling, Career upgrades, achievement scope, collection scope, and responsive gameplay. No production save was used destructively.

## Confirmed defects and fixes

1. **Prestige backup trust was bypassable.** The reducer accepted `backupVerified: true`, defaulted a missing flag to true, and did not bind a request to its source run. It now requires a proof derived from the exact critical state read back from the dedicated recovery snapshot, plus a source run ID embedded in the request. Missing, stale, or cross-run requests fail without resetting progress.
2. **Bounded Prestige request history could not permanently reject a very old request.** Source-run binding now makes any old request invalid after the run changes even after its detailed ID is compacted.
3. **Prestige recovery had no supported restore path.** Settings now exposes a verified pre-Prestige snapshot, explains the destructive choice, and performs replacement only. It never merges pre- and post-Prestige lineages.
4. **Duplicate item IDs were silently deduplicated.** Imported and internally serialized primary inventory now rejects duplicate instance identity, invalid floats/paint seeds, impossible inventory/escrow duplication, excessive inventory, and invalid player escrow. The original import remains untouched; no valuable item is silently discarded.
5. **Historical migration coverage was incomplete.** A v31–v39 matrix now verifies identity, money, Pattern, float, repeat reload, XP/PP idempotence, and corruption rejection.
6. **CI omitted the deterministic economy smoke test and production dependency audit.** Both are now release checks.

## Gameplay audit

- Cases: one reducer transaction remains the authority for cost, predetermined reward, inventory insertion, ledger entry, collection and XP. Playwright completed 1/2/3/5/10 openings with exact deltas.
- Inventory: item instance ID, float, Pattern, edition, cost basis, lock/favorite and exceptional-Pattern protection remain authoritative. Escrow cannot also exist in inventory after save validation.
- Market/CSWEAR: deterministic virtual IDs, tombstones, expiry, manual negotiation, player escrow, valuation-confidence safeguards and exact-once requests remain covered. No global population is materialized.
- Trade-ups: actual consumed opportunity cost, protected input exclusion, float mapping, output identity and acquisition reveal remain covered.
- Work: all four jobs, cooldowns, performance rewards and exact-once completion remain covered; responsive tests include 320, 375, 390, 768, 1280, 1366 and 1920 widths.
- Events, daily rewards, Auction, Trophy Room, settings and route rendering remain in the complete unit/browser suite.

## Business and upgrade audit

All five employees continue to use real reducer paths:

- Case Operator pays real case costs and uses normal drop generation.
- Sales Assistant excludes protected items and uses sale/listing settlement.
- Market Scout only produces bounded stable-ID alerts.
- Trade-Up Specialist uses honest opportunity cost and approval thresholds.
- Junior Trader uses bounded ordinary listings and never automated negotiation.

Payroll watermarks, reserved capital, daily limits, capacity and the 24-hour offline cap remain shared online/offline. The retired free-money Case Farm remains inactive.

The registry still contains exactly 95 stable nodes in the 18/22/16/18/21 branch distribution. Purchase gates, prerequisites, maximums, cost growth, Prestige reset, active research/toolkit consumers, and mechanical selectors remain tested. Mechanical effects feed opening presentation/batches, inventory and Trophy capacity, selling fees, employee intervals/capacity/training/payroll, and all five employee schedulers. Official rarity, wear and Pattern odds were not changed.

## Prestige, Collection and achievements

All five tier definitions remain 25/70, 30/74, 36/78, 45/82 and 55/86 with typed path requirements. PP, perk caps, explicit Vault selection, cost basis and exact item identity remain tested. A reset is blocked by listings, pending acquisition, negotiation, employee approval, cloud conflict, failed backup, stale state or invalid selection.

All Time Collection remains permanent; Current Run is separately persisted and cleared only by completed Prestige. The 151-definition catalog remains 130 active plus 21 retired compatibility records, including nine run-scoped achievements. Claim and Claim All remain reducer-atomic and exact once; achievements never mint PP.

## Save migration and corruption matrix

| Input | Result |
|---|---|
| v31 | Pass; marketplace virtual metadata, ledger, Career, Business, upgrades and Prestige added in order |
| v32 | Pass; seven-day virtual epoch migration retains tombstones |
| v33 | Pass; partial pre-v34 ledger created without fabricated transactions |
| v34 | Pass; bounded verified legacy Career baseline only |
| v35 | Pass; Business migration and retired automation conversion |
| v36 | Pass; one-time Career upgrade transition credit |
| v37 | Pass; Prestige/Collection split without Pattern rerolls |
| v38 | Pass; v39 achievement scope and PP accounting |
| v39 | Pass; serialize/reload idempotent |

Truncated JSON, future schema, invalid item numbers/enums, out-of-range float/Pattern, duplicate identity, excessive inventory, invalid escrow and inventory/escrow duplication fail closed. The importer never executes item text as HTML. Historical transactions that never existed remain unknown rather than fabricated.

## Cloud architecture

The local backend rejects stale expected revisions. Added conflict coverage proves that a post-Prestige lineage cannot be overwritten by a stale pre-Prestige device and that money/PP are not merged. Existing UI resolution backs up and replaces one version explicitly. Supabase SQL tests verify owner-scoped RLS and an authenticated expected-revision RPC that does not accept a client-provided user ID.

Residual blocker: there were no live Supabase credentials, so hosted Auth, policy enforcement, RPC deployment, email, token expiry and real network retries were not exercised.

## Security

- `npm audit --omit=dev`: zero known vulnerabilities.
- A non-forcing `npm audit fix` removed every high-severity development advisory and updated Vite to 8.3.8 and Vitest to 4.1.12 within declared ranges. Full `npm audit` retains 12 development-only findings (2 low, 10 moderate) in PWA/ESLint build-tool chains. The remaining suggested fixes require forced breaking/downgrade changes and are not runtime dependencies, so they are documented rather than forced into the release.
- No `dangerouslySetInnerHTML`, direct `.innerHTML`, secret key or private credential was found in application source.
- Only the public Supabase URL and anon/publishable key are frontend variables; service-role keys are not supported.
- Save size is capped at 50 MiB, owned inventory at 50,000 items and player escrow at 5,000 listings before expensive normalization.
- Local saves remain player-editable. This PWA does not claim client-side anti-cheat.

## Performance

The final Vite 8.3.8 release build transformed 1,908 modules in 25.98 seconds on the audit machine. App entry is 283.80 kB raw / 76.60 kB gzip. The intentionally isolated catalog chunk is 1,309.57 kB raw / 114.27 kB gzip and remains the only >500 kB warning. It is lazy/stable, highly compressible, and required by catalog-heavy screens; removing its data or hiding the warning was rejected. PWA precache is 77 entries / 4,460.71 KiB. Generated images remain runtime-cached rather than embedding 197.4 MiB in initial JavaScript.

Bounded runtime structures remain: 18 virtual listing pages, 160 economy records, 480 ledger IDs, 800 Business operation IDs, 1,200 Career event IDs, 24 Prestige/economy run summaries and 96 detailed Prestige request IDs. Source-run binding protects destructive Prestige even after request compaction.

## Accessibility and responsive results

The browser suite found no horizontal overflow or console errors across all player-facing routes at 1366×768. Work/opening/Business checks pass at 1920×1080, 1366×768, 1280×720, 768×1024, 390×844, 375×812 and 320×720. Light Mode, Large Text, focused Memory Circuit and Precision Strike, visible controls, keyboard-capable Work alternatives and dialogs remain covered. Automated checks reduce risk but are not a substitute for assistive-technology and physical-device testing.

## Long-session and economy validation

The bounded-history tests cover request compaction, scheduler watermarks, repeat reloads, migration idempotence and cross-run Prestige replay. The deterministic seed `3308146696` completed 300,000 modeled careers and 500,000 item-level openings in 6.07 seconds of simulation work. Competent regular median first gate stayed 63.17 engaged hours; the five-tier projection stayed 781.1 hours. All five sampled cases remained negative EV. This is aggregate stochastic modeling, not 781 hours of player telemetry.

## Verification snapshot

- TypeScript: pass.
- ESLint: pass, zero errors.
- Vitest: 80 files / 463 tests pass.
- Playwright Chromium: 26/26 pass in 3.9 minutes.
- Assets: 2,134 files / 197.4 MiB verified.
- Vite/PWA build: pass with the documented catalog warning.
- Full Career simulation: pass; 300,000 careers / 500,000 openings.
- Dependency audit: production tree reports zero; full development tree reports 12 non-production low/moderate findings after all safe in-range fixes. No high or critical finding remains.

## Remaining limitations

- Live Supabase deployment is not verified and blocks a **full cloud** verdict.
- Exact paint-seed artwork is unavailable; catalog thumbnails remain representative.
- Market prices and rare Pattern evidence are snapshots/estimates, never guaranteed live sale prices.
- Physical low-end devices, screen readers and long human sessions remain appropriate post-release monitoring targets.
- The catalog chunk warning is accepted and visible, not suppressed.
