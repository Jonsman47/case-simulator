# Business and Employee System

Implementation baseline: save schema v36 (Career Overhaul Prompt 3)

The Business system is the only authority for employee automation. The v35 Auto Opener, Opening Desk, Case Farm, Trading Bot, and Market Analyst schedulers are disabled by the v36 migration and cannot run beside employees. Warehouse capacity and the independent Auction House remain available as Business facilities.

## Cost model

Employee roles have a fixed acquisition tier `T` from 1 through 5. Training level `L` is the employee's current level before buying the next level.

- Hire: `round(2500 × 2.15^(T - 1))`
- Training: `round(1200 × roleFactor × 1.85^L)`
- Hourly wage: `round(25 × roleFactor × (1 + 0.32 × L)^1.35)`
- Training maximum: 8. Every level improves operation frequency and, where relevant, batch size or search coverage.

Role factors are 1.00 Case Operator, 1.15 Sales Assistant, 1.35 Market Scout, 1.60 Trade-Up Specialist, and 1.80 Junior Trader. Prompt 5 evaluated all 45 role/training-level points. Costs and wages were retained: each employee creates zero direct cash, high throughput remains constrained by budgets/daily limits/supply, and active expert play outperforms passive operation.

## Shared scheduler and money model

`TICK_BUSINESS` is the single online/offline scheduler. Every employee stores a next-action time and payroll watermark. Online play checks due work once per second. Offline progress runs the same reducer operations, limited by the existing global 24-hour cap and bounded catch-up counts.

Operating allocations are real reserved funds. Allocation removes cash from the player wallet exactly once; purchases, openings, and payroll consume the employee's available allocation; releasing unused capital returns it exactly once. An allocation is not an expense. The ledger records the later operation as an expense and retains item cost basis. An estimated discount is never realized profit.

Payroll is proportional to eligible elapsed time, capped by the offline window. The watermark advances only when a period is settled. If the allocation cannot pay a due wage, the employee pauses without a negative balance. Hiring, training, transfers, payroll, idle scans, and failed searches award no Career XP.

Business Career XP is generated only by completed real operations and uses the master-plan baseline `min(160, max(1, round(8 × ln(1 + grossVolume))))`, subject to the persisted hourly anti-farm window and exact operation IDs. Prompt 5 applies this same rule to legitimate offline operations; replayed offline state and duplicate operation IDs award nothing.

## Employees

### Case Operator — Career level 15

Uses the authoritative case-opening reducer with unchanged odds, float, wear, Pattern, prices, inventory capacity, auto-sell, event modifiers, ledger accounting, and Career XP. It checks the selected unlocked case, assigned capital, wallet reserve, stop-loss, free-slot reserve, daily shift cap, and trained batch cap before paying the real case price. Training unlocks batches up to five and faster bounded throughput.

### Sales Assistant — Career level 15

Handles ordinary duplicates only. It keeps the configured number of best copies and can use instant quotes, CSWEAR escrow listings, or a mixed policy. It enforces weapon/rarity/value/quote/profit/listing/count/discount/confirmation limits. Locked, favorite, trophy, and special or exceptional Pattern items are excluded. Repricing respects the original seven-day expiry, and optional relisting uses the existing returned escrow item rather than inventing a copy.

### Market Scout — Career level 35

Runs bounded deterministic CSWEAR queries against stable virtual listing IDs. Watchlists support exact skin, weapon, wear, float range, Pattern ID/classification (including Blue Gem/Fade/Doppler text), edition, price, discount, confidence, and seller constraints. Results contain the real generated listing fields, expiry, valuation confidence, scan coverage, and a CSWEAR deep link. Stable listing IDs suppress duplicate alerts. The Scout never buys or negotiates and never changes supply.

### Trade-Up Specialist — Career level 35

Uses the existing trade-up planner and actual opportunity cost. It enforces positive expected profit, ROI, per-contract input value, daily consumed value, collection/rarity rules, and shift limits. Protected items cannot enter a suggestion. High-value contracts and all five-Covert special-output contracts pause for manual approval; routine eligible contracts use the real trade-up pipeline.

### Junior Trader — Career level 55

Scans a bounded candidate set and may buy small ordinary CSWEAR listings only. It checks stable availability, assigned capital, maximum price, daily transaction and spending caps, credible discount/confidence, wear/float/category rules, exposure per skin, inventory capacity, wallet reserve, stop-loss, and manual-approval threshold. It rejects special/exceptional Patterns and never negotiates. Purchases use the manual marketplace transaction and tombstone pipeline, so an ID cannot be bought twice.

## Legacy v35 to v36 migration

The one-time migration reconstructs documented purchase costs from persisted legacy levels where possible. It does not claim to reproduce exact historical spending. Thirty-five percent of reconstructed investment becomes noncash Business transition credit, capped at $75,000, usable only for employee hire/training costs.

- Auto Opener and Opening Desk map to Case Operator ownership/training.
- Trading Bot maps to Trade-Up Specialist ownership/training.
- Market Analyst maps to Market Scout/Sales Assistant capability.
- Module Bay maps to bounded operating-capacity entitlement.
- Warehouse capacity and Auction House state remain intact.
- Case Farm is retired and supplies transition credit only; it can no longer create online or offline cash.

The migration marker survives prestige and cloud serialization, so credit cannot regenerate. Money, inventory, instance IDs, float, Pattern, item cost basis, escrow, negotiations, request history, achievements, Career XP, collections, and Prestige records are not rewritten. Prestige starts with fresh run Business infrastructure but preserves the migration marker and lifetime ledgers.

## Storage and limitations

Recent operations are capped at 80, processed employee/request IDs at 800, alerts at 80, and watchlists at 12. Virtual listings are queried procedurally rather than stored. Exact Pattern artwork and live external prices remain unavailable. Real Supabase deployment is credential-dependent; the local/cloud serialization path uses the same v36 parser, but production RLS/RPC behavior is not claimed as verified without credentials.

Prompt 4 replaces the remaining legacy Upgrades and Skill Tree authority with the v37 Career specialization system. Business consumes Career effects for operating capacity, training price, payroll, scheduler interval and per-pass throughput, Warehouse capacity, listing limits, Case Operator batches/reserves, Scout watchlists/scans, Trade-Up Specialist scans/contracts/approval thresholds, Junior Trader scans and seller fees. These values are calculated by the same reducer helpers online and offline and are visible in employee panels. Full catalog and caps are documented in `CAREER_UPGRADE_SYSTEM.md`.

Prompt 5 calibrated acquisition, wages, frequency, capacity and upgrade interactions with 300,000 aggregate careers and 45 employee role/level audits. Values were retained; role-specific utility and residual uncertainty are documented in `CAREER_ECONOMY_BALANCE_REPORT.md`. Prompt 6 will replace the transitional Prestige reset policy and add the Legacy Vault using `PRESTIGE_BALANCE_SPEC.md`.
