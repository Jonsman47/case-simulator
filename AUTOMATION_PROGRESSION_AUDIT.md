# CS2 Case Simulator — Automation & Progression Audit

**Audit date:** 2026-11-11
**Scope:** analysis only; repository state at commit `a7b564d` plus the existing untracked user files
**Code changed by this audit:** none
**Primary application:** `case-opening-simulator/`

## Executive summary

The simulator has six overlapping progression layers: cash purchases, run upgrades, automation module levels, achievement/upgrade points, a 139-node permanent skill tree, and prestige points/permanent prestige bonuses. Collection rewards, daily rewards, game events, market events, Work jobs, and case licenses add still more modifiers. Most systems are implemented and saved, but they do not form one clearly bounded progression curve.

The normal journey is: start with $100 and two unlocked production cases; use Work and/or sell case rewards; buy the $350 Auto Opener or $1,500 Case Farm; buy case licenses; buy run upgrades and automation; meet the very large prestige gate; reset most of the run for prestige and skill points; repeat. There is no XP or player level. Cash is the main run currency, upgrade points are a finite achievement currency, skill points come from achievements and every prestige, and prestige points come from every prestige.

The biggest findings are:

1. **Case Farm dominates the economy.** Level 1 with two cases is $360/hour. Level 10 with all 42 cases is $82,368/hour before speed and skill bonuses, $347,544/hour with the maximum online speed/passive bonuses, and approximately $599,514/hour in the current offline calculation because the passive branch is accidentally applied twice. A simple daily reinvestment model reaches level 10 in 5–12 days and roughly $38M–$52M cash by day 30.
2. **Two advertised wear systems do nothing to generated items.** `Wear Tuning` and the `Wear Whisperer`/`Float Tuning` skill path have correct helper functions and tests, but `createSkinInstance()` calls `randomFloatForSkin()` directly. The helpers are never used in production item generation.
3. **Offline Case Farm double-counts one skill branch.** `getSkillOfflineEarningsMultiplier()` already includes `passive_income`; `applyOfflineCaseFarm()` multiplies by that and `getSkillPassiveIncomeMultiplier()` again. Tier 10 plus Offline Operator is 2.5875× offline instead of the labeled 1.725×.
4. **Prestige can permanently strand the finite upgrade-point currency.** Prestige resets `upgradePoints` and all run upgrades, but preserves achievements and their claimed state. Upgrade points come only from one-time achievement claims. After the catalog is exhausted, a later prestige cannot reacquire upgrade-point-gated run upgrades such as Rarity Luck.
5. **Sell bonuses overlap heavily and are mostly neutralized by a hard cap.** Automation, upgrades, prestige, skills, collection rewards, and Collector Week multiply together, but `getInstantSaleQuote()` clamps the final liquidation rate to 95% of fair market value. The raw maximum non-collection progression multiplier is about 2.06×, yet the actual quote still cannot exceed 0.95×. Many late sell levels therefore have no marginal effect.
6. **Trade-up “discounts” can cause value destruction.** Skill/event discounts reduce the input value used to decide whether a contract is profitable; they do not reduce the items consumed. A $100 input set with $80 output EV is treated as $72 input during max skill + Trade-Up Madness, shown as +$8 EV, and can be executed despite a true -$20 EV.
7. **Marketplace and Auction House contain real arbitrage risks.** High-level Auction discounts (10.45–19%) can exceed the 5% minimum liquidation haircut. Player market listings accept any finite positive asking price, and even an asking price above 150% of fair value retains a small nonzero automatic-sale probability; successful automatic sales pay the full asking price. This is an unbounded-money exploit over enough listings/time.
8. **Several permanent or cosmetic rewards are dead or misleading.** Achievement badges are displayed in reward text but never stored. The Cosmetic skill branch is only displayed in Skill Tree UI. Event reward fields exist but no event templates grant rewards and no reducer path claims them. Overclocked Floor levels 9–10 cost points but add no speed because the cap is reached at level 8.
9. **Statistics are not a ledger.** `moneyEarned` includes Work and sales but excludes Case Farm, daily/achievement cash, and some other inflows. The Stats “net profit” is `moneyEarned - moneySpent`, so it is not the wallet change. Case Farm also does not update `moneyEarned`, while Work does, despite prestige calling the gate “Sell Earnings.”
10. **The UI spreads one progression problem across six destinations.** Automation has the meaningful run engine, Upgrades and Skills repeat many of the same effects, Prestige repeats them a third time, Achievements supplies two currencies, and Stats presents partial accounting. The Skill Tree is 139 nodes but only one next node per generated branch is shown; all branches can eventually be learned, so choices are ordering decisions rather than exclusive builds.

The strongest redesign opportunities are to establish one authoritative economy ledger, make Case Farm output and offline rules consistent, reduce duplicated bonus families, decide whether prestige should preserve or regenerate upgrade points, remove dead levels/effects, and make automation a strategic conversion system rather than a dominant cash faucet. Three non-implemented design directions appear at the end of this report.

---

## 1. Overall progression architecture

### 1.1 Currencies and durable state

| Resource/state | How it is earned | How it is spent | Prestige behavior |
|---|---|---|---|
| Money | Start $100; Work; manual/bulk/auto sales; player-market sales; Case Farm; daily rewards/challenges; achievement rewards | Cases, case licenses, automation, run upgrades, Auction House, CSWEAR purchases | Reset to $100 + Seed Bank bonus |
| Upgrade points | One-time achievement claims only | Trend Scanner levels 2–3, Module Bay levels 2–3, every Rarity Luck level | **Reset to 0**; claimed achievements remain claimed |
| Skill points | Achievement claims and the same point award granted by each prestige | 139 skill nodes, 330 SP total | Preserved; prestige award is added |
| Prestige points | Each prestige | Seven permanent bonus tracks | Preserved |
| Case licenses | Purchased for 35× case+key price; day-7 reward contains one legacy placeholder unlock | Access to cases | Reset |
| Collection book/rewards | Discovering skins/wears | Passive bonuses | Entire book and **all** reward records preserved |
| Achievements | Conditions evaluated after many reducer actions | Claimed for money/SP/upgrade points | Preserved, including claimed state |

Sources: `src/data/gameState.ts:defaultGameState`, `src/data/gameReducer.ts:prestigeRun`, `claimAchievementReward`, `purchaseCaseLicense`.

### 1.2 Money sources

- **Work jobs:** exact formula is `baseReward × performanceMultiplier × (1 + 0.25 × ClickIncomeLevel) × (1 + 0.12 × SideJobTier)`. Completion and cooldown are reducer-checked.
- **Item sales:** current fair value is converted to an 85–95% liquidity quote, then progression multipliers are applied to the rate and the final rate is clamped back to 85–95%.
- **Player marketplace:** escrowed items can sell for their asking price or an accepted NPC offer.
- **Case Farm:** a direct cash faucet every effective 10 seconds; it is the only major automation module that creates money without consuming another resource.
- **Daily/achievement rewards:** fixed cash; these do not consistently enter `statistics.moneyEarned`.
- **Case openings/trade-ups/Auction:** create items, not cash; cash appears after a sale.

### 1.3 Money sinks

- Case openings and case licenses.
- Auto Opener/module/run-upgrade purchases.
- Auction House and CSWEAR purchases.
- There is no market listing fee, storage upkeep, automation fuel, module maintenance, tax, or recurring Case Farm cost.
- Trade-ups consume 10 same-rarity items, or 5 Covert items.

### 1.4 Unlock order

Production uses 42 imported cases. Kilowatt and Revolution are unlocked by pricing status. `defaultGameState.casesUnlocked` still contains legacy IDs (`starter_case`, `fracture_style_case`), but the two imported starter cases are available because their case definitions are `Unlocked`. The remaining 40 cases are license-gated. License cost is:

`round((CSFloat case price + $2.49 key price) × 35 × (1 - LicenseBrokerDiscount), 2)`

There is no cases-opened prerequisite on imported licenses. All 40 can be bought whenever cash permits. Base total is about **$19,050.85**, or **$16,193.22** at the maximum 15% skill discount.

Automation has no progression prerequisite beyond cash:

- Auto Opener: $350.
- Case Farm: $1,500.
- Warehouse: $2,500.
- Market Analyst: $4,000.
- Opening Desk: $6,500.
- Auction House: $9,000.
- Trading Bot: $12,000.

The base active-module capacity is two. Opening Desk, Case Farm, Trading Bot, Market Analyst, and Auction House use a slot. Warehouse is passive and Auto Opener is separate. Module Bay raises capacity to five, allowing every slot-consuming module to run.

### 1.5 Typical journey

```text
$100 + two cases
  -> Work/sell to $350 or $1,500
  -> Auto Opener and/or Case Farm
  -> buy case licenses (licenses directly increase Case Farm output)
  -> buy run upgrades + more automation
  -> achievements yield one-time upgrade points and SP
  -> reach 25,000 cases + $250k spent + ($1M inventory OR $500k moneyEarned)
  -> prestige
      reset money/inventory/licenses/automation/upgrades/stats/market/daily state
      preserve achievements/collection/skills/prestige currencies and bonuses
      add the same award to PP and SP
  -> rebuild the cash run with permanent modifiers
```

Essential systems are money, cases/items, selling, inventory, and one long-term progression layer. Automation is strategically important but Case Farm is economically dominant. Upgrades, Skills, Prestige, collection rewards, and events repeatedly modify the same five concepts: price, sell rate, rarity, speed, and capacity. Achievement and Stats pages are supporting systems, but the former is also the sole source of upgrade points.

---

## 2. Automation audit

### 2.1 Shared timing and slot formulas

For Auto Opener, Opening Desk, Case Farm, and Trading Bot:

`effectiveInterval = baseInterval × UpgradeServosMultiplier × PrestigeSpeedMultiplier × SkillSpeedMultiplier`

- Upgrade: `1 - min(0.35, 0.05 × ServosLevel)`; actual max level 5 = 0.75.
- Prestige: `1 - min(0.40, 0.05 × OverclockedLevel)`; cap reached at level 8 = 0.60.
- Skill: `1 - min(0.24, 0.05 if BulkAutomation + 0.012 × AutomationTier + 0.004 × OpeningTier)`; achievable max = 0.79.
- Combined achievable multiplier: `0.75 × 0.60 × 0.79 = 0.3555`.

Auction House does **not** use these shared timing multipliers, although Automation Servos says it applies across modules and the Active Tasks UI multiplies the displayed Auction interval. Its reducer and offline scheduler use only `getAuctionHouseRefreshMs()`.

### 2.2 Cost tables

| Module | Level purchase costs | Max | Total to max |
|---|---|---:|---:|
| Opening Desk | 6,500; 15,275; 35,896.25; 84,356.19; 198,237.04; 465,857.05 | 6 | $806,121.53 |
| Case Farm | 1,500; 3,075; 6,303.75; 12,922.69; 26,491.51; 54,307.59; 111,330.57; 228,227.66; 467,866.71; 959,126.76 | 10 | $1,871,152.24 |
| Trading Bot | 12,000; 31,800; 84,270; 223,315.50; 591,786.07 | 5 | $943,171.57 |
| Market Analyst | 4,000; 9,000; 20,250; 45,562.50; 102,515.63; 230,660.16; 518,985.35; 1,167,717.04 | 8 | $2,098,690.68 |
| Warehouse | 2,500; 5,375; 11,556.25; 24,845.94; 53,418.77; 114,850.35; 246,928.24; 530,895.72 | 8 | $990,370.27 |
| Auction House | 9,000; 22,050; 54,022.50; 132,355.13; 324,270.06; 794,461.64 | 6 | $1,336,159.33 |

All module costs use `round(baseCost × costMultiplier^currentLevel, 2)`. The UI blocks purchases at max, but `purchaseAutomationModule()` itself does not check `maxLevel`. A direct/replayed action can exceed the declared max. Total declared module cost is about $8.05M.

### 2.3 Auto Opener

**Purpose:** opens one selected, accessible case on a timer and pays the normal effective case cost. It uses the shared opening and auto-sell transaction.

**Unlock/cost:** first level $350; every later level costs `$2,500 × 2^(currentLevel-1)`. Costs through the useful sixth level are $350, $2,500, $5,000, $10,000, $20,000, $40,000.

**Frequency:** base intervals by level are 30, 25, 20, 15, 10, 5 seconds. Level 6 reaches the 5-second floor. There is no maximum level, so the UI continues selling exponentially more expensive levels with no added effect.

**Resources/limits:** one case cost, one free inventory slot, accessible selected case. It does not use a module slot. It pauses on insufficient cash, full inventory, or unavailable case. Auto-sell happens only after free-slot calculation, so a completely full inventory blocks an opening even if the new item would be auto-sold.

**Offline:** simulated exact ticks up to 24 hours/25,000 total simulation steps. It can stop on cash/capacity just as online.

**Examples using the documented Kilowatt sample ($2.65 cost, $0.96 item EV, at most $0.912 liquidation EV):**

| State | Opens/hour | Cost/hour | Item EV/hour | Max liquidation EV/hour | Expected cash loss/hour |
|---|---:|---:|---:|---:|---:|
| L1 | 120 | $318 | $115.20 | $109.44 | $208.56 |
| L3 | 180 | $477 | $172.80 | $164.16 | $312.84 |
| L6 | 720 | $1,908 | $691.20 | $656.64 | $1,251.36 |
| L6 + max speed | ~2,025 | ~$5,367 | ~$1,944 | ~$1,847 | ~$3,520 |

These are expected-value examples, not guaranteed results; rare patterns can dominate individual runs.

**Validation:** core opening, cost deduction, reward, auto-sell, offline operation, pause behavior, and exact-once reducer flow are **WORKING**. Unlimited dead levels are **BROKEN** as progression. The module is a throughput tool, not income automation.

Sources: `src/utils/automation.ts:getAutoOpenerUpgradeCost/getAutoOpenerIntervalMs`; `src/data/gameReducer.ts:purchaseAutoOpener/tickAutoOpener/openCase`.

### 2.4 Opening Desk

**Purpose:** opens a batch of the Auto Opener’s selected case.

**Mechanics:** batch `min(8, level + 1)`; interval `max(45s, 90s - 7.5s × (level - 1))`. Declared max level 6 therefore gives seven cases every 52.5 seconds; the apparent eight-case/45-second caps are unreachable through the UI.

| State | Batch / interval | Cases/hour | Kilowatt max-liquidation cash loss/hour |
|---|---|---:|---:|
| L1 | 2 / 90s | 80 | ~$139 |
| L3 | 4 / 75s | 192 | ~$334 |
| L6 | 7 / 52.5s | 480 | ~$834 |
| L6 + max speed | 7 / 18.66s | ~1,350 | ~$2,346 |

It consumes one module slot, normal case cash, and inventory space. Offline behavior and pauses match Auto Opener. **WORKING**, with an unreachable helper cap and the generic reducer max-level guard missing.

### 2.5 Case Farm

**Purpose:** creates cash with no input resource.

Per-tick formula:

`round((0.5 + max(1, unlockedCaseCount) × 0.25) × level × (1 + (level - 1) × 0.12), 2)`

Online output also multiplies by `1 + 0.05 × passive_income tier`. Effective tick time uses all shared speed multipliers.

| Example | Per base tick | Base/hour | Max speed/hour | Max speed + passive tier 10 |
|---|---:|---:|---:|---:|
| L1, 2 cases | $1.00 | $360 | $1,012.66 | $1,518.99 |
| L5, 20 cases | $40.70 | $14,652 | $41,215.19 | $61,822.78 |
| L10, 42 cases | $228.80 | $82,368 | $231,696.20 | $347,544.30 |

Offline formula currently is:

`baseRate × duration × OfflineSkillMultiplier × PassiveIncomeMultiplier`

but `OfflineSkillMultiplier = (OfflineOperator ? 1.15 : 1) × PassiveIncomeMultiplier`. Tier 10 therefore receives `1.15 × 1.5² = 2.5875`, producing about **$599,513.92/hour** in the fully sped L10/42-case example. The labeled combination is 1.725×.

It consumes one module slot, works offline for up to 24 hours, never checks capacity, and never increments `statistics.moneyEarned`. **PARTIALLY WORKING / CRITICALLY UNBALANCED**: online generation works; offline applies a branch twice; stats omit its income; licenses cheaply multiply its base.

### 2.6 Trading Bot

Every effective 45 seconds it calls `suggestBestTradeUps()`, selects the highest predicted suggestion, and executes only if calculated expected profit meets:

`max($0.50, $5 - $0.75 × (level - 1))`

Thresholds L1–L5: $5, $4.25, $3.50, $2.75, $2.00. It uses one slot. Offline checks are capped at 20.

Trade-up input analysis multiplies actual input value by skill and event “discounts,” while execution still destroys the real items. With max Contract Math/core (0.80) and Trade-Up Madness (0.90), analysis uses 72% of actual input value. Example: $100 actual items and $80 output EV become `80 - 72 = +$8`, so even L1 can execute a contract whose true EV is -$20.

`totalGenerated` records the suggestion’s expected profit, not the realized inventory-value change. A scan with no trade still increments `totalRuns`. Protected/locked/favorited/exceptional-pattern items are excluded.

**PARTIALLY WORKING:** the automation and protection are functional; profit accounting and discount semantics are misleading and can intentionally select negative-real-EV trades.

### 2.7 Market Analyst

Adds `1% × level` to the multiplicative sale bonus only while enabled; max +8%. It consumes one slot and has no timer/offline tick. It affects manual, bulk, and auto-sells through shared quote logic.

The final quote rate is still clamped to 95%. A high-liquidity item already at 95% gets no benefit; a 90% base quote reaches the cap with only a 1.056× combined bonus. **PARTIALLY WORKING:** consumed correctly, but frequently zero-value because of the global quote cap.

### 2.8 Warehouse System

Adds 250 slots/level, maximum +2,000, always passive, and uses no active slot. Capacity is:

`250 base + 250×Warehouse + 100×WarehouseRows + 1000×VaultExpansion + 150×InventorySkillTier`

Pre-prestige maximum is 4,250 (250+2,000+500+1,500); with max prestige capacity it is 14,250. New item-generating actions check capacity and never delete old/over-cap items. Market cancellation/expiry can return escrow without a capacity check, allowing over-capacity state; subsequent openings/purchases stop. **WORKING**, with a recoverable capacity bypass through escrow return.

### 2.9 Auction House

Creates `min(8, 1 + floor((level-1)/2) + skillDealSlots)` offers. Base slots by module level are 1,1,2,2,3,3; Bulk Automation adds 1 and Automation Grid tiers 4/8 add one each, so L6 can reach six offers (the hard cap of eight is unreachable with declared levels/skills).

Maximum discount formula is `min(24%, 4% + 2.5%×level)`. Actual discount is 55–100% of that maximum:

- L1: 3.575–6.5%.
- L3: 6.325–11.5%.
- L6: 10.45–19%.

Refresh: 15m, 13.5m, 12m, 10.5m, 9m, 7.5m for L1–L6. Deals last 20 minutes. Premium-candidate chance is `min(6%, 1% + 0.6%×level)` = 1.6–4.6%. Offers preserve wear, edition, seed, pattern, and final value. Purchases are exact-once because the deal is removed.

High-level discounts exceed the instant-sale haircut: at a 95% quote, any discount above 5% is immediately profitable. L6 therefore offers a renewable 3.8–17.3% gross fair-value arbitrage before rounding, subject to refresh, capital, and manual purchase. Automation speed bonuses do not affect refresh despite UI/description implications.

**PARTIALLY WORKING:** generation, expiry, purchase, persistence, capacity, and statistics work; timing bonus/UI disagree and direct resale is a confirmed renewable arbitrage.

---

## 3. Run upgrades

All money costs are `round(base × multiplier^currentLevel, 2)`. Run upgrades and unspent upgrade points reset on prestige.

| Upgrade | Costs by level | Max/effect | Requirement | Validation |
|---|---|---|---|---|
| Opening Motor | 450; 967.50; 2,080.13 | L3, +45% presentation speed | None | **WORKING**, presentation only |
| Bulk Loader | 2,500; 5,875; 13,806.25; 32,444.69; 76,245.02; 179,175.79; 421,063.10; 989,498.29; 2,325,320.99 | L9, base batch cap reaches 100 | Opening Motor L1 | **WORKING** |
| Case Contract | 1,250; 2,812.50; 6,328.13; 14,238.28; 32,036.13 | L5, 10% case discount | None | **WORKING** |
| Wear Tuning | 2,000; 4,600; 10,580; 24,334; 55,968.20 | L5, advertised +10 FN/MW weight | None | **BROKEN/UNUSED** in item generation |
| Click Income | 300; 570; 1,083; 2,057.70; 3,909.63; 7,428.30; 14,113.76; 26,816.15; 50,950.68; 96,806.29 | L10, +250% Work (3.5×) | None | **WORKING** |
| Market Signal | 3,000; 6,900; 15,870; 36,501; 83,952.30 | L5, +7.5% sell multiplier | None | **PARTIAL**, often swallowed by 95% cap |
| Trend Scanner | 7,500; 19,500 +1 UP; 50,700 +1 UP | L3, +1.5 percentage points schedule chance | $1K inventory achievement | **WORKING** |
| Automation Servos | 5,000; 11,750; 27,612.50; 64,889.38; 152,490.03 | L5, 25% shorter intervals | Hands Off achievement | **PARTIAL**, Auction ignores it |
| Module Bay | 12,000; 33,000 +1 UP; 90,750 +1 UP | L3, capacity 2→5 | Servos L2 | **WORKING** |
| Warehouse Rows | 2,400; 5,160; 11,094; 23,852.10; 51,282.01 | L5, +500 slots | None | **WORKING** |
| Rarity Luck | 25,000; 80,000; 256,000; 819,200; 2,621,440, each +1 UP | L5, 10% rarity-index pressure | Prestige 1 | **WORKING**, but finite UP/reset problem |

Rarity Luck does not mean “10% better odds.” Each drop weight is multiplied by `1 + rarityIndex × 0.10` at max, then the whole table is renormalized: Covert +50%, Special +60%, Contraband +70% weight before normalization. Total run-upgrade cash cost is about **$8.92M**, plus 9 upgrade points. Bulk Loader ($4.05M) and Rarity Luck ($3.80M) dominate the bill.

Overlap is extensive: case discounts also exist in collection/prestige/events/daily rewards; sell value in automation/skills/prestige/collection; speed in skills/prestige; capacity in automation/skills/prestige; rarity in collection/skills/prestige/events.

---

## 4. Skill tree

### 4.1 Earning, permanence, and choice

There are 139 nodes costing 330 SP: nine core nodes cost 18 total and 13 branches contain ten tiers costing 24 per branch. Tier costs are `1,1,1,2,2,2,3,3,4,5`. Skill points come from achievements and every prestige award. Skills and unspent SP survive prestige. There is no respec and no mutually exclusive branch; all nodes can eventually be learned, so the tree provides prioritization rather than permanent build choice.

Achievement rewards provide roughly 103 SP if every catalog condition is possible, but some wear-completion conditions are not realistically attainable (see Achievements). The remaining points are unlimited through repeated prestige.

### 4.2 Core nodes

| Node (cost) | Prerequisite | Exact effect | Consumer | Status |
|---|---|---|---|---|
| Sell Specialist (1) | None | +2% sale multiplier | shared sale quote | **PARTIAL**, capped |
| Wear Whisperer (1) | None | advertised +3 FN/MW weight | unused helper only | **BROKEN/UNUSED** |
| Bulk Automation (2) | Sell Specialist | +1 Auction offer; 5% shorter shared automation intervals | automation/Auction | **WORKING** |
| Trade-Up Edge (2) | Sell Specialist | input analysis ×0.95 | trade-up planner/bot | **PARTIAL/HARMFUL SEMANTICS** |
| Market Oracle (2) | Sell Specialist | +1 point event schedule chance | both event tick paths | **WORKING** |
| Golden Touch (3) | Wear Whisperer | +8% special pressure | case drop table | **WORKING** |
| Offline Operator (2) | Bulk Automation | offline Case Farm ×1.15 | offline progress | **WORKING**, participates in double-branch bug |
| Event Hunter (2) | Market Oracle | +2 points schedule chance | both event tick paths | **WORKING** |
| Prestige Scholar (3) | Golden Touch + Offline Operator | prestige award ×1.15 | prestige reducer | **WORKING** |

### 4.3 Generated branches (all ten named tiers)

Every branch uses the tier names **Apprentice, Assistant, Coordinator, Technician, Supervisor, Specialist, Architect, Director, Master, Legend**, chained in order. The table therefore describes every one of the 130 generated nodes.

| Branch/root | Effect at tier `t`; maximum | Actual consumers | Status |
|---|---|---|---|
| Opening Line / Bulk Automation | +4% reveal speed/t; +10 max batch every 2 tiers; max +40%, +50 | animation, batch cap; also undocumented 0.4% automation speed/t | **WORKING but under-described** |
| Automation Grid / Bulk Automation | 1.2% shorter interval/t; +1 Auction offer at t4/t8 | shared timing, Auction count | **WORKING** |
| Side Job Route / Sell Specialist | +12% Work/t; max +120% (2.2×) | Work reducer | **WORKING** |
| License Broker / Sell Specialist | 1.5% license discount/t; max 15% | license purchase | **WORKING** |
| Auto-Sell Desk / Market Oracle | +0.6% sale/t; max +6% | all manual/bulk/auto sales, not only auto-sell | **PARTIAL/misnamed**, capped |
| Market Lab / Market Oracle | label +0.3% event/t; code adds +0.3% market knowledge, +0.2% event chance, and +0.3% sell/t | event scheduler and sales | **WORKING but hidden/double-described effects** |
| Contract Math / Trade-Up Edge | 1.5% lower analyzed input/t; max branch 15%, combined core max 20% | planner/bot | **PARTIAL/HARMFUL SEMANTICS** |
| Case Farm Grid / Offline Operator | +5% online passive/t; advertised same offline | online farm; included twice offline | **BROKEN OFFLINE** |
| Showcase Logistics / Bulk Automation | +150 inventory and +4 trophy slots/t; max +1,500/+40 | capacity/trophy definitions | **WORKING** |
| Float Tuning / Wear Whisperer | +1 FN/MW weight/t; max +10 | unused helper only | **BROKEN/UNUSED** |
| Gold Pressure / Golden Touch | +0.6% special pressure/t; max +6% | case drop table | **WORKING** |
| Prestige Engine / Prestige Scholar | +2% award/t; multiplied with Scholar; max combined 1.38× | prestige reducer | **WORKING** |
| Showcase Studio / Golden Touch | cosmetic tier 1–10 | displayed only on Skill Tree page | **UNUSED** |

Special drop pressure only boosts Covert/Special/Contraband by ratios 0.5/1/1 of the aggregate pressure, then renormalizes. At core+branch max (14% aggregate), those raw weights become 1.07×, 1.14×, 1.14× respectively—not universal 14% final odds.

---

## 5. Prestige

### 5.1 Gate

All must be true in the current run:

- 25,000 cases opened.
- $250,000 `statistics.moneySpent`.
- Either $1,000,000 current inventory value or $500,000 `statistics.moneyEarned`.

`moneyEarned` is not actually “sell earnings”: Work adds to it, Case Farm does not, and daily/achievement cash does not.

### 5.2 Award

```text
progressValue  = inventoryValue + moneyEarned + 0.35 × moneySpent
progressPoints = max(3, floor(2 × log10(max(10, progressValue))) - 7)
casePoints     = floor(casesOpened / 12,500)
achievementPts = floor(unlockedAchievementCount / 10)
collectionPts  = 2 × FullWearArchiveRewardCount
baseAward      = max(4, progressPoints + casePoints + achievementPts + collectionPts)
actualAward    = ceil(baseAward × skillPrestigeMultiplier × activeEventMultiplier)
```

The same `actualAward` is added independently to prestige points and skill points. Collector Week is 1.05×. The UI projection includes the skill multiplier but omits the active event multiplier, so the confirmation can understate the actual award.

Concrete verified helper example: 25k cases, $250k spent, $1M inventory, $500k earned, 20 achievements, and Full Wear Archive gives 11 base points. Without the impossible archive reward it gives 9. At minimum inventory-path values and 40 achievements, base is about 11; exact achievement count and extra run value change it.

### 5.3 Reset/preserve map

**Reset:** money, inventory, inventory history/value, case licenses, favorites, auto-sell rules, marketplace/escrow, all automation, all run upgrades, **upgrade points**, daily rewards/cooldowns, Work cooldowns, recent drops, active events/markets, all statistics, and first-case hook.

**Preserved:** prestige level/points/bonuses, skill points/nodes, achievements and claims, collection book, all collection rewards, trophy assignments, settings, UI/onboarding.

Two inconsistencies follow:

- All collection rewards persist although only Full Wear Archive is marked `carriesOver`; `getCarryOverCollectionRewards()` is unused.
- Trophy assignments persist while their inventory items are deleted, creating stale IDs.

### 5.4 Permanent bonuses

Costs are `ceil(base × multiplier^currentLevel)`.

| Bonus | Max | Maximum effect | Costs by level | Validation |
|---|---:|---|---|---|
| Diamond Hands | 15 | +60% raw sale multiplier | 2,4,5,8,12,18,28,43,67,104,161,249,385,597,925 | **PARTIAL**, quote cap |
| Key Network | 16 | 40% case discount | 2,4,6,9,14,21,34,54,86,138,220,352,563,901,1442,2306 | **WORKING** |
| Redline Fate | 12 | 30% rarity-index pressure | 3,5,9,14,23,37,61,100,165,272,449,741 | **WORKING** |
| Overclocked Floor | 10 | 40% shorter intervals | 3,5,8,13,20,32,51,81,129,207 | **PARTIAL**; L9–10 have zero marginal effect |
| Seed Bank | 15 | +$30,000 starting cash | 2,3,5,7,9,13,19,27,40,57,83,120,173,251,364 | **WORKING** |
| Vault Expansion | 10 | +10,000 slots | 2,3,5,7,11,16,23,35,52,77 | **WORKING** |
| Market Memory | 8 | +8 points event chance | 3,6,9,15,26,43,73,124 | **WORKING** |

Maxing all tracks costs 12,891 PP. At roughly 10–20 points per reset this is hundreds of prestige cycles. Overclock’s last two costs (336 PP total) are dead.

---

## 6. Achievements

The catalog contains **117 unique achievements** in eight categories: Opening, Drops, Inventory, Trade Ups, Progression, Collection, Automation, and Trophy Room. There are 22 hand-authored entries and 95 generated milestones:

| Family | Targets |
|---|---|
| Cases | 1 base; 10,25,50,100,250,500,1k,2.5k,5k,10k,25k,50k,100k |
| Money spent/earned | 100,1k,10k,100k,1M,10M each |
| Inventory | 100-item base; 1k/100k/1M bases; 10k,50k,250k,10M,100M generated |
| Rarity discovery | first and complete catalog for all 8 rarities |
| Rarity drops | 10/100/1,000 for Restricted, Classified, Covert, Special, Contraband |
| Trade-ups | 1; 5,25,100,500,2.5k,10k |
| Automation | purchase; 100; 10,1k,10k,100k,1M runs |
| Upgrade levels | 5,15,30,50 |
| Skills | 5,15,30,60,100,139 nodes |
| Prestige | 1,2,5,10,25,50 |
| Collection | 10,25,50,75,90,100%; all wears |
| Hidden | 6 special conditions |

Unlock records are appended once; claim and Claim All mark them claimed and grant money/SP/upgrade points atomically. Repeated claims are prevented. Claiming a badge does not store a badge anywhere—`badge` is presentation-only.

Important correctness issues:

- `collection_wear_master` demands all five wear conditions for every skin, even when a skin’s float range makes some wear impossible. Full Wear Archive collection reward has the same problem (`2,092 × 5` target). These are effectively impossible with the production catalog.
- `hidden_zero_recovery` only checks money >= $5, cases > 0, and moneySpent > 0. It does not prove the player was broke or recovered.
- `moneyEarned` milestones say “from selling,” but Work increments the field. They may unlock after Work when a later progression-wrapped action runs.
- Learning a skill, buying a prestige bonus, and completing Work do not themselves call `withProgressionUnlocks`; related achievements can appear only after a later qualifying reducer action.
- Trophy completion’s required slot count grows with Showcase Logistics. Buying that skill before completing the achievement makes the condition harder.
- Achievements survive prestige and contribute `floor(count/10)` to every later prestige award, whether claimed or not.

---

## 7. Statistics

Statistics live in `GameState.statistics`, save with the game, and reset entirely on prestige.

| Statistic | Updated by | Used by | Reliability |
|---|---|---|---|
| auctionPurchases | Auction purchases | UI, first-purchase achievement | Reliable |
| auctionSavings | listPrice-price | Automation UI | Arithmetic reliable; “savings” assumes generated list value |
| casesOpened | case opening, including automation | unlocks, events, achievements, prestige, Stats | Reliable |
| moneySpent | cases, licenses, automation, run upgrades, Auction, CSWEAR buys | achievements, prestige, Stats | Broad but not every generic/admin spend |
| moneyEarned | Work and item/market sales | achievements, prestige, Stats | **Misnamed/incomplete**; excludes Farm/daily/achievement cash |
| itemsSold | auto/manual/bulk/player-market sales | UI/tutorial | Reliable for those routes |
| marketPurchases/Sales | CSWEAR purchases/player sales | Stats storage only | Purchases not shown in main Stats summary |
| tradeUpsCompleted | trade-up executions | achievements, daily challenge, Stats | Reliable |
| drops | case openings only | Stats | Not all acquired items |
| rareDrops | Covert/Special/Contraband case pulls | offline summary | Excludes Classified despite Stats “rare” using Classified+ |
| patternDrops | openings, trade-up, Auction, daily skin | Stats | Omits CSWEAR acquisitions |
| exceptionalPatternDrops | same routes | achievement/Stats | Omits CSWEAR acquisitions |
| workJobsCompleted | Work reducer | stored/display potential | Reliable |
| bestPrecision/Memory | Work normalized performance | Stats storage | Not shown in main Stats dashboard |
| dropsByRarity | case openings only | rarity achievements/charts | Reliable as pulls, not acquisitions |

The Stats page calculates lifetime cards, rarity charts, inventory history, milestones, session comparisons, and CSV. Range buttons only filter inventory history and milestone timestamps; most headline totals remain lifetime. “Time played” is wall-clock time since the earliest stored activity (including offline/inactive time), not active playtime. Average/hour therefore trends down while the app is not used. “Net Profit” is `moneyEarned - moneySpent`, not wallet change, and can be deeply negative while Case Farm has made the player rich.

---

## 8. Bonus interaction map

### 8.1 Case cost order

For a base case price `P`:

```text
P1 = P × (1 - collectionCaseDiscount × CollectorWeekMultiplier)
P2 = P1 × (1 - 0.02 × CaseContractLevel)
P3 = P2 × (1 - min(0.40, 0.025 × KeyNetworkLevel))
P4 = P3 × globalEventCostMultiplier × caseSpecificEventMultiplier
P5 = P4 × (1 - activeDailyDiscount)
```

Each stage rounds to cents and floors at $0.01 where implemented. Collection case reward is normally 5%, 7.5% in Collector Week. Daily buffs are 5%/10%. Event global and per-case multipliers are separately clamped 0.5–1.5, then multiplied without a combined re-cap.

### 8.2 Drop odds

Sequential order: collection luck → run Rarity Luck → prestige Redline Fate → skill Gold Pressure → active event rarity multipliers. Every stage changes weights then renormalizes. Bonuses are multiplicative across stages, but displayed “pressure” is not the final probability increase.

Collection completion adds 2% to every rarity above the completed tier (×1.5 in Collector Week). Upgrade/prestige use rarity index. Skills only affect Covert/Special/Contraband. Events can triple Special weights (Knife Weekend). Event rarity multipliers are capped 0.5–5.

### 8.3 Float/wear

Actual item generation calls `randomFloatForSkin()` using the base 1/3/5/2/4 condition weights filtered by valid skin float range, then samples within the selected range. Wear Tuning and Float Tuning are not in this path. Trade-up float correctly uses normalized average input float and output range.

### 8.4 Sales

```text
rawBonus = Analyst × MarketSignal × DiamondHands × SkillSell × CollectionWeaponBonus
baseRate = 0.85 + 0.10 × liquidity^0.45
finalRate = clamp(baseRate × max(0.8, rawBonus), 0.85, 0.95)
sale = current pattern-aware fair value × finalRate
```

Collection weapon bonus is `1 + 1% × CollectorWeekMultiplier` for the matching completed weapon catalog. Maximum non-collection raw progression is `1.08 × 1.075 × 1.60 × 1.11 ≈ 2.062`. Because finalRate caps at 0.95, late bonuses overlap almost completely.

### 8.5 Automation speed/income

- Timed opener/desk/farm/bot: product of upgrade, prestige, and skill interval multipliers; 0.3555 achievable.
- Auction: own level formula only; generic speed bonuses ignored.
- Case Farm cash: base formula × passive skill online; offline currently × passive skill twice × Offline Operator.
- Opening/Desk do not alter drop rates or costs beyond the shared effective case.

### 8.6 Trade-ups

`analyzedInput = realCurrentValue × skillMultiplier × eventMultiplier`. Outcome EV uses current wear/edition price. The multipliers do not change actual inputs consumed, output odds, output value, or output float. They only make analysis and bot eligibility look more profitable.

### 8.7 Capacity

`250 + Warehouse(250/L) + WarehouseRows(100/L) + VaultExpansion(1000/L) + ShowcaseLogistics(150/L)`. Protected existing over-cap inventories are never deleted. Item-generation/purchase paths generally block; escrow return does not.

### 8.8 Events and markets

Game-event scheduling is checked each minute at `min(25%, 4% + bonus)` and uses `1-(1-p)^ticks` offline. The bonus is capped at 20 percentage points and sums Event Hunter, Market Oracle/Market Lab, Trend Scanner, and Market Memory. Market simulation separately has a 2.5% base chance plus the same bonus, while game events are also mirrored into market events. Up to three compatible game events overlap; market direction events are exclusive.

Market values take bounded random walks and timed event impacts, clamped $0.01–$1B. Current market values feed inventory value, sales, trade-up analysis, Auction candidate pricing, and marketplace fair values.

### 8.9 Prestige reward

Base award is multiplied by Prestige Scholar/Engine and Collector Week, capped only indirectly by defined levels/event cap. Collection Full Wear Archive adds two base points but is effectively unreachable due invalid all-wears requirement.

---

## 9. Economy simulations

### 9.1 Verification basis

The repository’s existing deterministic samples used 100,000 openings with seeds 20261019/20/21:

| Case stage | Cost | Item EV | Result/open | Rare rate |
|---|---:|---:|---:|---:|
| Kilowatt | $2.65 | $0.96 | -$1.69 | 1.146% |
| Operation Wildfire | $5.54 | $2.25 | -$3.29 | 0.838% |
| CS:GO Weapon Case | $121.49 | $33.89 | -$87.60 | 0.727% |

Targeted audit tests were run on 2026-11-11: 6 files/22 tests passed (`economyBalance`, prestige, skills, upgrades, offline progress, achievements). The first sandboxed run could not rename Vitest temp cache files; the identical approved run passed.

### 9.2 Work-only baseline

Existing deterministic job model, completing each cooldown immediately:

- Early, 60% performance: $448.67/hour.
- Click Income L3 + Side Job tier 3: $1,067.84/hour.
- Fully upgraded/perfect: $3,814.20/hour.

A 30-minute fresh session can front-load about $238.08 because all four jobs start ready and some repeat during the window.

### 9.3 Reinvestment model

This audit also ran a formula-only deterministic policy (no RNG): add the scenario’s Work income once per day; buy Auto Opener if specified; save for Case Farm L1; buy all licenses cheapest-first; then buy Case Farm levels; grant 24 hours of the resulting **base** farm rate. It deliberately excludes speed/passive bonuses, opening profits/losses, Auction/market gains, and prestige. Purchases happen at the daily boundary, so it is an optimistic upper-bound schedule, not a full gameplay replay.

| Scenario | Work assumption/day | Auto | Farm L1 | All licenses | Farm L10 | Cash day 1 / 7 / 30 |
|---|---:|---:|---:|---:|---:|---:|
| Casual | 30m, $238.08 | day 2 | day 8 | day 10 | day 12 | $338 / $1,417 / $37.88M |
| Regular | 1.5h, $673.01 | day 1 | day 3 | day 5 | day 7 | $423 / $2.30M / $47.78M |
| Dedicated | 4h, $1,794.68 | day 1 | day 1 | day 3 | day 5 | $8,685 / $6.25M / $51.76M |
| Automation-first | 3.2h one-day bootstrap, $1,435.74/day model | after Farm | day 1 | day 3 | day 5 | $8,676 / $6.25M / $51.75M |

The day-30 convergence occurs because max base Farm produces $82,368/hour or $1.9768M/day. Current max skills/speed would be much higher. The model proves acceleration, not exact human completion time.

### 9.4 First prestige estimates

After a player can fund L6 Auto Opener and L6 Opening Desk, base throughput is 1,200 openings/hour. Opening the documented high-value CS:GO Weapon Case and auto-selling at the 95% ceiling would produce roughly $32.20 sale EV/open. In ~20.8 hours it reaches 25,000 cases and about $805k sale earnings; case spend alone is about $3.04M, satisfying the other gates. Case Farm must subsidize the negative opening EV.

Under the reinvestment policy and assuming correct auto-sell configuration/capacity, first-prestige ranges are therefore approximately:

| Player | First automation | Important upgrades | First prestige estimate | Dominant behavior |
|---|---|---|---|---|
| Casual 30m/day | Auto day 2; Farm day 8 | licenses/mid Farm day 10 | ~day 13–16 | Offline Farm, not the 30m session |
| Regular 1–2h/day | Auto day 1; Farm day 3 | all licenses/Farm 5 day 5 | ~day 8–11 | Farm subsidizes automated openings |
| Dedicated 4h+/day | Auto/Farm day 1 | licenses/Farm 5 day 3 | ~day 6–9 | Same curve, earlier bootstrap |
| Automation-focused | Farm first day 1 in modeled 3.2h bootstrap | max Farm day 5 | ~day 6–8 | Clearly strongest route |
| Opening/trading-focused | Auto in ~34 active minutes from Work | upgrades depend on losses | Highly variable; slower without Farm | Opening has negative EV; trade discounts can hide losses |

These are model estimates, not verified save replays. Rare patterns, events, marketplace arbitrage, player availability, inventory rules, and actual purchase order create wide variance. The intended “500–600 hour” comments in source are not consistent with the current Case Farm/offline curve.

### 9.5 Strategy dominance

Automation-first dominates because Case Farm has no input cost, benefits from cheap case-license breadth, runs for 24 offline hours, and funds every other sink. Active opening is deliberately negative EV and cannot compete reliably. Work is a bootstrap/recovery system. Trading Bot does not create dependable value because its profitability metric can be artificially discounted. Auction/market arbitrage can beat intended play but requires interaction.

---

## 10. Exploit and safeguard analysis

### Confirmed

| Finding | Severity | Evidence/safeguard |
|---|---|---|
| Arbitrarily high player-market asking prices can eventually auto-sell | Critical | `listItemOnMarket` has no ceiling; `getPlayerListingAttractiveness` retains score .005 above 1.5× FMV; `tickMarketplace` pays full asking price on sale |
| Auction buy→instant sell arbitrage | High | L6 discounts 10.45–19%; liquidation can be 95% FMV |
| Offline passive skill counted twice | High | `applyOfflineCaseFarm` multiplies both skill functions containing the same branch |
| Trade-up discount can authorize negative-real-EV contracts | High | analysis discounts consumed item value only |
| Upgrade-point prestige softlock | High | UP resets; claimed achievements persist; no repeatable UP source |
| Wear bonuses are dead | Medium | production item creation never calls their helpers |
| Unlimited Auto Opener dead levels | Medium | no max; interval floors at L6 |
| Module max can be exceeded outside UI | Medium | reducer purchase has no max check |
| Escrow return bypasses capacity | Low/Medium | cancel/expiry prepends returned items without capacity check; no deletion, later generation blocks |
| Achievement badges are not granted to a profile | Low | reducer ignores `reward.badge` |

### Suspected/conditional

- **Negotiation→instant-sale arbitrage:** NPC reservation floor is `baseInstantRate × 1.015 × FMV`; max progression liquidation can be 0.95×. Illiquid items with base rate near 0.85 can be negotiated near 0.86275× and liquidated at 0.95×. Availability/asking-price constraints make frequency data-dependent, but the formula permits profit.
- **Clock manipulation:** local time controls offline duration, cooldowns, expiries, and events. The 24h offline cap and persisted timestamps limit ordinary gaps, but a fully client-side save cannot defend against deliberate clock/save editing.
- **Prestige cycling acceleration:** requirements reset correctly, but max Farm and preserved collection/skills make each rebuild extremely fast. This is imbalance rather than an exact-once exploit.

### Prevented

- Case/reward cost and inventory additions are one reducer transaction.
- Achievement and daily claims persist claimed timestamps/status and reject repeats.
- Auction deal is removed after purchase.
- CSWEAR purchase/list/cancel requests use a request ledger and listing removal/escrow.
- Locked/favorited/exceptional items cannot enter trade-ups; auto-sell has rare/protected guards.
- Opening and item purchases stop at inventory capacity rather than deleting items.
- Event overlap is capped at three, duplicate types conflict, market boom/crash are exclusive, and multipliers are bounded.
- Offline progression caps at 24 hours, 25,000 simulation steps, and 20 Trading Bot checks.

---

## 11. UI and gameplay experience audit

### Automation

The player sees Auto Opener, six module cards, module slots, active timers, Auction deals, warehouse capacity, and task totals on one page. Decisions include case choice, purchase level, enable/disable, slot allocation, and Auction purchases. Essential: costs, real output, input costs, slots, pause reason. Confusing: Opening Desk and Auto Opener overlap; “total generated” means cash, cases, or expected profit depending on module; Auction timing UI disagrees with reducer; Case Farm per-tick text hides its hourly/offline scale.

### Upgrades

The page is readable and category-filtered, but it is a second shop for the same discount/sell/speed/capacity/luck concepts. Upgrade-point costs are labeled generic “points” and the source property is misleadingly named `prestigePointCost`. It does not warn that upgrades and upgrade points reset on prestige. Wear Tuning is presented as functional.

### Prestige

Four progress meters and a destructive confirmation clearly communicate the gate. The reset explanation is the most important information, but it does not surface the upgrade-point loss/one-time-achievement consequence, stale trophies, or all collection rewards carrying over. Projected points omit Collector Week. Seven permanent tracks largely repeat the Upgrade/Skill effects.

### Skill Tree

The UI avoids a 139-card horizontal graph by showing nine core cards and one next card for each of 13 branches. This is usable but still requires understanding 17 aggregate effect pills, prerequisites, 13 ten-level tracks, and three currencies across other pages. Since no branches are exclusive, “specialisation” is mostly purchase order. Wear and Cosmetic paths advertise effects that are dead; Market Lab has undocumented extra effects.

### Achievements

117 cards are grouped and Claim All is good. The page shows exact rewards and claimability. It does not show numeric progress toward locked milestones, and several long-term conditions are impossible/misleading. Badges look like durable rewards but are not saved as owned cosmetics.

### Stats

Charts and CSV are useful, but the page mixes lifetime metrics with range-filtered history. “Net profit,” “time played,” rare definitions, and money earned are semantically inconsistent. Automation totals omit Auto Opener levels from the displayed module-level total while showing it separately. The page is diagnostic rather than a clear progression guide.

### Consolidation opportunities (analysis only)

- Combine run upgrades and module upgrades into one clearly resettable “Workshop,” or distinguish them strongly.
- Put automation status/output and automation purchase controls together, with hourly net value rather than mixed totals.
- Make Achievements rewards supplemental, not the only source of a resettable currency.
- Turn Stats into an authoritative ledger before using it for prestige.
- Reduce the same sell/speed/luck effect appearing independently in three shops.

---

## 12. Three redesign directions — no implementation

### Option A — Simplified

**Keep:** cases, inventory/selling, Work, Auto Opener, one passive-income module, achievements, one prestige currency.
**Merge:** Upgrades + Skills into 12–20 clearly permanent perks; Warehouse into inventory upgrades; Opening Desk into Auto Opener batch levels.
**Remove/replace:** upgrade points, dead cosmetic tree, Market Analyst as a slot module, duplicated discount/sell tracks.
**Prestige:** one transparent gate and 5–7 permanent perks; preserve one currency and explicitly reset the run.
**Automation balance:** every module either consumes cash/items or produces capped offline value; Case Farm gets a daily cap/upkeep.
**Pros:** easy onboarding, fewer dead overlaps, easier balance.
**Cons:** less optimization and long-tail progression.

### Option B — Balanced

**Keep:** all core gameplay, Auto Opener, Opening Desk, Case Farm, Trading Bot, Auction, Warehouse, achievements, run upgrades, a smaller skill tree, prestige.
**Merge:** Market Analyst into sell/market research upgrades; combine run speed tracks; one capacity track; one luck track per progression layer at most.
**Remove/replace:** finite resettable upgrade-point trap; Cosmetic path unless it has real unlocks; trade-up fake input discounts.
**Prestige:** preserve upgrade currency or make it repeatably earned each run; award separate SP/PP formulas; show exact reset/preserve list.
**Automation balance:** Case Farm scales from owned production assets/upkeep, not unlocked-case count alone; offline equals online rate; Trading Bot reports realized value; Auction resale margin includes fees/cooldowns.
**Pros:** meaningful builds and manageable depth; best fit for the current game.
**Cons:** requires a migration and full economy retune.

### Option C — Deep

**Keep:** all modules and currencies, market/events/collection interactions, 100+ long-term nodes.
**Merge:** only exact duplicates; retain separate run, specialization, and prestige layers with explicit roles.
**Replace:** passive Case Farm with production chains requiring cases/energy/storage; Trading Bot with risk limits; Market Analyst with forecasts/hedging; Warehouse with logistics; Auction with capital lock and fees.
**Prestige:** multiple reset tiers or seasons, with capped compounding and optional build respec.
**Automation balance:** throughput, capital, risk, storage, and energy constraints; detailed ROI dashboards; authoritative ledger and simulations.
**Pros:** high strategy and long-term optimization.
**Cons:** highest implementation/testing/UI burden and greatest risk of overwhelming new players.

---

## 13. Source map and audit result

Primary implementation references:

- State/actions/defaults: `case-opening-simulator/src/data/gameState.ts`
- Transactions, prestige reset, automation ticks, rewards: `case-opening-simulator/src/data/gameReducer.ts`
- Automation constants/formulas: `case-opening-simulator/src/utils/automation.ts`
- Offline simulation: `case-opening-simulator/src/utils/offlineProgress.ts`
- Run upgrades: `case-opening-simulator/src/data/upgrades.ts`
- Skills: `case-opening-simulator/src/data/skills.ts`
- Prestige: `case-opening-simulator/src/data/prestige.ts`
- Achievements: `case-opening-simulator/src/data/achievements.ts`
- Collection rewards: `case-opening-simulator/src/utils/collectionRewards.ts`
- Inventory/capacity/sales: `case-opening-simulator/src/utils/inventory.ts`, `inventoryCapacity.ts`, `inventoryBulk.ts`
- Trade-ups: `case-opening-simulator/src/utils/tradeUp.ts`
- Work: `case-opening-simulator/src/utils/workMinigames.ts`
- Game events: `case-opening-simulator/src/events/eventManager.ts`
- Market simulation: `case-opening-simulator/src/market/marketSimulation.ts`
- Marketplace: `case-opening-simulator/src/marketplace/marketplace.ts`, `virtualMarket.ts`
- UI: `src/views/Automation.tsx`, `UpgradeShopView.tsx`, `SkillTreeView.tsx`, `PrestigeView.tsx`, `Achievements.tsx`, `StatsView.tsx`
- Existing balance baseline: `case-opening-simulator/docs/economy-balance.md`, `docs/work-economy.md`, `src/utils/economyBalance.test.ts`

No production code, gameplay values, saves, UI, or existing tests were modified. No commit or push was performed.
