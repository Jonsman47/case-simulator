# CS2 Case Opening Simulator — Project Status

Audit date: 2026-10-09
Application directory: `case-opening-simulator/`
Current save schema: v28

## Executive summary

The simulator is a substantial, playable React browser game. Its core loop is complete: choose and license a case, pay once, generate a weighted predetermined item, run the roulette to that item, add it once to inventory, inspect or sell it, and progress through collection, upgrade, skill, prestige, work, trade-up, automation, and offline systems.

Prompt 2 is complete. The dormant gameplay-event and market-event engines are connected to live provider/reducer ticks, saved and restored, represented in a public Events screen, mirrored into the Market banner, and processed during offline progress. Warehouse capacity is enforced safely. Auction House deals are real simulated purchases. Automation, upgrade, skill, prestige, event, sale, and offline modifiers have been audited and connected to gameplay. Existing over-capacity saves are preserved rather than truncated.

The catalog contains 42 cases, 2,092 skins, and 2,134 verified generated images. Development, production build, PWA generation, and the automated suite are functional. Remaining work is concentrated in the mandatory pattern/paint-seed system, remotely verified cloud/social features, price/data gaps, performance/browser E2E hardening, and final visual/accessibility/balance polish.

## 1. Project overview

### What the simulator does

- Starts a local player with $100 and two unlocked starter cases.
- Provides 42 real CS2 cases with unlocks, licenses, search/filter/sort tools, odds, contents, favorites, and previews.
- Generates weighted drops with rarity, float/wear, StatTrak and Souvenir eligibility, price, and collection metadata.
- Animates single and batch openings and stops on the predetermined reward, including gold suspense, sound, speed settings, speed upgrades, skipping, and summaries.
- Tracks inventory, collection discovery, sales, market history, trophies, achievements, statistics, daily rewards/challenges, upgrades, skill branches, prestige, work mini-games, trade-ups, automation, and offline progress.
- Runs timed gameplay events and market events with capped modifiers, countdowns, notifications, history, persistence, and offline processing.
- Provides Auto Opener, Opening Desk, Case Farm, Trading Bot, Market Analyst, Warehouse, and Auction House progression.
- Persists locally with versioned migrations and includes optional mock/Supabase cloud-save infrastructure.
- Installs as a PWA and caches the application shell plus runtime case/skin images and sounds.

### Tech stack, data, and persistence

- React 19, React DOM, React Router 7, TypeScript 6, and Vite 8.
- Tailwind CSS 3, PostCSS, and Autoprefixer.
- Vitest, Testing Library, jsdom, and ESLint.
- `react-window` for virtualized lists; Chart.js/`react-chartjs-2` for charts; Lucide React for icons.
- `vite-plugin-pwa`, Workbox, and `workbox-window` for PWA behavior.
- Versioned `localStorage` saves, currently schema v28.
- Optional local mock or Supabase REST/RPC cloud backends; no production credentials are committed.
- Generated TypeScript catalog/price data and locally generated/downloaded image assets verified through a tracked SHA-256 manifest.
- npm is authoritative; `package-lock.json` is the lockfile.

### Install and run

Requirements: Node.js 20.19 or newer.

```bash
cd case-opening-simulator
npm ci
npm run assets:sync
npm run dev
```

Open `http://localhost:5173/`.

Production and release commands:

```bash
npm run build
npm run preview:prod
npm run verify:release
```

`assets:sync` downloads only missing or checksum-invalid case/skin images. `assets:verify` runs before development and builds. Full setup/deployment instructions are in `case-opening-simulator/README.md` and `case-opening-simulator/docs/release-deployment.md`.

### Functional state

The application is functional in development and production. TypeScript, lint, the 293-test suite, asset verification, Vite bundling, and PWA generation pass. The core game is playable; the remaining planned stages are listed below.

## 2. Implemented features

| Feature | Status | What works | Missing or limited |
| --- | --- | --- | --- |
| Cases and selection | **COMPLETE** | 42 cases, starter unlocks, licenses, affordability, filters/sorts, contents, odds, favorites, single/batch controls. | Long-run economy still needs human playtesting. |
| Case opening and roulette | **COMPLETE** | Predetermined reward, target stop, single/multi reels, suspense, sound, normal/fast/skip timing, upgrade/skill speed, result and batch summary, protected UI session. | No checked-in browser E2E suite. |
| Opening transaction safety | **COMPLETE** | One reducer transaction charges and grants exactly once; rapid clicks are blocked; unrelated renders, routes, events, cloud merges, and timer cleanup do not erase the active UI session. | No confirmed gap. |
| Real CS2 skin database | **COMPLETE** | 2,092 skins with weapon/finish, rarity, images, cases, float range, wear, StatTrak/Souvenir flags, and prices. | Snapshot data, not a live Valve API. |
| Rarity and probabilities | **COMPLETE** | Consumer through Contraband/Special Item, normalized odds, weighted drops, luck, event rarity modifiers, batch behavior, tests. | Balance needs long-run simulation. |
| Knives and gloves | **COMPLETE** | Special pools, real names/images, gold suspense, catalog/collection/inventory, achievements. | A small price-import fallback group remains. |
| Float and wear | **COMPLETE** | Skin-specific ranges, generated float, five wear conditions, pricing, filters/sorts, trade-up math, migrations. | Paint seed/pattern behavior is not implemented. |
| StatTrak and Souvenir | **COMPLETE** | Eligibility-aware generation, labels, prices, inventory/collection, rules, persistence. | Pricing remains snapshot/fallback based. |
| Inventory management | **COMPLETE** | Virtualized responsive grid, details, locks, favorites, duplicate protection, bulk actions, trophies, filters/sorts, charts, capacity/free-slot display. | No confirmed core gap. |
| Warehouse capacity | **COMPLETE** | Base capacity 250; Warehouse, upgrade, prestige, and skill bonuses stack; manual/batch/auto/offline/Auction rewards honor free slots; over-cap legacy saves are grandfathered and never truncated. | Capacity values need balance playtesting. |
| Skin selling | **COMPLETE** | Single/bulk/auto-sale, lock protection, collection/upgrade/skill/prestige/module/event multipliers, notifications, stats, exact accounting. | No player-to-player marketplace. |
| Currency/economy | **PARTIALLY COMPLETE** | Costs, licenses, sales, rewards, work/automation income, event modifiers, prestige, finite clamps, exact-once accounting. | Formal long-run economy report and human pacing tests remain. |
| Skin prices | **PARTIALLY COMPLETE** | Generated wear/StatTrak prices for 2,071 skins, fallbacks, adjusted instance values, history, trends, event effects. | 21 skins and 250 wear-price slots use fallbacks; data is not live. |
| Market | **COMPLETE** for the intended simulated scope | Searchable virtualized 2,092-skin viewer with thumbnails, rarity, value/trends, charts, timed random walk, category events, safe finite caps, selling consistency. | It is intentionally not a real-money or player-to-player market. |
| Gameplay events | **COMPLETE** | Random/manual generation, activation, expiration, conflict rules, three-event cap, modifiers for openings/rarity/collection/sales/trade-ups/prestige/automation, notifications, countdowns, history, admin controls, persistence, offline ticks. | Event frequency and balance need playtesting. |
| Market events | **COMPLETE** | Autonomous and gameplay-derived price events, category targeting, affected-item counts, banner, public Events page, countdowns/history, save/load, offline processing, bounded impacts. | No live external market feed. |
| Collection tracking | **COMPLETE** | Permanent discovery, wear completion, best float/value, pagination, filters/sorts, summaries, event-scaled rewards. | Pattern variants will require new completion rules later. |
| Filters and sorting | **COMPLETE** | Case, inventory, market, collection, and trophy tools. | Language selection does not localize labels. |
| Local save/load | **COMPLETE** | Autosave, lifecycle persistence, v0–v28 migrations, event/auction hydration, normalization, JSON import/export, reset, tests. | No confirmed gap. |
| Cloud save | **PARTIALLY COMPLETE** | Mock/Supabase providers, auth UI, revisioned saves, merge, force sync, offline state, SQL/RLS, tests. New v28 data travels in serialized state. | Real deployed multi-device/auth/conflict flows are unverified. |
| Settings | **PARTIALLY COMPLETE** | Save, sound, animation/skip/fast timing, motion, market, notifications, themes, accessibility, rarity colors, onboarding, cloud, auto-sell. | Background music is absent; language selection does not translate the app. |
| Trade-ups | **COMPLETE** | Ten-item validation, outcome pools/odds, float formula, values, protections, results, stats, Trading Bot; event input modifiers apply online/offline. | Pattern inheritance/seed generation awaits the pattern stage. |
| Auto Opener | **COMPLETE** | Upgradeable interval, selected case, capacity/funds safety, identical opening/event/economy rules online/offline. | Balance needs playtesting. |
| Opening Desk | **COMPLETE** | Timed batches, progression interval/batch modifiers, capacity/funds safety, online/offline parity. | Balance needs playtesting. |
| Case Farm | **COMPLETE** | Passive income based on level/unlocks with upgrade, prestige, skill, event, and offline modifiers. | Balance needs playtesting. |
| Trading Bot | **COMPLETE** | Finds valid profitable trade-ups, obeys thresholds, modifiers, capacity, and offline timing. | Profit model depends on snapshot prices. |
| Market Analyst | **COMPLETE** | Improves manual, bulk, and automated selling quotes. | No separate predictive chart overlay. |
| Auction House | **COMPLETE** | Periodic time-limited offers using real skin data/images, wear/rarity/list price/discount, upgrade and skill offer counts, exact-once purchase, funds/capacity checks, persistence, stats, achievement. | Simulated buying only; no listing/selling marketplace. |
| Automation module slots | **COMPLETE** | Two base active slots plus Module Bay upgrades; passive Warehouse consumes no slot; existing over-slot saves remain enabled; new enabling is safely blocked with feedback. | Slot count needs balance playtesting. |
| Offline progress | **COMPLETE** | Capped elapsed simulation for automation, capacity, auto-sell, events, market ticks, Auction refresh, event-aware timing and income; summary UI reports event/market processing. | Extreme saves/device performance need profiling. |
| Upgrade shop | **COMPLETE** | Eleven multi-level upgrades; every advertised effect now has a runtime effect, including opening speed, Work income, event discovery, slots, capacity, sales, cost, wear, rarity, batch, and automation speed. | Balance needs playtesting. |
| Prestige | **COMPLETE** | Eligibility/projection/reset/preservation, seven permanent tracks; automation, sales, luck, capacity, starting cash, and event discovery apply. | Long-run balance unvalidated. |
| Skill tree | **COMPLETE** | Prerequisites, points, generated branches, persistence; sale, wear, automation, Auction offers, trade-up, event, prestige, luck, licenses, Work, passive/offline, opening speed/batch, capacity, and trophies apply. | Balance needs playtesting. |
| Achievements | **COMPLETE** | Milestones, named/hidden achievements, claims, rewards, UI, Auction purchase achievement, tests. | No confirmed core gap. |
| Daily rewards/challenges | **COMPLETE** | Seven-day cycle, varied rewards, challenge progress, claim/reroll, timers, tests. | Real midnight rollover has not been manually observed. |
| Work mini-games | **COMPLETE** | Poop Cleaning and Sort Boxes rewards/cooldowns/persistence; upgrade and skill income multipliers; UI/error handling/tests. | Legacy redirected source view remains. |
| Statistics | **COMPLETE** | Summary, money flow, rarity share, trends, milestones, comparisons, ranges, CSV, Auction metrics. | No external analytics. |
| Trophy room | **COMPLETE** | Unlockable slots, assign/replace/remove, search, scoring, warnings, details, tests. | Active UI is local despite cloud tables. |
| Onboarding/notifications/sound | **PARTIALLY COMPLETE** | Tutorial, tips, toasts, event start/end alerts, celebrations, effects/opening audio, PWA notices. | Music and granular notification channels are not implemented. |
| Leaderboards | **NOT IMPLEMENTED** in active app | Backend methods, Supabase view, and React view exist. | Route redirects home; navigation absent; backend unverified. |
| Admin tools | **COMPLETE** for local development | Client-side guard plus economy, inventory, progression, save, real event triggers, and event ticking controls. | It is intentionally not a server-side security boundary. |
| PWA/offline install | **COMPLETE** | Manifest, service worker, prompts, update/offline UI, shell precache, runtime caches, verification. | Images cache on use rather than precaching all 197 MiB. |
| Asset reliability | **COMPLETE** | Tracked path/source/size/SHA-256 manifest for 2,134 images; sync/verify; build gate; base-safe URLs; fallback/aspect sizing. | Fresh setup needs network access to populate ignored generated binaries. |
| Paint seeds and valuable patterns | **NOT IMPLEMENTED** | Existing item instances have stable IDs and a centralized creation/valuation path suitable for extension. | Seed 0–1000, Case Hardened tiers/Blue Gems, Fade %, Doppler phases, premiums, UI, trade-up/save/cloud support remain Stage 3. |
| Simulation worker | **NOT IMPLEMENTED** in active app | Worker logic exists. | Nothing imports/creates it. |

## 3. Current problems

### Confirmed

1. Realistic paint seeds and finish-specific pattern valuation are not implemented.
2. Leaderboards exist in source but are not routed in the active app and the real backend is unverified.
3. Background music and localization are not implemented even though settings infrastructure exists.
4. Twenty-one skins and 250 wear-price slots use price fallbacks.
5. The production build warns about large main (~621 kB), prices (~649 kB), and skins (~1.276 MB) chunks before gzip.
6. No persistent browser E2E suite is checked in.
7. Real Supabase multi-device/auth/conflict behavior is not verified against a deployed project.
8. Nine development-only audit advisories remain in the Tailwind 3/tooling dependency tree; the production dependency audit was clean in Prompt 1. Removing them requires a breaking Tailwind 4 migration.
9. The optional tracked `CounterStrike2Skins` submodule checkout is missing in the existing worktree; generated outputs are self-sufficient.
10. The worktree contains a broad pre-existing uncommitted batch that has been preserved.

### Fixed in Prompt 2

- Removed the reducer validation path that cleared event state and restored real event ticks in the provider/reducer.
- Connected event modifiers to cases, odds, collection rewards, selling, trade-ups, prestige, automation, and offline progress.
- Added conflict/deduplication rules, a three-active-event cap, and bounded multiplier composition.
- Reconnected the public Events screen, navigation, Market banner, notifications, countdowns, history, and admin triggers.
- Restored autonomous market events, category targeting, affected-item reporting, safe finite pricing, bounded per-tick movement, charts, persistence, and offline ticks.
- Added a 250-slot base inventory capacity with Warehouse, upgrade, prestige, and skill expansion and non-destructive legacy-save handling.
- Added capacity-safe manual, batch, automatic, offline, daily-reward, and Auction acquisition behavior.
- Implemented persistent Auction House deal generation and exact-once purchases with images, discount, wear, expiry, stats, and achievement integration.
- Connected previously inert upgrade/skill/prestige effects: opening timing, Work income, event discovery, module slots, and Auction offer slots.
- Fixed fresh games incorrectly receiving a synthetic 24-hour offline report and made long offline simulation batched and practical.
- Migrated saves to v28 without dropping old inventory, events, market events, or automation progress.

### Suspected or not yet proven

- End-game economy and event frequency may need balance changes after human playtesting.
- Very large saves and long-running low-end mobile sessions may reveal performance pressure.
- Real Supabase auth expiry, stale-device conflicts, public leaderboards, and public trophies may expose integration issues.
- A true cold offline launch with only a partially warmed image runtime cache needs broader device testing.

## 4. Development progress and history

- Git has one recorded commit: `92d9f8f Initial upload` on `main`/`origin/main`.
- The working tree is a large uncommitted batch spanning catalog import, pricing, opening lifecycle, saves/cloud, progression, trophies, work, admin/credits, navigation, assets, and tests. It has not been reset or discarded.
- Generated reports show a major data pass dated 2026-06-28.
- There is no repository prompt archive or reliable older prompt-number completion log. Previous prompts before this six-stage roadmap cannot be reconstructed honestly.
- Stage 1 completed dependency/build/PWA/asset reliability, responsive stability, and regression coverage for the opening-session fix.
- Stage 2 completed events, simulated market events, Warehouse capacity, Auction House deals, automation/progression effect wiring, offline parity, and schema v28.
- The most recent implementation work is the Prompt 2 event/automation restoration and audit described above.

## 5. Paint seed and valuable-pattern integration plan

This is deliberately not implemented in Prompt 2. The safe Stage 3 design is:

1. **Definition metadata:** add a pattern profile keyed by skin/finish identity, not a universal random multiplier. Profiles describe standard, Case Hardened, Fade, Doppler, Marble Fade, and any other supported finish-specific behavior.
2. **Item identity:** extend `SkinInstance` with `paintSeed` constrained to integer 0–1000 and a versioned pattern result such as type, display label, optional phase/fade/blue percentage, rarity tier, and valuation multiplier. Store the resolved result so later ruleset changes do not silently mutate owned items.
3. **Single generation path:** generate the seed with the same injected PRNG inside the centralized `createSkinInstance` path. Manual openings, batches, automation, offline openings, Auction deals, daily items, and trade-up outputs must all use that path.
4. **Deterministic classifiers:** implement pure, tested finish-specific classifiers. Case Hardened must use curated seed/tier tables or defensible coverage data; Fade and Doppler must use finish-specific mappings. Do not label arbitrary seeds as valuable.
5. **Valuation architecture:** calculate `base condition value × StatTrak/Souvenir factor × pattern premium`, with finite caps and a stored valuation-rules version. Most seeds remain near normal value; rare tiers can command large but bounded premiums. Market/event multipliers remain downstream of intrinsic instance valuation.
6. **Save migration:** add schema v29. Existing items should receive a deterministic seed derived from stable instance identity, or remain explicitly `unseededLegacy` until inspected; the chosen policy must not reroll on load. Preserve stored historical market value during migration and recompute only through a documented valuation upgrade.
7. **Cloud merge:** keep `instanceId` as the merge key and treat pattern fields as immutable item identity. Validate/clamp imported seeds and reject malformed pattern payloads without dropping the item.
8. **Gameplay integration:** trade-ups generate a new output seed; selling, bulk sale, auto-sale, Auction purchase, collection best-value tracking, achievements, statistics, and trophy scoring consume the same valuation helper.
9. **UI:** show seed and pattern details in opening results, item details, Inventory, Market/Auction, collection, and trade-up results. Add filters only after data exists; do not imply every finish has meaningful pattern variance.
10. **Tests:** boundary seeds 0 and 1000, known premium and ordinary seeds, deterministic generation, migration stability, exact-once purchases/openings, online/offline parity, valuation caps, save/cloud round trips, and UI display.

## 6. Recommended next steps

Four major prompts remain in the six-stage roadmap:

1. **Prompt 3 — Paint Seeds and Pattern Identity:** implement the architecture above, valuation, migrations, all gameplay/UI integration, and known-pattern fixtures.
2. **Prompt 4 — Cloud and Social:** verify real Supabase auth/sync/conflicts, activate leaderboards, and decide public trophy behavior.
3. **Prompt 5 — Data, Performance, and Browser E2E:** close price gaps, split/defer large data chunks, profile large saves/inventories, and add Playwright critical-flow coverage.
4. **Prompt 6 — Final UI, Accessibility, Balance, and Release:** comprehensive visual pass, localization/music decision, accessibility, economy simulations/human playtests, cleanup, deployment/offline/update sign-off.

Estimate: **four additional major Codex prompts**, one per stage above. Small follow-up prompts may still be required for findings from real cloud credentials or human balance testing.

## 7. Overall completion estimate

| Area | Estimate | Basis |
| --- | ---: | --- |
| Core gameplay | **96%** | Main loops, events, automation, offline, and transaction safety work; pattern identity and final balance remain. |
| Skin/case data | **94%** | Full catalog/assets; price fallback gaps and paint-pattern metadata remain. |
| Inventory and economy | **94%** | Capacity, selling, Auction, event/automation modifiers, persistence, and exact accounting work; pattern valuation and balance remain. |
| UI and animations | **91%** | Stable responsive core, opening/results, Events/Auction/Warehouse UI, images/icons; final accessibility/visual/E2E pass remains. |
| Overall project | **92%** | Feature-rich and buildable; four focused stages remain, led by patterns and remote/cloud/performance/release proof. |

## Verification snapshot

- TypeScript (`npx tsc -b --pretty false`): pass.
- Targeted event/market/opening/reducer/offline/save tests: pass.
- Full tests: pass — 60 files, 293 tests (bounded to two workers after a concurrent build/test run starved Windows worker processes).
- `npm run lint`: pass — zero errors.
- `npm run build`: pass — 2,134 assets verified; TypeScript and Vite pass; PWA generates 84 precache entries.
- `npm run verify:release`: pass — lint, all 293 tests, asset verification, TypeScript, Vite/PWA build, and release verification all completed successfully.
- Large-chunk warnings remain informational and are tracked for Stage 5.
- Browser smoke verification: pass in the real local UI. Two consecutive Kilowatt openings completed, the result screen showed the predetermined winner, a Revolution rapid double-click charged/granted once, skip/close completed safely, and balance/item counts persisted after reload.
- Event browser verification: pass. Offline ticking activated Winter Cases, the banner/toast/countdown and Events screen rendered, the Kilowatt price changed from $2.65 to $2.38, and an opening during the live event completed with one discounted charge and one reward.
- Market and Inventory thumbnails rendered with correct contain sizing; the item-detail modal scrolled inside the viewport. Explicit 390×844 and 1440×900 checks had no horizontal document overflow.
- Browser console after the smoke flows: no warnings or errors.
- Local development server left running at `http://127.0.0.1:5173/`; the duplicate 5174 process used during testing was stopped.

The first sandboxed test attempt executed zero tests because Windows denied Vitest temporary-cache renames. A later test/build pair was mistakenly run concurrently and starved worker processes; the isolated full suite then passed 60/60 files and 293/293 tests.
