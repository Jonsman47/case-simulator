# Tutorial, Notifications, Help and Trade-Up Redesign

Implementation date: 2026-11-17
Save schema: v41

## Notification policy

`src/notifications/notificationSelectors.ts` is the single counting authority. Components never persist badge totals. Selectors derive stable event identities from authoritative state, deduplicate identities at parent navigation groups and expose four meanings:

- `claimable`: achievement rewards, quest stages and completed acquisitions; cleared only by the authoritative claim action.
- `action`: employee trade-up approvals, incoming listing offers and open negotiations; cleared only when resolved.
- `new`: Market Scout alerts, newly unlocked Career nodes and unread Drop Journal records; cleared when reviewed or acknowledged.
- `acknowledgement`: current Prestige eligibility; the eligibility fingerprint is acknowledged on the Prestige screen and changes when the run/tier/score state materially changes.

Desktop dropdowns, group tabs, mobile navigation and screen-reader labels use the same selectors. Counts above 99 display `99+`. Business alerts use their stable alert/listing/approval IDs, so a single event is never counted twice.

Persisted notification metadata is bounded to acknowledged upgrade IDs, the latest 160 read Drop Journal entry IDs and one Prestige eligibility fingerprint. Achievement, quest, Business and CSWEAR totals are always derived.

## Beginner tutorial

The previous eight-page text tour is replaced by 13 real-action steps:

1. Welcome.
2. Cases navigation.
3. Affordable starter case.
4. Open 1 with cost explanation.
5. Wait for the actual finished reveal.
6. Rarity, wear, float and Pattern.
7. Inventory navigation.
8. Inspect the exact item.
9. Collection Book.
10. Quests and tracking.
11. Work and cash recovery.
12. Instant sale versus CSWEAR escrow without forcing a sale.
13. Career XP and the next objective.

The anchored panel has no full-screen click-capturing backdrop. Its spotlight is pointer-transparent, so the real target remains usable. Navigation and DOM/state predicates advance action steps; the opening step records a cases-opened baseline and the next step waits until the actual result content is revealed. Back, pause/resume, skip and replay are persistent. Missing targets show recovery guidance and never remove navigation controls. The tutorial performs no economic action itself.

## Contextual feature guides

A single priority queue introduces CSWEAR, Trade-Ups, Career, pre-hire Business, post-hire setup, Market Scout, Quests, Prestige and Drop Journal. Only one guide is visible. Guides are dismissed by stable ID, can be replayed from Settings/Help, and do not appear over a pending trade-up reveal. Destructive Prestige and item-consumption actions remain outside guide controls.

Passive guide surfaces use pointer pass-through; only their own Dismiss, Open feature and Help Center controls capture input. They therefore cannot cover and disable an underlying market, inventory or gameplay action.

## Help Center

`/help` contains 13 searchable categories with practical examples and deep links. It accurately documents independent official case odds, negative ordinary case EV/no pity, permanent float/Pattern identity, discovery versus ownership, CSWEAR fees and escrow, realized versus unrealized profit, trade-up opportunity cost and irreversible consumption, Career XP, employees, exact Prestige reset/preservation behavior, and save recovery. It contains no Case Farm, old Skill Tree or retired upgrade-point guidance.

## Trade-Up workbench

The `/trade-ups` route continues to use `analyzeTradeUp` and the existing `TRADE_UP` reducer action. The redesign adds:

- 10 ordinary or 5 Covert visual input slots with exact thumbnails, float and value.
- Rarity, name/weapon/collection/Pattern, collection, wear, float and price filters.
- Explicit protection/ineligibility reasons for locked, favorited, exceptional-Pattern or invalid-rarity items.
- Honest input opportunity cost, EV, expected P/L and ROI, worst/best output, exact probabilities and predicted wear/float.
- An irreversible review step before `Execute Trade-Up`; no outcome is sampled by UI code.
- The existing acquisition reveal, which displays the authoritative output and supports reduced motion/skip behavior.
- A 24-entry bounded persistent history containing real input IDs/value, exact output instance/value and actual profit/loss. No history is fabricated during migration.

## Density and accessibility

The application uses `data-ui-density="compact"` plus CSS tokens instead of browser zoom or a whole-app transform. At widths of 640 px and above, common 24–32 px panel padding becomes 14–20 px, 20–24 px structural gaps become 16 px, large section margins become 12–16 px, oversized headings step down one scale, and desktop controls use a 36 px compact minimum. Mobile keeps its existing touch sizes. Large Text opts out of density overrides. Light Mode tokens, visible focus, reduced motion, horizontal reflow and modal viewport bounds remain intact.

## Persistence and migration

v40 → v41 adds only bounded UI metadata and trade-up presentation history. Existing money, inventory instances, Pattern, float, cost basis, Career, quests, journal, Business, Prestige, Legacy Vault, achievements, marketplace escrow and cloud lineage are untouched. Players who had dismissed/completed the old tutorial stay completed; no player is forced through the new tutorial. Old trade-up history is not reconstructed.

## Focus priority

Authoritative opening/reward dialogs and trade-up acquisition reveals remain above passive feature guidance. The beginner tutorial is the only tutorial surface while active. Feature guides are queued one at a time. Badges never open dialogs automatically.

## Verification

Unit tests cover selector counts/deduplication, accessibility labels, tutorial persistence/pause/dismissal, Help search/replay, v40 migration, exact trade-up history and existing trade-up probability/float/item-safety behavior. The 504-test release suite, lint, TypeScript, production/PWA build and 2,134-asset release verifier pass. Playwright passed 35/35 serial Chromium journeys in 5.9 minutes, covering the real beginner opening flow, pre/post-hire Business guides, achievement and quest badge clearing, a ten-item authoritative Trade-Up with reveal and reload, Help search, route-wide console/overflow checks, Light/Large Text and seven responsive viewports. Career and early-game simulations pass without changing any economy formula.

Density measurements at the stable 1366 px visual baseline show the Cases main content reducing from 865 px to 783 px (9.5% less vertical content height) and the already-compact Work overview from 668 px to 656 px (1.8%). Token-level desktop panel padding reductions range from 20% to 37.5%, with 24 px structural gaps reduced to 16 px. Actual page reduction varies with fixed content and is not claimed as a universal physical 25% scale.
