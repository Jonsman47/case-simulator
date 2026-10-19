# CS2 Case Opening Simulator — Project Status

Audit date: 2026-10-19
Application directory: `case-opening-simulator/`
Current save schema: v30

## Executive summary

The simulator is a substantial, playable React browser game. Its core loop is complete: choose and license a case, pay once, generate a weighted predetermined item, run the roulette to that item, add it once to inventory, inspect or sell it, and progress through collection, upgrade, skill, prestige, work, trade-up, automation, and offline systems.

Prompts 1–6 are complete in the repository. Gameplay and market events, Warehouse capacity, Auction House deals, automation, upgrades, skills, prestige, selling, and offline progression are connected to live gameplay. Every newly generated item receives a permanent paint seed from 0–1000 and a finish/weapon-specific pattern classification. Pattern-aware values, protections, UI, statistics, achievements, and v30 persistence are used consistently across item-creation and item-value paths. Existing inventory is preserved without silently inventing or rerolling legacy seeds.

Prompt 4 completes the account/social architecture: optional Supabase Auth, persistent refreshable sessions, account-scoped local fallbacks, atomic revision-checked cloud writes, explicit conflict resolution with backups, privacy-controlled public profiles and selected trophies, and seven active leaderboard categories. Local guest play remains the default when Supabase is not configured. The complete local/mock implementation and browser surfaces are verified; a real Supabase project was unavailable, so deployed Auth/RLS/RPC, email delivery, and physical multi-device verification remain blocked and are not presented as passed.

Prompt 5 added two real skill jobs, separated simultaneous roulette panels, improved price coverage and runtime data size, and introduced Playwright plus clean-checkout CI. Prompt 6 finishes the release pass without redesigning the dark interface: Work now uses compact overview cards and focused viewport-bounded games, Memory Circuit has distinguishable flash/gap timing, common dialogs trap and restore focus, reduced-motion and visible-focus behavior is shared globally, misleading Music/Language controls are removed, Chart.js is deferred out of startup, and repeatable economy simulations document bounded progression. The catalog remains 42 cases, 2,092 skins, and 2,134 verified generated images. Remaining limitations are credential-dependent Supabase proof, conservative price/pattern estimates, exact seed artwork, and controlled physical-device profiling.

## 1. Project overview

### What the simulator does

- Starts a local player with $100 and two unlocked starter cases.
- Provides 42 real CS2 cases with unlocks, licenses, search/filter/sort tools, odds, contents, favorites, and previews.
- Generates weighted drops with rarity, float/wear, StatTrak and Souvenir eligibility, a permanent paint seed, pattern classification, intrinsic pattern-adjusted value, and collection metadata.
- Animates single and batch openings and stops on each predetermined reward, including gold suspense, sound, speed settings, speed upgrades, skipping, adaptive fullscreen multi-open layouts, and summaries.
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
- Versioned `localStorage` saves, currently schema v30.
- Build-time `csgo-blue-gem-calculator` and `csgo-fade-percentage-calculator` generation produces compact deterministic lookup data; the calculators are no longer shipped as runtime dependencies. Curated finish-specific rules remain the authority for premium tiers.
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

The application is functional in development and production. TypeScript, lint, asset verification, Vite bundling, and PWA generation pass. The core game is playable; exact current test totals are recorded in the verification snapshot. The remaining planned stages are listed below.

## 2. Implemented features

| Feature | Status | What works | Missing or limited |
| --- | --- | --- | --- |
| Cases and selection | **COMPLETE** | 42 cases, starter unlocks, licenses, affordability, filters/sorts, contents, odds, favorites, single/batch controls. | Long-run economy still needs human playtesting. |
| Case opening and roulette | **COMPLETE** | Predetermined reward, target stop, suspense, sound, timing upgrades, protected UI session, and exact-once transactions. Single openings stay large; 2–3 use showcase, 4–6 grid, and 7–10 dashboard layouts. Each opening now has a numbered, bordered reel/reveal container and aligned target marker. Playwright exercises 1/2/3/5/10 openings. | Final subjective animation polish remains for Prompt 6. |
| Opening transaction safety | **COMPLETE** | One reducer transaction charges and grants exactly once; rapid clicks are blocked; unrelated renders, routes, events, cloud merges, and timer cleanup do not erase the active UI session. | No confirmed gap. |
| Real CS2 skin database | **COMPLETE** | 2,092 skins with weapon/finish, rarity, images, cases, float range, wear, StatTrak/Souvenir flags, and prices. | Snapshot data, not a live Valve API. |
| Rarity and probabilities | **COMPLETE** | Consumer through Contraband/Special Item, normalized odds, weighted drops, luck, event rarity modifiers, batch behavior, tests. | Balance needs long-run simulation. |
| Knives and gloves | **COMPLETE** | Special pools, real names/images, gold suspense, catalog/collection/inventory, achievements. | A small price-import fallback group remains. |
| Float and wear | **COMPLETE** | Skin-specific ranges, generated float, five wear conditions, pricing, filters/sorts, trade-up math, migrations. | No confirmed core gap. |
| StatTrak and Souvenir | **COMPLETE** | Eligibility-aware generation, labels, prices, inventory/collection, rules, persistence. | Pricing remains snapshot/fallback based. |
| Inventory management | **COMPLETE** | Virtualized responsive grid, details, locks, favorites, duplicate and exceptional-pattern protection, bulk actions, trophies, pattern search/filter/sort, charts, and capacity/free-slot display. | Seed-specific thumbnails are unavailable; the UI states that catalog art is representative. |
| Warehouse capacity | **COMPLETE** | Base capacity 250; Warehouse, upgrade, prestige, and skill bonuses stack; manual/batch/auto/offline/Auction rewards honor free slots; over-cap legacy saves are grandfathered and never truncated. | Capacity values need balance playtesting. |
| Skin selling | **COMPLETE** | Single/bulk/auto-sale, lock protection, collection/upgrade/skill/prestige/module/event multipliers, notifications, stats, exact accounting. | No player-to-player marketplace. |
| Currency/economy | **PARTIALLY COMPLETE** | Costs, licenses, sales, rewards, work/automation income, event modifiers, prestige, finite clamps, exact-once accounting. | Formal long-run economy report and human pacing tests remain. |
| Skin prices | **PARTIALLY COMPLETE** | Generated condition prices now cover 2,087 of 2,092 skins, including improved vanilla-knife matching, 5,290 StatTrak values, and explicit Souvenir condition support. Safe intrinsic valuation, documented pattern premiums, history, trends, confidence labels, and event effects avoid premium double-counting. | Five vanilla knife entries and 75 condition slots retain clearly labeled fallbacks after the reference site rate-limited the remaining refresh. Data and rare-pattern appraisals are snapshots/estimates, not live quotes. |
| Market | **COMPLETE** for the intended simulated scope | Searchable virtualized 2,092-skin viewer with thumbnails, rarity, value/trends, charts, timed random walk, category events, safe finite caps, selling consistency. | It is intentionally not a real-money or player-to-player market. |
| Gameplay events | **COMPLETE** | Random/manual generation, activation, expiration, conflict rules, three-event cap, modifiers for openings/rarity/collection/sales/trade-ups/prestige/automation, notifications, countdowns, history, admin controls, persistence, offline ticks. | Event frequency and balance need playtesting. |
| Market events | **COMPLETE** | Autonomous and gameplay-derived price events, category targeting, affected-item counts, banner, public Events page, countdowns/history, save/load, offline processing, bounded impacts. | No live external market feed. |
| Collection tracking | **COMPLETE** | Permanent discovery, wear completion, best float/value (including pattern premium), pagination, filters/sorts, summaries, and event-scaled rewards. | Pattern seeds are item attributes rather than separate collection-book completion slots. |
| Filters and sorting | **COMPLETE** | Case, inventory, market, collection, and trophy tools. | Language selection does not localize labels. |
| Local save/load | **COMPLETE** | Autosave, lifecycle persistence, v0–v30 migrations, immutable pattern round trips, legacy-item no-reroll behavior, event/Auction/Work hydration, JSON import/export, reset, and tests. | No confirmed gap. |
| Cloud save | **COMPLETE** for implemented/local scope; deployed verification blocked | Guest mode; local mock and Supabase providers; persistent/refreshable auth; account-scoped local snapshots; automatic/manual sync; atomic optimistic revisions; visible local/cloud conflict choice; backups; corrupt-save rejection; status UI; v30 IDs, floats, wear, patterns, prices, economy, Work statistics, progression, automation, Auction, events, collection, statistics, and settings preserved. | A configured real Supabase project was unavailable, so deployed Auth/RLS/RPC, email delivery, offline recovery across physical devices, and production rate-limit behavior remain unverified. |
| Settings | **COMPLETE** for current product scope | Save, sound effects, animation/skip/fast timing, motion, market, notifications, themes, accessibility, rarity colors, onboarding, cloud, auto-sell. Misleading Music and Language controls were removed while their legacy save fields remain compatible. | The product is English-only and does not ship a music library. |
| Trade-ups | **COMPLETE** | Ten-item validation, outcome pools/odds, float formula, centralized output seed/pattern generation, pattern-aware values/protection, results, stats, and Trading Bot; event input modifiers apply online/offline. | No confirmed core gap. |
| Auto Opener | **COMPLETE** | Upgradeable interval, selected case, capacity/funds safety, identical opening/event/economy rules online/offline. | Balance needs playtesting. |
| Opening Desk | **COMPLETE** | Timed batches, progression interval/batch modifiers, capacity/funds safety, online/offline parity. | Balance needs playtesting. |
| Case Farm | **COMPLETE** | Passive income based on level/unlocks with upgrade, prestige, skill, event, and offline modifiers. | Balance needs playtesting. |
| Trading Bot | **COMPLETE** | Finds valid profitable trade-ups, obeys thresholds, modifiers, capacity, and offline timing. | Profit model depends on snapshot prices. |
| Market Analyst | **COMPLETE** | Improves manual, bulk, and automated selling quotes. | No separate predictive chart overlay. |
| Auction House | **COMPLETE** | Periodic time-limited offers using real skin data/images, permanent seed/pattern identity, intrinsic/list/discount prices, upgrade/skill offer counts, exact-once purchase, funds/capacity checks, persistence, stats, and achievements. | Simulated buying only; catalog thumbnails do not render the exact seed. |
| Automation module slots | **COMPLETE** | Two base active slots plus Module Bay upgrades; passive Warehouse consumes no slot; existing over-slot saves remain enabled; new enabling is safely blocked with feedback. | Slot count needs balance playtesting. |
| Offline progress | **COMPLETE** | Capped elapsed simulation for automation, capacity, auto-sell, events, market ticks, Auction refresh, event-aware timing and income; summary UI reports event/market processing. | Extreme saves/device performance need profiling. |
| Upgrade shop | **COMPLETE** | Eleven multi-level upgrades; every advertised effect now has a runtime effect, including opening speed, Work income, event discovery, slots, capacity, sales, cost, wear, rarity, batch, and automation speed. | Balance needs playtesting. |
| Prestige | **COMPLETE** | Eligibility/projection/reset/preservation, seven permanent tracks; automation, sales, luck, capacity, starting cash, and event discovery apply. | Long-run balance unvalidated. |
| Skill tree | **COMPLETE** | Prerequisites, points, generated branches, persistence; sale, wear, automation, Auction offers, trade-up, event, prestige, luck, licenses, Work, passive/offline, opening speed/batch, capacity, and trophies apply. | Balance needs playtesting. |
| Achievements | **COMPLETE** | Milestones, named/hidden achievements, claims, rewards, UI, Auction purchase achievement, tests. | No confirmed core gap. |
| Daily rewards/challenges | **COMPLETE** | Seven-day cycle, varied rewards, challenge progress, claim/reroll, timers, tests. | Real midnight rollover has not been manually observed. |
| Work mini-games | **COMPLETE** | Polished responsive Poop Cleaning and Sort Boxes plus frame-rate-independent Precision Strike and three-round Memory Circuit. Mouse, touch, keyboard, feedback, progress, capped performance rewards, persistent cooldowns, upgrade/skill modifiers, exact-once claims, statistics, unit tests, and Playwright coverage are active. | Final economy pacing still needs long human playtesting. |
| Statistics | **COMPLETE** | Summary, money flow, rarity share, trends, milestones, comparisons, ranges, CSV, Auction metrics, pattern drops, and exceptional-pattern drops. | No external analytics. |
| Trophy room | **COMPLETE** | Unlockable slots, assign/replace/remove, search, scoring, warnings, details, tests, cloud preservation, public/private status, and a link to the selected-trophy profile showcase. Sold/missing assignments retain a safe snapshot warning. | Catalog art is representative rather than seed-rendered. |
| Onboarding/notifications/sound | **PARTIALLY COMPLETE** | Tutorial, tips, toasts, event start/end alerts, celebrations, effects/opening audio, PWA notices. | Music and granular notification channels are not implemented. |
| Leaderboards | **COMPLETE** for client-reported scope | Active navigation/route; seven deterministic pattern-aware categories; personal rank; pagination; responsive table/cards; loading/error/empty states; opt-in public names; separate labels for local mock and configured community rankings. | Values are client-reported and not cheat-proof; real global backend is unverified. |
| Player accounts and profiles | **COMPLETE** for implemented/local scope; deployed verification blocked | Registration/login/logout/reset interfaces, session persistence/refresh, display-name/avatar management, duplicate-name handling, account status/dropdown, safe switching, privacy controls, responsive public profiles, selected trophy images/details, and older unseeded item support. | Real Supabase email/reset delivery and live cross-account access tests require credentials. |
| Admin tools | **COMPLETE** for local development | Client-side guard plus economy, inventory, progression, save, real event triggers, and event ticking controls. | It is intentionally not a server-side security boundary. |
| PWA/offline install | **COMPLETE** | Manifest, service worker, prompts, update/offline UI, shell precache, runtime caches, verification. | Images cache on use rather than precaching all 197 MiB. |
| Asset reliability | **COMPLETE** | Tracked path/source/size/SHA-256 manifest for 2,134 images; sync/verify; build gate; base-safe URLs; fallback/aspect sizing. | Fresh setup needs network access to populate ignored generated binaries. |
| Paint seeds and valuable patterns | **COMPLETE** for the documented simulator scope | New items receive immutable seed 0–1000. Finish/weapon-specific rules cover Case Hardened/Heat Treated, Fade, Doppler/Gamma phases and gems, and selected Marble Fade patterns. Pricing, selling protection, UI, filters, statistics, achievements, trade-ups, Auction, local/cloud saves, and all centralized reward paths consume the same pattern metadata. | Exact per-seed rendered artwork is unavailable. Premiums are conservative simulator estimates where market evidence is incomplete; they are not appraisal guarantees. |
| Performance architecture | **COMPLETE** for release scope | Lazy routes/charts, stable vendor/data chunks, virtualized large lists, cached generated lookups, lazy decoded images, PWA caching, and documented budgets. | The lazy skin catalog remains 1.31 MB raw/114 KB gzip; moving it to a data service was rejected as disproportionate complexity. |

## 3. Current problems

### Confirmed

1. Real Supabase multi-device/auth/conflict behavior is not verified against a deployed project because no test credentials were available.
2. Public rankings are client-reported. RLS protects row ownership/privacy but cannot prove that a client-generated score is legitimate.
3. Background music and localization are intentionally outside the finished scope; the misleading controls are no longer shown. Legacy serialized fields remain readable for save compatibility.
4. Five skins and 75 wear-price slots use price fallbacks. The remaining five are vanilla Nomad, Stiletto, Talon, Skeleton, and Kukri entries whose source pages were rate-limited during the verified refresh.
5. The production build still warns about the lazy 1.31 MB raw skin catalog. The startup entry is now 202.52 KB raw/54.18 KB gzip and the complete startup app/framework group is 461.73 KB raw/138.08 KB gzip; Chart.js is a separate lazy 203.04 KB raw/69.59 KB gzip chunk.
6. Playwright covers openings, exact transaction deltas, focused Work interactions, Memory Circuit completion and duplicate prevention, Precision visibility, selling/reload, image loading, every player route, console errors, and 1920×1080, 1366×768, 1280×720, and 390×844 overflow. Deeper event/Auction/cloud mechanics remain primarily unit/integration tested.
7. Nine development-only audit advisories remain in the Tailwind 3/tooling dependency tree; the production dependency audit was clean in Prompt 1. Removing them requires a breaking Tailwind 4 migration.
8. The optional tracked `CounterStrike2Skins` submodule checkout is missing in the existing worktree; generated outputs are self-sufficient.
9. Catalog images are finish-level artwork, not exact renderings of a particular seed, float, or Doppler phase. Pattern-aware surfaces state this limitation.
10. Rare-pattern premiums are documented, bounded simulator estimates rather than live cash-market appraisals.

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

### Fixed in Prompt 3

- Added immutable paint seeds in the real CS2 range (0–1000 inclusive) to the centralized item-creation path used by openings, automation/offline openings, daily rewards, Auction purchases, trade-ups, and admin grants.
- Imported paint-kit indices and phases and implemented finish/weapon-specific pattern classification rather than a universal seed table.
- Added documented Case Hardened/Heat Treated Blue Gem handling, model-specific Fade percentages, paint-kit-driven Doppler/Gamma phases and gems, and selected Marble Fade special patterns.
- Added safe pattern-aware intrinsic valuation after condition/edition pricing, with finite nonnegative bounds and no downstream market/event double-counting.
- Protected exceptional patterns from auto-sell, duplicate bulk-sale, and trade-up automation while preserving explicit manual sale with a warning.
- Added seed, category, tier, base value, premium, and final estimate UI across opening results, Inventory, Auction, trade-ups, Collection, trophies, and recent drops, plus pattern filtering/sorting and representative-image disclosure.
- Migrated saves to v29. Legacy inventory is deliberately left unseeded rather than assigned invented seeds; new pattern data round-trips through local saves and cloud merges.
- Added pattern statistics and achievement tracking plus regression coverage for generation, known/ordinary classifications, pricing, gameplay sources, persistence, protection, and exact-once behavior.
- Rebuilt batch opening presentation: single remains large, 2–3 use a showcase layout, 4–6 a balanced grid, and 7–10 a near-fullscreen dashboard. All reels animate and reveal their predetermined items, and the final overview remains open for review.
- Raised active opening/summary layers above transient notifications so mobile controls cannot be intercepted.

### Fixed in Prompt 4

- Activated optional accounts without making login mandatory and added persistent session refresh, secure logout cleanup, validated display names, avatar selection, privacy controls, and account-scoped guest/account progress.
- Removed the unsafe automatic cloud merge that could arbitrarily select money/inventory. Sync now uses a remembered baseline plus expected remote revision; genuine divergence pauses writes and shows a local-versus-cloud choice.
- Added recoverable local backups before applying a conflict choice and ensured the chosen local state is written only against the latest verified revision.
- Added owner-authorized atomic save RPC, RLS/grants, security-invoker public views, sanitized signup profile trigger, opt-in public summary/trophy tables, and no browser service-role dependency.
- Activated Leaderboards and Player Profile routes/navigation with seven ranking categories, pagination, personal ranking, local/global source labels, and explicit client-reported trust limits.
- Added public profile/trophy snapshots containing only intentionally selected fields. Raw saves, full inventory, email, and private account identifiers are not exposed.
- Connected Trophy Room sharing state to profiles and preserved seed/pattern/value identity for selected trophies, including sold/missing snapshots and legacy unseeded items.
- Fixed a reproduced localStorage quota failure by compacting autosave JSON and bounding persisted chart-only market history to 160 skins × 120 recent points. Trophy, recent-drop, last-opened, and high-value owned-skin histories are prioritized; critical inventory/economy/progression identity is not truncated. A worst-case save-size regression test keeps the compact payload below 2 MB.
- Added account, revision, privacy, identity, sorting, conflict UI, profile UI, and SQL security regression coverage plus deployment/setup documentation.

### Fixed in Prompt 5

- Changed player-facing item terminology from Seed/Paint Seed to Pattern while retaining `paintSeed` as the technically accurate serialized field.
- Added numbered, bordered multi-opening containers, aligned target markers, rarity accents, and opening-number mapping in the final summary without exposing rewards early or changing drop/economy logic.
- Reworked opening quantity controls into non-wrapping responsive buttons and widened the main case panel so neighboring content cannot squash them.
- Rebuilt Work into a responsive two-column desktop layout. Sort Boxes now has separated randomized crates/docks and touch/click/keyboard fallback; Poop Cleaning uses compact responsive targets and feedback.
- Added Precision Strike (five frame-rate-independent timing attempts) and Memory Circuit (three growing recall rounds), capped performance rewards, persistent cooldowns, exact-once claims, audio/visual feedback, and new statistics.
- Migrated saves from v29 to v30 for Work statistics without rerolling or changing item pattern identity.
- Improved the price importer with vanilla-knife normalization, compact tuples, explicit Souvenir condition data, and confidence labels. Coverage increased from 2,071 to 2,087 skins and fallbacks fell from 250 to 75.
- Moved blue-gem/fade calculator work to a reproducible build-time generator and cached decoded price records. The runtime pattern chunk fell by about 704 KB raw/321 KB gzip; the price chunk fell by about 357 KB raw/44 KB gzip.
- Added Playwright Chromium tests, visual baselines, responsive checks, and root-level GitHub Actions CI. CI installs dependencies/assets/browser, validates generated pattern data, then runs typecheck, lint, unit tests, build, E2E, and PWA verification.
- Fixed a browser-discovered tall batch-summary defect by constraining scrolling to the modal and keeping its close control reachable.

### Fixed in Prompt 6

- Replaced the long stacked Work page with four compact job cards and a focused viewport-bounded game dialog. Closing a game preserves reducer-owned cooldowns and cannot reclaim a reward.
- Kept Memory Circuit's sequence and controls together, added a deliberate dark gap between flashes (including repeated pads), blocked input during demonstration/round transitions, stabilized the game footprint, and added assertive phase feedback.
- Kept Precision Strike's target, attempts, score, legend, and controls together without active-page scrolling; compacted Sort Boxes and Poop Cleaning without changing their mechanics.
- Added shared dialog focus trapping, initial focus, Escape handling, background scroll locking, and focus restoration to opening, batch-summary, and offline-progress dialogs. Added global visible focus and reduced-motion behavior.
- Removed the nonfunctional Music and Language settings from player UI while retaining compatible serialized fields. Removed the confirmed-unused case simulation worker.
- Deferred Chart.js until a chart mounts and split stable framework/icon/virtualization/catalog/price/pattern chunks. Startup transfer fell from 623.85 KB raw/194.90 KB gzip to 461.73 KB raw/138.08 KB gzip including framework and icons.
- Added repeatable early/mid/late economy assertions and documented 100,000-opening simulations for starter, mid-price, and premium cases. No production multipliers were changed because the evidence showed bounded, loss-biased cases and capped Work/Auction/automation values.
- Expanded browser coverage to the complete Memory Circuit journey, Precision visibility, all player routes, and the 1280×720 viewport in addition to existing desktop/mobile sizes.

### Suspected or not yet proven

- Event frequency and subjective progression pacing may still need adjustment after long human playtesting even though deterministic economy bounds now pass.
- Very large saves and long-running low-end mobile sessions may reveal performance pressure.
- Real Supabase auth expiry, stale-device conflicts, public leaderboards, and public trophies may expose deployment-specific integration issues once credentials are supplied.
- A true cold offline launch with only a partially warmed image runtime cache needs broader device testing.

## 4. Development progress and history

- Git history records the initial upload plus completed Prompt 1/2 (`7790bfe`), Prompt 3 (`beb1569`), Prompt 4 (`83c3f0e`), and Prompt 5 (`81c4cde`) milestones. Prompt 6 is the current release milestone described by this status file.
- Generated reports show a major data pass dated 2026-06-28.
- There is no repository prompt archive or reliable older prompt-number completion log. Previous prompts before this six-stage roadmap cannot be reconstructed honestly.
- Stage 1 completed dependency/build/PWA/asset reliability, responsive stability, and regression coverage for the opening-session fix.
- Stage 2 completed events, simulated market events, Warehouse capacity, Auction House deals, automation/progression effect wiring, offline parity, and schema v28.
- Stage 3 completed immutable paint seeds, realistic finish-specific classifications, pattern-aware valuation/gameplay/UI, schema v29, and the adaptive fullscreen multi-case opening experience.
- Stage 4 completed accounts, revision-conflict-safe cloud architecture, privacy-controlled public profiles/trophies, active leaderboards, backend policy hardening, and local/mock verification.
- Stage 5 completed terminology/UI fixes, four polished Work jobs, price-coverage improvements, runtime data reduction, browser E2E, and clean-checkout CI.
- Stage 6 completed focused no-scroll Work games, final accessibility/dialog behavior, settings truthfulness, chart deferral and chunking, deterministic economy validation, dead-worker cleanup, expanded browser coverage, and release documentation.
- The most recent implementation work is the Prompt 6 final usability, accessibility, performance, balance, and release hardening described above.

## 5. Paint seed and valuable-pattern architecture

The Stage 3 implementation uses one item-identity and valuation pipeline:

1. `createSkinInstance` generates one integer seed from 0–1000 with the injected game PRNG, resolves the applicable finish/weapon profile, and stores the result on the instance. All normal reward paths use this function.
2. Standard and pattern-independent finishes keep a neutral 1.0× multiplier. A seed alone never creates a premium unless the exact finish and model have an applicable rule.
3. Case Hardened/Heat Treated coverage is model-specific. Curated AK-47 and Five-SeveN tiers and the documented Karambit 387 example receive named tiers; otherwise conservative measured blue-coverage thresholds are used only on supported models.
4. Fade percentages use model-specific mappings. Doppler and Gamma Doppler phases/gems come from imported paint-kit identity/phase metadata rather than pretending that the paint seed alone selects Ruby, Sapphire, Black Pearl, or Emerald.
5. Marble Fade only classifies selected model-specific special-pattern lists. Unknown combinations remain ordinary rather than receiving an invented premium.
6. Intrinsic value is the existing wear/edition-adjusted base value multiplied once by the stored pattern multiplier, then clamped to a finite nonnegative $1 billion ceiling. Simulated market and sale modifiers remain downstream.
7. Save schema v29 introduced the complete immutable pattern result; current schema v30 preserves it while adding Work statistics. Old items remain explicitly without pattern identity; loading never rerolls them. Cloud merge continues to use `instanceId` and preserves the stored fields.
8. Catalog images remain representative. The simulator never claims that the thumbnail is a seed-accurate render.

Reference links, known-seed tables, confidence labels, valuation policy, and approximation boundaries are documented in `case-opening-simulator/docs/pattern-reference-sources.md`.

## 6. Recommended next steps

The six-stage implementation roadmap is complete. Remaining work is deployment- or evidence-dependent rather than another broad feature prompt:

1. Configure a real Supabase project and perform the documented Auth/RLS/RPC, email, privacy, stale-device conflict, and physical multi-device checklist.
2. Refresh the five source-rate-limited vanilla knife records and 75 condition fallbacks when a reliable source is available.
3. Run controlled Lighthouse/low-end physical-device and long-session profiling before declaring device-specific performance numbers.
4. Collect real player pacing feedback before changing event frequency or end-game progression.

Estimate: **zero additional major Codex prompts** for the planned simulator. Expect one focused deployment/credentials prompt and optional later content/balance patches.

## 7. Overall completion estimate

| Area | Estimate | Basis |
| --- | ---: | --- |
| Core gameplay | **99%** | Main loops, patterns, events, automation, offline, exact-once transactions, focused Work flows, and repeatable economy bounds pass; subjective pacing remains. |
| Skin/case data | **98%** | Full catalog/assets and imported paint metadata; only five source-matched skins and 75 condition slots retain fallbacks, while conservative pattern estimates remain intentional. |
| Inventory and economy | **99%** | Capacity, selling protection, Auction, pattern/event/automation/Work modifiers, persistence, exact accounting, and deterministic early/mid/late bounds pass; human pacing remains. |
| Cloud and social | **90%** | Account/sync/conflict/profile/trophy/leaderboard code and local/mock tests work; real Supabase deployment and cross-device proof are blocked on credentials. |
| UI and animations | **99%** | Responsive focused Work games, dialog focus/Escape behavior, reduced motion, non-wrapping controls, and separated adaptive 1/2/3/5/10-case animation/reveal layouts are browser-tested. |
| Overall project | **99%** | The six-stage feature and release roadmap is complete, reproducibly buildable, and browser-tested; credential-dependent live cloud proof and controlled physical-device profiling remain. |

## Verification snapshot

- TypeScript (`npm run typecheck` and the build's `tsc -b`): pass.
- Targeted Prompt 6 Work/dialog/chart/economy tests: pass — 6 files, 35 tests during development.
- `npm test`: pass — 66 files, 335 tests. Playwright specs are explicitly excluded from Vitest discovery.
- `npm run lint`: pass — zero errors or warnings.
- `npm run build`: pass — 2,134 assets (197.4 MiB) verified; TypeScript and Vite pass; PWA generates 78 precache entries (4,178.38 KiB) plus `sw.js` and Workbox output.
- `npm run verify:release`: pass with exit code 0 — lint, all 335 unit tests, asset verification, TypeScript, Vite/PWA build, and release checks completed successfully.
- `npx playwright test`: pass — 10 Chromium tests. Verified 1/2/3/5/10 openings, exact inventory/case/balance deltas, focused Memory Circuit completion and duplicate protection, Precision visibility, Work rewards/cooldowns, image loading, selling/reload persistence, all player-route console errors, and no horizontal overflow at 1920×1080, 1366×768, 1280×720, or 390×844. Checked-in baselines cover the opening controls, Work desktop layout, and mobile main content.
- Local/mock behavior verified by automation: registration/login/logout/reset response, display-name validation/uniqueness, account-scoped guest and account saves, stale revision rejection, explicit conflict UI/actions, privacy filtering, leaderboard sorting, trophy pattern identity, corrupted/network failure handling, and SQL security invariants.
- Browser account/social verification: pass for guest profile, Settings account/privacy UI, active seven-category Leaderboards, Trophy Room sharing status/link, profile/trophy empty states, and navigation. At 390×844, Profile and Trophy Room had no horizontal overflow; desktop was rechecked at 1366×768.
- Autosave quota reproduction and fix: pass. Before the fix the live browser logged `QuotaExceededError`; the corrected manual export was about 459 KB, subsequent autosave/reload succeeded, and no new browser warnings/errors appeared.
- Real Supabase verification: **blocked** — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` were not configured. No deployed signup/email/reset, RLS/RPC, or physical multi-device claims are made.
- Production dependency audit: pass — zero vulnerabilities. Full audit still reports nine development-only Tailwind 3/gh-pages transitive advisories (two moderate, seven high); the available automatic fix requires a breaking Tailwind 4 change and was not forced.
- The remaining large-chunk warning is the lazy 1.31 MB raw/114.27 KB gzip skin catalog. The entry is 202.52 KB raw/54.18 KB gzip; complete startup app/framework is 461.73 KB raw/138.08 KB gzip. Measured budgets are in `case-opening-simulator/docs/performance-budget.md`.
- Native computer-use attachment was unavailable because the trusted RPC service was not configured; actual UI verification ran in the checked-in Playwright Chromium suite. No real Supabase credentials were available.
- Local development server is left running at `http://127.0.0.1:5173/`.
