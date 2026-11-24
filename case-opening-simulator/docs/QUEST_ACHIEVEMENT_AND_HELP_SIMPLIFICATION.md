# Quest, achievement, and contextual Help simplification

Updated: 2026-11-24. Usability overhaul Prompt 3 of 4.

## Quests

The player-facing page is **Quests & Collection Hunts** with Current Quests, Collection Hunts, and Completed & Journal tabs. Character portraits, meetings, individual reputation, rival scores, and dialogue are no longer shown. All 36 quest IDs, stage IDs, tracked IDs, completed stages, claim history, Career XP values, cash, Case Opening Funds, cosmetics, and Drop Journal records remain intact. The old NPC save fields are still parsed for older local and cloud saves but no longer grant rewards or advance on player actions. The old dialogue action is inert.

Two character-dependent requirements were replaced at their stable stage IDs: Rook's rival comparison is now five and twelve Current Run discoveries; Kade's reputation stage now requires five completed Trade-Ups. A case tour stage now checks five *different* case types, matching its wording. The Curator rifle stage now says one AK-47 and one M4 skin, matching its two actual predicates. Existing completed stages stay completed and claim requests remain exact-once. An older `?tab=characters` link safely opens Current Quests.

The verbs on quest cards and Help mean different things: **open** receives a case result, **discover** adds a permanent distinct Collection Book entry, **own** checks present inventory, and **deliver** consumes one selected eligible item. Related-case links open the actual case. Daily objectives remain on Rewards.

## Case Opening Funds

This is a display name for the existing `dailyRewards.openingCredits` balance, not a new currency. Case buttons show the cash due for each quantity. The payment breakdown uses `getOpeningCreditQuote` for full opening cost, funds applied, and wallet cash due. Home, quest rewards, daily rewards, and the beginner tutorial use plain wording. The existing rules remain: cases cost at most $5 to qualify; funds cover at most 35% and $1.25 per case, with a $20 balance limit. Funds cannot be spent on skins, licenses, or other items. The opening reducer still commits one authoritative transaction.

## Achievement audit

The catalog contains **151 stable definitions: 129 active and 22 retired**. Every active definition now provides an explicit target and progress selector. The audit covered catalog IDs, source state, scope, reward, claim path, and reset behavior. Existing completed and claimed records retain their IDs and claims.

The six `money_earned_*` milestones said they counted item sales while actually reading mixed `statistics.moneyEarned`, which includes Work and quest cash. They now read persistent `statistics.itemSaleRevenue`. The counter increases only on genuine auto-sales, instant sales, bulk sales, and settled CSWEAR sales, using cash proceeds after marketplace fees. Work, quest rewards, opening funds, purchases, and budget transfers do not increase it. This is **sale revenue**, not realized profit; separate achievements continue to use ledger-backed realized profit. The once-claimable achievement rewards retain the prior cash conversion for legacy Upgrade and Skill Points, and the UI labels that conversion explicitly.

The hidden broke-run recovery definition previously completed from having $5 after any opening, without evidence of a broke state. It is retired for new unlocks; historical completed/claimed records remain. The $100 item milestone now says acquisition, including market purchases, matching its selector. Numeric opening, spending, inventory, Trade-Up, Prestige, discovery, and rarity milestones now show their real numerator instead of zero until completion. Binary achievements show 0/1 until their actual predicate is true.

The sale-revenue metric and permanent achievement counter archive require save schema **v43**. The v42 → v43 migration sets a conservative zero sale baseline because the bounded transaction history cannot reconstruct exact lifetime sales from mixed earnings. It initializes archived opening, spending, Trade-Up, auction, and rarity-drop counts to zero; the current run's existing statistics remain in place. On each later Prestige, these run counts move into the archive before run statistics reset, so unearned permanent milestones can progress across chapters. Earlier completed and claimed achievements remain completed and claimed. New sales accumulate permanently, including across Prestige. No money, items, XP, quest rewards, marketplace fees, odds, or Prestige formulas change.

## Contextual Help

The glossary has 26 terms covering Float, Pattern/Paint Seed, StatTrak, rarity tiers, Trade-Up, EV, ROI, escrow, Prestige, Case Opening Funds, wear, market value, realized profit, unrealized value, cost basis, pattern premium, payroll, operating budget, collection discovery, and case odds. The short definition appears on hover, keyboard focus, or tap. More details reveals technical context. Escape closes the popover; the Help Center link opens the matching glossary entry. Popovers use the real trigger rectangle, viewport clamping, scroll/resize updates, and a resize observer. Reduced motion requires no special animation because these popovers have none.

Glossary entry points appear at Cases, Inventory, item inspection, Trade-Ups, CSWEAR, Business, Prestige, and Quests. The existing Help Center retains its articles and tutorial replay, removes the character article, and adds standalone quest semantics, Case Opening Funds, corrected selling milestones, and the searchable glossary. No tooltip opens automatically during gameplay.

## Compatibility and verification

The save migration preserves old character data, all achievement claim records, item IDs, cloud revision metadata, tutorial state, unlock state, and the current economy ledger. Older deep links to the retired tab land on Current Quests. The first-session guide still uses its twelve existing steps and real opening result events.

Local verification passed: standalone TypeScript, ESLint, 94 Vitest files / **539 tests**, production/PWA build, `verify:release`, all **62 Chromium journeys**, and the deterministic Career plus six-playstyle early-game simulation (300,000 careers, 500,000 openings, 95 upgrade rows, 45 employee rows). Browser coverage includes a legacy character save with quest claim/reload, the displayed funds quote against a real opening, Work excluded from sale revenue, glossary hover/focus/tap and Help links, first-opening tutorial, Prestige recovery, every route, Light Mode, Large Text, and desktop-to-mobile geometry. The inspected 390 px Work snapshot was refreshed for text rasterization; content and card geometry were unchanged. No screenshots were taken outside the failing visual comparison. GitHub [CI run 45436654721](https://github.com/Jonsman47/case-simulator/actions/runs/45436654721) passed for implementation commit `1f19728`, including 62 Linux browser journeys. **Prompt 3 is complete.**

Known legacy limit: v42 saves do not contain a trustworthy lifetime item-sale subtotal or earlier Prestige archive. The v43 migration starts these new counters at zero rather than inferring exact totals from bounded history. Already earned and claimed achievements remain intact. New transactions and future Prestige runs are tracked accurately. Prompt 4 remains reserved for notification behavior, small animations, and final first-session testing.
