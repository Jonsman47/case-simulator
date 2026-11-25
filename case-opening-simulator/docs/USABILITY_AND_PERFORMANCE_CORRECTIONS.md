# Usability and performance corrections

Updated: 2026-11-25. Save schema remains v43.

## Tutorial

The first single-case reveal now stays open while the beginner guide explains it. The actual committed item remains in the existing result dialog; the guide closes the result only when the player continues. The normal non-tutorial and multi-open lifecycles remain automatic. Item inspection now teaches the real name, rarity, wear/Float, Pattern, and estimated value fields in five short spotlight lessons. The item modal is undimmed during the lesson. Back, Next, and Skip Inspection leave the authoritative opening untouched. Quests now receive an actual card, progress, reward, and tracking lesson before Work. The closing message links directly to Help. Main-step persistence and completed legacy tutorials remain unchanged; a reload of a sublesson resumes the main inspection or quest step.

## Home, Help, Career, and About

Home now leads with the actual selected case and image, quote, wallet, and Continue Opening action. Its compact Career strip, next unlock, real tracked goals, claim shortcuts, recent persisted activity, and eight activity tiles use live state. Locked Quests point the starter opening goal to Cases until Quests become available. The fresh-save activity area is an honest empty state.

Help now shows one of 14 searchable topics at a time, with beginner summary, example, actions, common mistake, optional technical detail, feature link, relevant real case/skin imagery or a step diagram. It retains beginner and feature-guide replay and supports `?topic=` and `?term=` deep links. Career starts with level, rank, next level/rank, and affordable upgrade count; five paths show their benefits; the explorer defaults to available nodes with Affordable, Owned, Locked, and All filters. All 95 upgrade definitions and effects remain. Advanced Career details are collapsed until requested. The Credits/About page identifies Jonsman, describes simulated play, links existing asset and pattern provenance, and keeps the unofficial-project notice.

The reusable `GlossaryText` component applies explicit mappings to selected text. Existing `GlossaryTerm` integration remains in Cases, Inventory, item inspection, Trade-Ups, CSWEAR, Business, Prestige, and Quests. New context appears in Home, Career, Achievements, and Work. The catalog adds Achievement, Career XP, Specialization, and Souvenir. Terms use the existing hover, keyboard, touch, More Details, and Help-link behavior. Navigation links themselves are not wrapped with nested tooltip buttons, preserving valid link interaction.

## Case Opening Funds

For manual case openings, the authoritative quote now uses `min(available funds, total case-opening cost)` before wallet cash. The existing $20 restricted-balance cap and reward amounts are unchanged. Funds cannot buy skins, licenses, upgrades, employees, or other products. The full quoted case/key cost, funds used, and cash paid are shown at the opening controls. Existing balances carry forward with no migration or conversion. Statistics and ledger cash spent record actual wallet spending; item generation, XP, odds, and prices are unchanged. Duplicate opening event IDs are ignored before a second reducer transaction. Automated opening systems continue using their established wallet or employee operating-budget controls; they do not draw from the player's Opening Funds balance.

## Trade-Ups

Each fresh workbench visit starts at All rarities, ignoring the old persisted rarity key. An explicit in-page rarity selection still works until the player clears the contract or leaves the page. The existing authoritative eligibility, rarity-first/value-second sorting, edition matching, and quick-fill logic remain.

## Performance investigation

The repeatable `scripts/benchmarkUx.mjs` uses Chromium 156 at 1366×768 and 100% zoom. It waits for real route content, then records cold route wall time, long tasks, DOM nodes, resource count, in-app Career/Help navigation, CSWEAR listing entry, 1/10-case frame intervals, synchronous save duration, and a synthetic 400-item Inventory load. The synthetic dataset is isolated in a temporary browser profile and never saved to the player's game. Development and production builds were measured separately. Browser CPU contention makes one-run frame estimates noisy, so these numbers describe the test machine, not a universal FPS guarantee.

The confirmed opening cost is the large reel tree: ten lanes previously prepared roughly 600 cards and their images. Reel layout now mounts 350 cards for a ten-open, while retaining each target and a 12-card tail in every lane. The tutorial's DOM-change observer now coalesces updates to one animation frame. Career calculates upgrade status once per state change, and Help mounts one article instead of the old wall. Synchronous local save writes were 1–2 ms in the measured small-save opening, so they were not changed.

### Browser evidence

The six limited before/after screenshots are in `docs/ux-screenshots/`. At 1366×768, full-page image heights changed from Home 768→917 px, Help 2800→799 px, and Career 2406→959 px. Home uses 149 px more vertical space to show the case and real activity tiles; Help and Career remove long walls of content. The redesigned pages had no measured horizontal overflow. Route and frame data are in `docs/ux-perf-before-prod.json`, `docs/ux-perf-after-prod.json`, and `docs/ux-perf-after-dev.json`.

The one-run production Home route was 1362→805 ms, Help DOM nodes 750→392, and Career DOM nodes 753→451. The previous route script sampled after a fixed delay; the final script waits for real content, so route wall times are **not directly comparable**. The final production build measured 398 ms for in-app Career navigation, 45 ms for Help, and 676 ms to open a CSWEAR listing. Development measured 549, 119, and 1195 ms respectively on the same machine. Large Inventory remained virtualized at 831 DOM nodes and loaded in 748 ms in the production run.

The ten-open frame p95 was 83→167 ms in one baseline/final headless run, even after the reel-card reduction to 350. This does **not** establish a frame-pacing improvement; further device profiling is needed if players still see stutter. The previous baseline did not wait for unlocked CSWEAR content, so it has no comparable listing-entry measurement. These are single runs, not controlled repetitions or a universal speed claim.

## Save and economy safety

No save schema bump is needed because the quote and new tutorial sublessons add no persistent fields. Existing items, claims, progression, cloud lineage, and saved tutorial main step are unchanged. The existing funds balance cap, rewards, Prestige reset, and operator budgets remain. The funds change can make an opening affordable sooner when a restricted balance is available; it does not change the total funds awarded. The six-playstyle early-game model now calls the real quote function rather than retaining the retired 35%/$1.25 rule. In 500 deterministic runs per style, the two-hour checkpoints remained close to the prior documented baseline: fresh beginners averaged 59.96 openings and $50.01 cash (previously 59.96 and about $50), opening-focused 70.66 and $10.83 (previously 70.66 and $10.83), and all six profiles had no bankruptcy majority or repeated reward. The 300,000-career/500,000-opening simulation passed with its unchanged formulas. This simplified model is useful for pacing comparisons but does not reproduce every player decision or live-case cost.

## Verification and limits

The local run passed 550 Vitest tests in 97 files, all 69 Chromium journeys, standalone TypeScript, ESLint, production/PWA build, release verification, and the Career plus six-playstyle simulations. GitHub CI status is recorded in `PROJECT_STATUS.md` after the remote run completes. The attached request supplied text but no image files, so baseline screenshots were captured from the previous local production build. The six screenshots cover the three major redesigned pages at one desktop viewport; responsive behavior is checked separately in Playwright. A human playtest is still needed to judge whether Home feels compelling and whether animation smoothness improves on the player's device.
