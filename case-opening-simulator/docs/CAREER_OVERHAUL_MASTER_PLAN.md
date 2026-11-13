# CS2 Trading Career Overhaul — Master Plan

Status: authoritative design reference for Career Overhaul Prompts 1–8
Created: 2026-11-11
Implementation baseline: save schema v35 (Career Overhaul Prompt 2)

This document defines the intended career economy. It supersedes conflicting progression proposals, but it does not claim that provisional numbers are balanced before the simulations listed in section 21 pass. Existing CS2 case odds, item identity, paint seeds, pattern premiums, inventory, marketplace state, and cloud compatibility remain authoritative.

## 1. Product vision and non-negotiable rules

The player begins with $100 as a broke case-opening enthusiast and becomes a trader, collector, contract specialist, employer, and market mogul. Major career progression should occupy roughly 500–800 engaged hours, but progress must come from decisions and execution rather than hard waiting.

Five viable strategies must coexist:

1. Opening and collecting: exciting but ordinarily negative EV, supported by collection goals rather than fake positive odds.
2. Trading and market flipping: the primary repeatable profit path, with spreads, uncertainty, fees, capital risk, and manual confirmation for exceptional items.
3. Pattern hunting: knowledge-intensive and potentially high value, never a universal seed multiplier.
4. Trade-up contracts: honest opportunity-cost analysis and real downside.
5. Business operations: employees remove repetition but consume wages, budgets, time, and inventory capacity.

Hard rules:

- Official case rarity probabilities and float distributions are not improved by career upgrades.
- Rare patterns remain rare and use the existing finish/weapon-specific valuation engine.
- Employees never create cash without an underlying opening, sale, trade-up, or market transaction.
- Negotiation and exceptional-item purchases remain manual.
- No system guarantees profitable trade-ups or risk-free renewable arbitrage.
- Every cash or owned-item mutation is represented by the v34 economy ledger.

## 2. Core career gameplay loop

```text
earn seed capital through Work or sales
  -> research cases, items, prices, floats, and Patterns
  -> choose an activity: open, trade, collect, or contract
  -> commit cash/items through an exact-once transaction
  -> realize a profit/loss or increase collection value
  -> earn bounded Career XP for meaningful outcomes
  -> unlock ranks, capabilities, employees, and specialization upgrades
  -> build a trading business with recurring operating costs
  -> meet a major career milestone and prestige
  -> preserve only documented legacy progress, then begin a harder run
```

Automation may execute a configured routine, but discovery, risk limits, exceptional acquisitions, negotiation, and major capital allocation stay with the player.

## 3. Career ranks and pacing targets

Ranks are capability gates, not timers. The hour ranges are telemetry targets for a median engaged player.

| Rank | Target hours | Minimum level | Primary capability |
| --- | ---: | ---: | --- |
| Case Addict | 0–25 | 1 | cases, inventory, Work, basic sales |
| Independent Trader | 25–100 | 15 | CSWEAR research, basic listings, Case Operator |
| Professional Trader | 100–250 | 35 | Market Scout, advanced contracts, analytics |
| Business Owner | 250–450 | 55 | employees, budgets, training, operating costs |
| Market Mogul | 450–650 | 75 | multi-employee operation, large capital tools |
| CS2 Trading Legend | 650–800 | 100 | final prestige milestones and legacy cosmetics |

Provisional XP level requirement:

`XP_to_reach_level(L) = round(1,000 × (L - 1)^1.72 + 2,500 × max(0, L - 25)^1.28)`

Examples:

- Level 10: about 43,800 cumulative XP.
- Level 25: about 236,600 cumulative XP.
- Level 50: about 961,400 cumulative XP.
- Level 75: about 2,014,700 cumulative XP.
- Level 100: about 3,335,100 cumulative XP.

These constants are **provisional**. Prompt 5 must fit telemetry-derived XP/hour curves to the target bands; levels must not be padded with forced idle time.

## 4. Career XP sources and anti-farming

XP rewards meaningful economic activity, not action count alone.

### 4.1 Proposed formulas

- Case discovery XP: `12 + 8 × rarityIndex + min(40, log2(max(1, itemValue)) × 3)`, paid only for the first 20 openings per rolling hour at full rate; subsequent identical low-value opens decay to 20%.
- Realized trade XP: `20 + 12 × ln(1 + max(0, realizedProfit))`, capped at 300 per transaction. A loss still gives 10 research XP, at most five times/hour.
- Collection discovery XP: `25 × rarityWeight × discoveryNovelty`, only for new All Time or Current Run discoveries as appropriate.
- Trade-up XP: `30 + 10 × inputRarityIndex`, once per distinct contract signature per six hours at full value; repeated signatures decay.
- Work XP: `15–45 × performance`, subject to persisted cooldowns.
- Business XP: `8 × ln(1 + legitimateEmployeeGrossVolume)`, settled in hourly batches after wages and transaction completion.
- Achievement XP: fixed milestone awards, never repeatable.

### 4.2 Anti-farming policy

- XP is recorded by deterministic ledger transaction/event IDs and cannot be claimed twice.
- Gross volume alone does not award trading XP; realized outcomes and novelty do.
- Buying and reselling between player-owned surfaces cannot create XP.
- Cancelled listings, escrow moves, admin money, save imports, and price revaluations award no XP.
- Repeated low-value actions use a per-source diminishing multiplier:
  `multiplier = max(0.2, 1 / (1 + 0.12 × max(0, countInWindow - softCap)))`.
- Exceptional Pattern XP requires a stored classification and is awarded only once per item instance.
- Offline XP is computed from completed economic transactions, not simulated clicks.

## 5. Principal resources

### Cash

Cash funds cases, listings, purchases, wages, employee budgets, facilities, fees, and upgrades. Cash flow is not profit. The ledger distinguishes income, expenses, cost basis, realized trading profit, inventory value, and economic net worth.

### Career XP

Career XP unlocks ranks and capability prerequisites. It is run-based by default and resets on prestige, with a permanent rank-speed perk possible only in the Prestige tree.

### Prestige Points

Prestige Points fund permanent perks. They come from completed career runs, not achievements alone. Achievement rewards may include small PP grants only for unique lifetime milestones.

The transitional Upgrade Points and Skill Points remain until their Prompt 4 migration. Prompt 1 preserves unspent Upgrade Points on prestige to prevent the existing one-time-achievement softlock.

## 6. Employee roles

### Case Operator

- Executes player-selected cases within a per-shift cash budget, inventory reserve, and stop-loss.
- Uses unchanged case odds and costs.
- Pauses on insufficient funds/capacity or protected reward rules.
- Never chooses cases based on a hidden future result.

### Sales Assistant

- Applies duplicate rules, prepares routine CSWEAR listings, and instant-sells only within configured quote floors.
- Never sells locked, favorite, trophy, Legacy Vault, exceptional Pattern, or user-protected items.
- Listing prices must be bounded relative to credible fair value unless the player manually overrides them.

### Market Scout

- Searches the deterministic CSWEAR population for player-defined weapon/finish, wear, float, Pattern, confidence, price, and discount criteria.
- Creates notifications/watchlist candidates; it does not purchase.
- Scan coverage and frequency improve with training, but zero-supply rare variants remain possible.

### Trade-Up Specialist

- Executes only ordinary contracts that meet player-defined maximum input value, minimum honest EV, allowed collections, and protected-item rules.
- Uses actual consumed value as opportunity cost.
- Covert/special-output contracts require manual confirmation initially; later automation may only be unlocked behind an explicit risk policy.

### Junior Trader

- Buys small, ordinary listings under a player budget and credible discount threshold.
- Cannot negotiate, buy exceptional Patterns, exceed per-item/per-day limits, or use low-confidence valuations.
- Has execution risk: a configured bargain can still lose value before resale.

## 7. Employee acquisition, training, wages, and budgets

Employees are purchased once per run and paid recurring wages. Proposed formulas:

- Hire cost at employee tier `T`: `round(2,500 × 2.15^(T-1))`.
- Training level `L` cost: `round(1,200 × employeeRoleFactor × 1.85^L)`.
- Hourly wage: `round(25 × employeeRoleFactor × (1 + 0.32 × L)^1.35)`.
- Role factors: Case Operator 1.0, Sales Assistant 1.15, Market Scout 1.35, Trade-Up Specialist 1.6, Junior Trader 1.8.
- Per-shift operating budget is escrowed from cash; unused budget returns exactly once.
- Payroll is settled in bounded hourly ledger batches, including offline time up to the global offline cap.
- If payroll cannot be met, the employee pauses; debt is not silently created.

Example: a level-5 Market Scout costs approximately `$1,200 × 1.35 × 1.85^4 = $19,080` for the next training step and earns about `$25 × 1.35 × (1 + 0.32×5)^1.35 = $123/hour`.

All numbers are provisional pending early/mid/late capital simulations.

## 8. Scheduling and offline behavior

- One scheduler owns online and offline employee execution.
- Jobs use `nextRunAt` timestamps; elapsed time generates bounded due runs rather than ticking each second.
- Offline processing cap remains 24 hours initially.
- Per-employee offline action caps prevent unbounded CPU and save growth.
- Time-limited events are evaluated at each simulated transaction timestamp, not at login time.
- Inventory capacity, cash budget, listing expiry, protection rules, and market availability use the same functions online and offline.
- Employee cash/item mutations pass through exact-once request IDs and the economy ledger.
- Notifications may aggregate offline results, but item identities and individual acquisition costs remain stored.

## 9. Cash sources and sinks

Legitimate sources:

- Work rewards.
- Skin sales and CSWEAR marketplace sales.
- Profitable trade-ups after actual input opportunity cost.
- Daily/achievement milestone rewards.
- Transitional Case Farm until Prompt 3 replaces it.

Required sinks:

- Case/opening costs and licenses.
- CSWEAR and Auction purchases.
- Upgrade, facility, employee hire, and training costs.
- Wages and operating budgets.
- Listing fees and sale fees introduced conservatively in Prompt 3.
- Research reports/watchlist capacity.
- Prestige preparation and Legacy Vault slots.

No sink may delete inventory silently. Failed or cancelled purchases refund reserved cash exactly once.

## 10. Upgrade architecture (80–110 upgrades)

Target: 95 meaningful nodes, split approximately as follows:

| Specialization | Nodes | Distinct purpose |
| --- | ---: | --- |
| Case Opening | 16–20 | UI throughput, budgeting, collection research; no odds/float magic |
| Trading | 20–24 | valuation confidence, listing tools, fees, watchlists, negotiation information |
| Collecting | 14–18 | discovery tools, showcases, protection, vault access, catalog analytics |
| Trade-Ups | 16–20 | analysis, contract templates, risk bounds, Specialist automation |
| Business | 20–24 | employees, facilities, schedules, budgets, capacity, reporting |

Duplicated generic “sell value,” “speed,” and “luck” tracks should be retired through a migration, not stacked again.

### Cost scaling

Within a node with level `L`:

`cashCost = round(baseCash × 1.72^L × rankMultiplier)`

`xpRequirement = baseLevel + branchDepth × 3 + L × 2`

Cross-branch keystones may cost a non-refundable specialization token earned every 10 career levels. Tokens are ordering constraints, not monetized currency.

Example: a $5,000 Trading node with three paid levels costs $5,000, $8,600, and $14,792. Its fourth level, if present, costs $25,442. Costs must be compared with the cash curve in Prompt 5.

## 11. Prestige eligibility

Prestige is a demonstrated career milestone, not a single spam counter. Proposed eligibility score:

`CareerScore = 0.30×levelScore + 0.25×netWorthScore + 0.20×realizedProfitScore + 0.15×businessScore + 0.10×discoveryScore`

Each component is normalized to 0–100 against the current prestige tier target. Eligibility requires:

- Career level at or above the tier gate.
- CareerScore at least 85.
- Positive realized trading profit for tiers 2+.
- No unresolved escrow/cloud conflict.
- A manual confirmation screen listing every reset and preserved asset.

Provisional tier targets grow by `target(tier) = base × 3.2^(tier-1)` for economic measures and +10 levels per early tier, flattening near level 100.

## 12. Prestige Point calculation

Proposed award:

`PP = floor(2 + 1.8×tier + 3×sqrt(max(0, CareerScore-80)/20) + ln(1 + realizedProfit/targetProfit))`

Then apply only explicitly documented permanent PP-yield perks, capped at +25%:

`finalPP = floor(PP × min(1.25, permanentYieldMultiplier))`

Example: tier 3, CareerScore 92, realized profit twice the target:

`floor(2 + 5.4 + 3×sqrt(0.6) + ln(3)) = floor(10.82) = 10 PP`.

Parameters are provisional and require at least 10,000 simulated careers per archetype.

## 13. Prestige reset and preservation policy

Reset on prestige:

- ordinary cash and run inventory;
- current Career XP/level;
- employees, wages, budgets, and facilities;
- run upgrades and licenses;
- run achievements/challenges, events, and automation queues;
- Current Run Collection Book;
- run ledger totals after archiving a summary.

Preserve:

- prestige level, Prestige Points, and permanent prestige perks;
- lifetime achievements, career records, and titles;
- All Time collection discoveries;
- selected Legacy Vault items within the vault limit;
- cosmetic unlocks and settings;
- authoritative lifetime ledger aggregates and bounded archived run summaries.

The confirmation flow must never silently delete a valuable item. Migration from the existing system initially grandfathers current inventory until the player performs a new-system prestige and explicitly selects Vault items.

## 14. Legacy Vault

- Base capacity: 1 item; maximum planned capacity: 8.
- Only owned, non-escrow items can enter.
- Vault selection happens before prestige and is shown in the reset confirmation.
- Vault items retain instance ID, float, wear, paint seed, Pattern, edition, acquisition history, favorite/lock state, and cost basis.
- Vault items cannot be used as working capital during the next run until a rank-based release gate, preventing reset-value exploits.
- Removing an item from the Vault is permanent for that run; replacing it requires the next prestige.
- Vault slots are permanent Prestige upgrades and never paid with ordinary cash.

## 15. All Time and Current Run Collection Book

Architecture:

- `lifetimeDiscoveries`: permanent per-skin/per-wear/per-special-Pattern discovery records.
- `runDiscoveries`: the same normalized keys plus `runId` and first discovery timestamp.
- `discoveryKey = skinId + edition + wear + normalizedPatternClass`; numeric paint seed is stored on the item but is not 1,001 separate collection slots.
- The UI switch selects All Time or Current Run without duplicating catalog data.
- Prestige archives a compact run summary and clears only `runDiscoveries`.
- Save migration derives All Time from the existing collection book and marks Current Run history as incomplete; it does not invent pre-migration run boundaries.

## 16. Economy assumptions

- Ordinary case EV remains negative based on real odds and current price data.
- Instant sale is a bid-side liquidation quote capped below fair market value.
- Sell progression closes a diminishing part of the spread; it does not multiply fair value.
- Market fair value already includes wear, edition, float, and Pattern evidence. Premiums are not applied twice.
- A CSWEAR listing can be profitable but faces time, fee, and demand risk.
- Employee ROI includes hire cost, wages, fees, idle time, missed opportunities, and capital tied in inventory.
- Unrealized appreciation is net worth, not realized profit.
- Old `moneyEarned/moneySpent` counters are incomplete historical baselines, not reconstructed transactions.

## 17. Viable strategy targets

Prompt 5 simulations should keep median long-run economic profit/hour within a 0.75×–1.25× band across competent versions of the five strategies. High-skill trading can lead the median, but no fully passive configuration should exceed active expert trading.

- Opening/collecting: low cash ROI, high discovery/achievement progression.
- Trading: highest decision-dependent cash potential, price and liquidity risk.
- Pattern hunting: volatile high ceiling, low supply and confirmation requirements.
- Trade-ups: moderate research-driven ROI with real loss tails.
- Business: scalable throughput after large capital investment and recurring costs.

## 18. Navigation and UI structure

The dark visual identity remains. The final progression area contains:

1. **Business** — employees, facilities, budgets, schedules, alerts, and operating report.
2. **Career & Upgrades** — career rank, XP, specialization map, prerequisites, and effect details.
3. **Prestige** — eligibility, projection, reset/preserve checklist, Legacy Vault, and confirmation.
4. **Achievements & Stats** — lifetime/run achievements, authoritative financial views, career records, and collection scope switch.

Prompt 1 adds no unfinished controls. Navigation changes occur only when the destination is functional.

## 19. Achievements and statistics integration

- Achievements consume ledger/career events with stable IDs.
- Rewards are exact-once and never the sole source of a resettable currency.
- Stats show total income, total expenses, net cash flow, realized trading profit, inventory value, economic net worth, acquisition cost, case P/L, business P/L, Work income, and current-run/lifetime scopes.
- Time played means accumulated active foreground session time. Offline elapsed time is reported separately.
- Ledger history is bounded; lifetime aggregates and run summaries persist after detailed records are compacted.
- Price revaluation changes unrealized value only.

## 20. Save migration and legacy compatibility

Prompt 1 moves v33 to v34:

- Adds a bounded economy ledger and current run ID.
- Keeps all item IDs, floats, paint seeds, Patterns, money, inventory, escrow, marketplace request/tombstone history, achievements, skill progress, automation, and prestige state.
- Stores prior statistics as an explicitly incomplete `legacyBaseline`; no old transactions are fabricated.
- Preserves unspent Upgrade Points through transitional prestige.
- Retains legacy over-max automation levels but caps their effective level and prevents further purchases.
- Preserves legacy wear-research levels while clearly stating that official drops are unchanged.

Future migrations must be additive first, migrate in tests, and delete old fields only after at least one full schema cycle. Cloud envelopes use the same parser and version gate as local saves.

## 21. Required balance simulations

Before finalizing constants, run deterministic Monte Carlo and scripted-agent simulations:

1. 100,000 openings for representative cases and progression states; verify unchanged rarity/float distributions and negative ordinary EV.
2. At least 10,000 careers for each strategy at novice/competent/expert decision quality.
3. Early/mid/late cash, XP, net-worth, and time-to-rank percentiles.
4. Employee ROI with wages, capacity, downtime, fees, and offline caps.
5. Trade-up loss distribution using actual input opportunity cost.
6. Market cycles with stale/low-confidence estimates and rare zero-supply items.
7. Prestige timing and PP-per-hour across at least five tiers.
8. Exploit search: same-tick resale, request replay, save/reload, clock gaps, multiplier stacking, escrow duplication, and protected-item automation.

Acceptance targets are provisional until Prompt 5 documents results and justified adjustments.

## 22. Prompt dependency map

### Prompt 1 — Economy foundation and master design

v34 ledger, Stats correction, exploit fixes, transitional compatibility, this plan.

### Prompt 2 — Career ranks and specialization foundation

Career XP/event pipeline, rank model, anti-farming, initial Career & Upgrades view, migration scaffolding. Depends on ledger transaction categories and run IDs.

### Prompt 3 — Business and employees

Employee scheduler, budgets, wages, roles, offline parity; replace free-money Case Farm through a safe migration. Depends on XP gates and ledger cost/revenue allocations.

### Prompt 4 — Upgrade consolidation

Migrate existing upgrades/skills/automation benefits into the five specializations; eliminate duplicated/dead effects without deleting paid legacy progress. Depends on functioning Career and Business systems.

### Prompt 5 — Economy simulation and balance

Build scripted careers and Monte Carlo suites, calibrate XP/cost/wage/profit curves, verify all five viable strategies and 500–800 hour target. Depends on the complete mechanics from Prompts 2–4.

### Prompt 6 — Prestige and legacy systems

New eligibility, PP formula, reset policy, Legacy Vault, run archival, All Time/Current Run Collection Book. Depends on calibrated career/economy data.

### Prompt 7 — Achievements, Stats, navigation, and migration completion

Consolidated four-destination progression navigation, career achievements, complete run/lifetime reporting, final legacy-field migration and cloud merge policies.

### Prompt 8 — Release hardening

Full browser walkthrough, accessibility/responsiveness, long-session performance, save/cloud conflict tests, economy exploit suite, documentation, release and migration rollback plan.

## 23. Prompt 1 implementation decisions

- Economy ledger detailed history is capped at 160 records; processed IDs at 480; archived summaries at 24. Lifetime and current-run aggregates remain compact and permanent.
- The ledger stores cost basis only for currently owned or escrowed item instances.
- Player listings above credible automated-buyer bounds remain legal but cannot be procedurally bought at the arbitrary ask.
- Auction purchases have a 24-hour instant-resale hold; legitimate later resale and CSWEAR trading remain possible.
- Instant-sale progression closes the remaining spread with `1 - exp(-1.35 × progression)` diminishing returns and never exceeds 95% of fair value.
- Trade-up skills/events lower the Trading Bot's minimum **positive** profit threshold; they never discount actual consumed value.
- Unspent Upgrade Points survive transitional prestige.

## 24. Prompt 2 implementation decisions

Prompt 2 implements the career foundation in save schema v35 without removing the legacy Automation, Upgrades, Skill Tree, or Prestige systems.

- Career level is derived from **current-run cumulative XP** with the exact section 3 formula and a hard level cap of 100. Lifetime XP is a permanent record and does not independently grant a run rank after prestige.
- The six ranks currently use level gates only. The target hour ranges remain balancing evidence, never timers. Future capability notes are displayed as future work and do not unlock unavailable employees or upgrades.
- XP is awarded by a centralized post-reducer pipeline. It consumes confirmed state deltas and stable opening session, item instance, marketplace transaction, achievement, Work completion, and discovery IDs. UI renders and imports never award XP.
- Detailed XP history is bounded to 100 events, exact-once IDs to 1,200, rolling anti-farm windows to 96, milestones to 40, and compact hashed discovery keys to 12,000. Lifetime/current-run aggregates remain permanent within these documented limits.
- Opening XP follows the section 4 formula. Verified special and exceptional Pattern classifications add conservative novelty bonuses. Automated opening XP is halved and has a lower rolling-hour soft cap; odds and item values are unchanged.
- Trading XP is awarded only when a player-owned item completes a CSWEAR sale with known ledger cost basis. The amount uses realized profit, losses receive at most the documented learning award, and player/self counterparties do not qualify.
- Collection XP uses All Time novelty for the v35 foundation. A discovery already present in the permanent collection does not become farmable after prestige. Current-run discovery keys are tracked for the Prompt 6 Collection Book split even when no second XP award is due.
- Trade-up XP uses the actual completed output and a hash of the consumed skin identities. Identical strategies in the six-hour window diminish but never fall below 20%.
- Work XP is `15 + 30 × normalizedPerformance`, only after the reducer records a real job completion and cooldown timestamp.
- Achievement XP is awarded at claim time for post-v35 unlocks only. Migration marks every pre-v35 achievement as legacy, including unclaimed rewards, so claiming an old reward cannot convert the same historical milestone twice.
- Business operational XP remains disabled until Prompt 3 because no employee operation exists yet. Existing Automation achievement XP is classified under Case Opening rather than fabricating Business activity.
- v34→v35 migration grants a one-time baseline equal to 50% of configured XP for verified legacy achievements, capped at 2,500 XP. It creates no historical XP events, derives permanent discovery hashes from the existing collection book, and changes no cash, inventory, Pattern, escrow, ledger, or progression identity.
- Prestige starts a new Career run, clears current-run XP/windows/current-run specialization XP, and preserves lifetime XP, lifetime discoveries, rank records, and legacy migration metadata.
- `Career & Upgrades` began as the Prompt 2 read-only dashboard. Prompt 4 now makes it the authoritative purchase and research-tool surface; the archived purchase routes redirect here.

### Prompt 2 preliminary progression projections

These deterministic projections use provisional effective XP/hour assumptions after current anti-farming. They are not telemetry and do not claim the unfinished employee/upgrade economy is balanced.

| Archetype | XP/hour | L15 | L35 | L55 | L75 | L100 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Casual mixed play | 900 | 104.0h | 531.5h | 1,276.4h | 2,238.5h | 3,705.7h |
| Regular mixed play | 2,200 | 42.6h | 217.4h | 522.2h | 915.8h | 1,516.0h |
| Dedicated mixed play | 4,200 | 22.3h | 113.9h | 273.5h | 479.7h | 794.1h |
| Opening focused | 2,400 | 39.0h | 199.3h | 478.6h | 839.4h | 1,389.6h |
| Trading focused | 4,600 | 20.4h | 104.0h | 249.7h | 438.0h | 725.0h |
| Collection focused | 3,600 | 26.0h | 132.9h | 319.1h | 559.6h | 926.4h |
| Trade-up focused | 3,300 | 28.4h | 144.9h | 348.1h | 610.5h | 1,010.6h |

The dedicated and trading-focused projections reach the 650–800-hour Legend target. Regular, opening, collecting, and trade-up paths are too slow at the foundation stage. Prompt 3 employee throughput and Prompt 4 specialization effects must narrow that gap without making passive play exceed expert active trading; Prompt 5 must replace these assumptions with scripted careers and telemetry-informed calibration.

## 25. Prompt 3 implementation decisions

Prompt 3 advances saves to v36 and makes Business the only employee-automation authority. Detailed mechanics and migration policy are maintained in `BUSINESS_SYSTEM.md`.

- The five roles use fixed acquisition tiers, maximum training level 8, the section 7 hire/training/wage formulas, and Career gates at levels 15/15/35/35/55.
- Operating allocations are reserved cash, not a duplicate wallet or economic expense. The ledger recognizes expense only when payroll or a real operation consumes the allocation. Unused funds return exactly once.
- A persistent payroll watermark settles eligible online/offline time once and pauses an employee before the allocation can become negative.
- `TICK_BUSINESS` is shared by live and offline play. It invokes the existing case, sale/listing, virtual-market purchase, and trade-up reducers instead of creating parallel reward paths.
- Business XP uses completed, ledger-backed operations and stable operation IDs. Hiring, training, transfers, wages, scans without a match, and failed operations award none.
- Case Operator uses official drop rules and real case costs. Sales Assistant excludes protected/special items. Market Scout only alerts. Trade-Up Specialist uses actual opportunity cost and manual high-value/five-Covert approval. Junior Trader buys only bounded ordinary offers and never negotiates.
- Legacy Case Farm cash generation is fully retired. The v35→v36 migration converts reconstructed legacy investment into employee training/capacity and noncash transition credit capped at $75,000. Warehouse and Auction House are preserved.
- The old `/automation` route redirects to `/business`; legacy controls remain in source only for old-schema compatibility tests. The old scheduler cannot execute employee work once `business.authoritative` is true.
- Negotiation percentage shortcuts only populate the editable offer. The player still submits every offer manually.
- The final upgrade consolidation, advanced capacity/training perks, and complete balance calibration remain Prompt 4 and Prompt 5 work rather than hidden placeholder controls.

## 26. Prompt 4 implementation decisions

Prompt 4 advances saves to v37 and makes the five Career specializations the only player-facing upgrade authority. The complete 95-node catalog, exact costs, prerequisites, consumers, reset rules and coverage map live in `CAREER_UPGRADE_SYSTEM.md`.

- Distribution is exactly 18 Case Opening, 22 Trading, 16 Collecting, 18 Trade-Ups and 21 Business nodes. The registry is typed and is the shared source for purchase validation, UI text and runtime values.
- Purchases use cash plus a one-time bounded noncash transition credit. Career XP remains a gate and is never spent. No specialization tokens or branch currencies were added.
- Legacy run-upgrade and Skill Tree fields remain loadable historical data, but their helpers are neutral, actions reject purchases, routes redirect to Career, and they cannot stack hidden effects.
- The v36→v37 transition converts eligible old progression once using `min($75,000, SkillPoints×$500 + UpgradePoints×$1,000 + LearnedSkills×$250 + EligibleUpgradeLevels×$750)`. Prompt 3's Module Bay conversion is excluded.
- Official case rarity, wear, float and Pattern generation are unchanged. Research upgrades reveal existing information or add workflow capacity; they never predict a result or create a price premium.
- Mechanical upgrades are consumed by opening presentation/batch controls, inventory and Trophy Room capacity, CSWEAR player-sale fees, and the shared online/offline employee scheduler. Business panels expose role-specific Career effects.
- Every run specialization level resets on Prestige. Lifetime Career XP, collection discoveries, achievements, Prestige records, migration metadata and remaining transition credit are preserved.
- Cost and 500–800-hour economy calibration remain provisional until Prompt 5. Prompt 6 still owns the new Prestige formula, Legacy Vault and All Time/Current Run Collection Book presentation.
