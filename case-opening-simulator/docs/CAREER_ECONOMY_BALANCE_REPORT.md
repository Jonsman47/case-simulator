# Career Economy Balance Report

Date: 2026-11-14

Game/save baseline: Career Overhaul Prompt 5, schema v37

Reproduction: `npm run simulate:career`

Seed: `3308146696` (`0xC52E5008`)

## Executive summary

The economy remains intentionally asymmetric. Cases are negative expected value, active informed trading has the highest expected cash return, collecting and trade-ups provide competitive Career progress through milestones, and employees exchange attention for lower returns rather than creating money. The measured competent-regular path reaches Career level 15 in a median 25.82 engaged hours and the proposed first Prestige gate (level 25 plus a path goal) in 63.17 hours. A five-run tier path at levels 25/30/36/45/55 projects 781.10 competent-regular engaged hours. This supports the requested 500–800-hour mastery target at the upper edge without requiring level 100 every run.

Two targeted production changes were justified:

1. The cumulative XP curve changed from `1000(L-1)^1.72 + 2500 max(0,L-25)^1.28` to `850(L-1)^1.66 + 5000 max(0,L-25)^1.30`. Level 15 falls from 93,614 to 67,919 XP and level 25 from 236,572 to 166,176 XP, while level 100 remains a major 3,115,980-XP achievement (formerly 3,335,112).
2. Legitimate ledger-backed employee operations completed by offline progression now create the same bounded, exact-once Business XP events as online operations. Replaying the offline state does not award XP again.

No case rarity weights, float ranges, Pattern rules, market prices, employee costs, wages, upgrade costs, fees, or trade-up outcome rules were changed. The measured systems were safe enough to retain; the final Prestige implementation remains deferred to Prompt 6.

## Methodology and limitations

The simulation framework lives in `src/simulation/careerEconomy/` and is excluded from the application bundle. It uses a deterministic Mulberry32 stream and reuses production functions for:

- case drop selection, wear/float generation, edition eligibility, condition prices and Pattern classification/value;
- Career level thresholds;
- all 95 Career upgrade definitions and cost calculations;
- all five employee hire/training/wage/interval formulas;
- deterministic virtual-market pages and credible-deal scoring in CI cross-checks.

The full run executed 300,000 aggregate careers: 10 profiles × 3 decision qualities × 10,000 samples. It also executed 500,000 item-level openings: five generated production cases × 100,000. Runtime was 6.02 seconds for the simulation body and bounded memory was dominated by one 100,000-number reward sample at a time.

Career runs are a calibrated aggregate stochastic model, not 800 hours of reducer ticks. Session mix, market availability and decision quality are approximated from production XP awards, cooldowns, scheduler caps, wages and fee rules. Agents never see future RNG or seller reservation values. Cash/net-worth projections are directional and should not be described as telemetry. Reducer-level exact-once, scheduling, fees, trade-up opportunity cost and transaction invariants remain covered by unit/browser tests.

## Baseline and after tuning

| Milestone (competent regular) | Old curve | Tuned curve | Target | Result |
|---|---:|---:|---:|---|
| Level 15 / basic employee | ~35.6 h | 25.82 h median (22.12–30.92 p10–p90) | 15–35 h | Supported |
| First proposed Prestige level gate | ~89.9 h | 63.17 h median (54.13–75.66) | 40–70 h | Median supported; slow tail intentionally exceeds |
| Level 100 in one run | ~1,268 h | 1,184 h median | Not required for first Prestige | Remains exceptional |
| Five proposed Prestige runs | >800 h | 781.10 h | 500–800 h | Supported at upper edge |

The tuning deliberately improves early progression more than late progression. It does not multiply every XP source or make repetitive automation competitive with active decisions.

## Strategy measurements

Competent-decision medians from 10,000 careers per row:

| Profile | XP/h median | Level 15 h | First gate h | Level 100 h | Net worth at 800 h median | Stall rate |
|---|---:|---:|---:|---:|---:|---:|
| Casual | 1,393 | 48.75 | 119.29 | 2,236.73 | $178,534 | 0% |
| Regular | 2,631 | 25.82 | 63.17 | 1,184.41 | $482,945 | 0% |
| Dedicated | 3,739 | 18.17 | 44.45 | 833.47 | $748,114 | 0% |
| Expert trader profile | 4,494 | 15.11 | 36.98 | 693.44 | $1,394,380 | 0% |
| Opening-focused | 2,273 | 29.89 | 73.12 | 1,371.08 | $0 | 2% |
| Collector | 2,942 | 23.09 | 56.48 | 1,059.15 | $149,681 | 0% |
| Trade-up specialist | 3,140 | 21.63 | 52.92 | 992.38 | $537,649 | 0% |
| Business specialist | 2,852 | 23.81 | 58.26 | 1,092.44 | $438,416 | 0% |
| Pattern hunter | 2,693 | 25.22 | 61.71 | 1,157.06 | $659,512 | 0% |
| Automation-heavy | 1,184 | 57.35 | 140.31 | 2,630.94 | $313,560 | 0% |

The automation-heavy profile does not dominate active expert trading. Opening remains economically lossy and its low median cash outcome is a real sustainability warning, not something hidden by artificial positive EV. Work, sales and selective market use remain the recovery path. Pattern hunting has the widest cash distribution and nonzero bankruptcy risk because rare supply is not guaranteed.

Novice/expert sensitivity behaves as intended. For regular play, first-gate medians were 82.82/63.17/52.51 hours. For opening-focused play they were 96.47/73.12/61.04. For automation-heavy play they were 184.72/140.31/116.75, ensuring passive operation trades attention for slower Career progress.

## Case-opening economics

Five production generated cases were sampled with independent deterministic seeds. CS2 drop tables and float/Pattern functions were not modified.

| Case | Opens | Cost | Mean reward | Median | Return | Mean profit/open | Rare rate | P90 | Maximum observed |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Kilowatt Case | 100,000 | $2.65 | $1.15 | $0.05 | 43.40% | -$1.50 | 1.151% | $0.78 | $776.49 |
| Danger Zone Case | 100,000 | $3.69 | $1.64 | $0.21 | 44.44% | -$2.05 | 0.867% | $3.23 | $1,170.45 |
| Operation Wildfire Case | 100,000 | $5.54 | $3.43 | $0.79 | 61.91% | -$2.11 | 0.844% | $4.68 | $2,206.00 |
| Operation Riptide Case | 100,000 | $12.47 | $5.44 | $1.07 | 43.62% | -$7.03 | 0.757% | $8.27 | $7,400.00 |
| CS:GO Weapon Case | 100,000 | $121.49 | $40.96 | $15.17 | 33.71% | -$80.53 | 0.687% | $120.00 | $25,500.00 |

The results are heavily right-skewed: a lucky Pattern or rare item can be valuable, but all representative cases remain strongly negative EV. Opening upgrades affect research, presentation, planning and bounded employee throughput; they do not alter rarity probability.

## Money sources, sinks and softlocks

Authoritative sources remain Work, daily/achievement rewards, item/market sales and realized business transactions. Inventory appreciation is unrealized value, not cash profit. Sinks remain cases/licenses, purchases, Auction transactions, upgrade purchases, employee hire/training/payroll and trade-up opportunity cost.

The $100 fresh start and cooldown-backed Work jobs prevent a cash softlock. Employee wages are avoidable: employees pause when allocated capital cannot cover payroll and cannot create negative balances. Allocations are transfers, not expenses or income. Opening-focused bankruptcy/stall results show why first Prestige must accept collection progress and why Work must remain available; the answer is not positive-EV cases.

## Employee economy

The audit evaluated 45 role/level points (five roles × levels 0–8). Hire costs remain $2,500, $5,375, $11,556, $24,846 and $53,418. Every row has a positive wage and `directCashCreation = 0`. Training improves bounded intervals and role-specific coverage/batches; it never guarantees an opportunity.

| Role | Economic purpose | Level-0 wage | Level-8 wage | Level-0→8 interval | Balance conclusion |
|---|---|---:|---:|---:|---|
| Case Operator | Paid openings/collection convenience | $25/h | $138/h | 30s→12s | Negative EV by design; stop-loss and shift cap essential |
| Sales Assistant | Liquidity and routine listing labor | $29/h | $159/h | 60s→24s | Time-saving, not profit creation; protected items excluded |
| Market Scout | Bounded information discovery | $34/h | $186/h | 300s→120s | ROI depends on player action; zero-alert periods are legitimate |
| Trade-Up Specialist | Honest ordinary-contract execution | $40/h | $221/h | 120s→48s | No execution without positive EV/risk rules; high value pauses |
| Junior Trader | Budgeted ordinary acquisitions | $45/h | $248/h | 180s→72s | Five/day and exposure/confidence limits prevent passive dominance |

No cost change was supported by the evidence. The meaningful value of Scout/Sales roles is information or saved attention, so a fabricated cash ROI would be misleading. Wages remain material, high-level throughput is bounded by daily limits/capital/supply, and active experts outperform passive profiles.

## CSWEAR and trade-up findings

Deterministic page tests confirm stable listing IDs and credible-deal ordering. Best Deals discounts low-confidence valuations rather than treating them as guaranteed arbitrage. Production safeguards continue to block absurd automatic listing sales, unavailable/purchased IDs, repeated request IDs, own-counterparty Career XP, and Junior Trader special Patterns. Rare Pattern supply can be zero; Scout scans never modify supply.

Trade-up analysis continues to use the full current opportunity cost of consumed items. `inputCostMultiplier` is ignored for profitability, so skills/upgrades cannot make a losing contract look profitable. Ordinary ten-item and five-Covert rules remain unchanged; exceptional Patterns are protected and special-output contracts stay manual. Expected value is not guaranteed realized value, and the Specialist must satisfy EV, ROI, daily value and confirmation gates.

## XP and exploit review

- Manual/automated openings retain separate hourly soft caps (20/12) and the 0.2 multiplier floor.
- Discoveries use lifetime hashed identities; duplicate skins cannot repeat first-discovery XP.
- Market XP requires a completed external sale with cost basis; cancellations, transfers, admin grants and revaluation award none.
- Trade-ups use output instance IDs plus a six-hour signature window.
- Business XP requires a completed operation with positive gross volume and stable operation ID. Offline operations now use the same route.
- Achievements require a newly claimed ID and legacy claims are excluded.
- Save replacement/import, reset and Prestige never replay XP events.

Confirmed Prompt-5 issue fixed: offline Business work previously earned no XP even though it produced authoritative operations. No new money duplication, buy→sell guarantee, payroll replay, budget release duplication, scheduler overlap or hidden legacy modifier stack was reproduced. Suspected but not client-preventable: a player can edit a fully local save or system clock; the PWA does not claim server-authoritative anti-cheat.

## Upgrade balance — all 95 nodes

The executable audit recalculates every level with the production curve `baseCash × 1.72^L × rankMultiplier`, verifies a nonempty consumer/effect, and reports the total max-level cost. The complete descriptive catalog, prerequisites, branch XP gate, effect and consumer are in `CAREER_UPGRADE_SYSTEM.md`; this table records the Prompt-5 cost decision. “Keep” means the current curve remains proposed after simulation. Discount/speed nodes remain monitored because they compound, but all current effects have safe caps.

| Upgrade ID | Gate | Max | Total current/proposed cost | Decision |
|---|---:|---:|---:|---|
| case-opening.presentation-drive | 1 | 3 | $1,704 | Keep |
| case-opening.batch-controls | 3 | 4 | $6,998 | Keep |
| case-opening.repeat-presets | 5 | 3 | $5,111 | Keep |
| case-opening.favorite-presets | 7 | 3 | $6,246 | Keep |
| case-opening.queue-planner | 10 | 3 | $9,369 | Keep |
| case-opening.ev-basics | 8 | 1 | $1,430 | Keep |
| case-opening.probability-table | 12 | 1 | $2,300 | Keep |
| case-opening.cost-planner | 15 | 2 | $8,486 | Keep |
| case-opening.loss-bands | 20 | 1 | $5,000 | Keep |
| case-opening.price-history | 25 | 3 | $40,601 | Keep |
| case-opening.drop-journal | 15 | 1 | $2,530 | Keep |
| case-opening.missing-highlights | 22 | 1 | $5,625 | Keep |
| case-opening.duplicate-forecast | 35 | 2 | $30,464 | Keep |
| case-opening.operator-batching | 35 | 3 | $57,494 | Keep |
| case-opening.operator-budget-profiles | 40 | 3 | $78,220 | Keep |
| case-opening.stop-loss-controls | 45 | 2 | $48,960 | Keep |
| case-opening.capacity-brake | 50 | 3 | $132,023 | Keep; safety utility |
| case-opening.session-audit | 75 | 1 | $80,000 | Keep |
| trading.price-confidence | 1 | 1 | $500 | Keep |
| trading.spread-view | 4 | 1 | $850 | Keep |
| trading.liquidity-analysis | 8 | 3 | $9,369 | Keep |
| trading.trend-context | 12 | 4 | $24,764 | Keep |
| trading.pattern-research | 18 | 3 | $28,392 | Keep |
| trading.float-comparison | 15 | 2 | $9,792 | Keep |
| trading.saved-searches | 10 | 4 | $21,318 | Keep |
| trading.filter-presets | 14 | 4 | $29,716 | Keep |
| trading.scout-watchlists | 35 | 5 | $126,873 | Keep |
| trading.scout-coverage | 35 | 5 | $171,279 | Keep |
| trading.deal-indicators | 40 | 3 | $63,598 | Keep |
| trading.listing-history | 42 | 4 | $140,507 | Keep |
| trading.listing-capacity | 35 | 5 | $184,454 | Keep |
| trading.fee-desk | 45 | 5 | $351,342 | Keep; cap monitored |
| trading.price-presets | 30 | 4 | $76,983 | Keep |
| trading.expiry-management | 45 | 3 | $82,337 | Keep |
| trading.seller-reputation | 20 | 1 | $5,000 | Keep |
| trading.patience-estimate | 38 | 3 | $67,573 | Keep |
| trading.offer-range | 50 | 3 | $123,221 | Keep |
| trading.counter-history | 55 | 3 | $163,538 | Keep |
| trading.inventory-bridge | 50 | 1 | $18,000 | Keep |
| trading.research-terminal | 75 | 1 | $165,000 | Keep |
| collecting.missing-filter | 1 | 1 | $400 | Keep |
| collecting.wear-analysis | 6 | 3 | $7,155 | Keep |
| collecting.pattern-classification | 12 | 3 | $16,325 | Keep |
| collecting.discovery-journal | 10 | 1 | $1,980 | Keep |
| collecting.duplicate-guard | 10 | 4 | $23,687 | Keep |
| collecting.folders | 15 | 5 | $62,851 | Keep |
| collecting.labels | 18 | 4 | $41,345 | Keep |
| collecting.reservation-tools | 22 | 4 | $53,834 | Keep |
| collecting.priority-lists | 25 | 4 | $69,985 | Keep |
| collecting.storage-cases | 30 | 5 | $158,104 | Keep |
| collecting.trophy-expansion | 35 | 5 | $204,949 | Keep |
| collecting.display-templates | 40 | 4 | $140,507 | Keep |
| collecting.exhibitions | 50 | 4 | $233,641 | Keep |
| collecting.achievement-display | 45 | 4 | $161,503 | Keep |
| collecting.reputation | 55 | 5 | $644,126 | Keep |
| collecting.legacy-catalog | 75 | 1 | $126,000 | Keep |
| trade-ups.expected-value | 1 | 1 | $600 | Keep |
| trade-ups.opportunity-cost | 5 | 1 | $1,000 | Keep |
| trade-ups.outcome-distribution | 10 | 3 | $11,243 | Keep |
| trade-ups.probability-breakdown | 14 | 3 | $15,672 | Keep |
| trade-ups.float-mapping | 16 | 3 | $20,442 | Keep |
| trade-ups.roi-analysis | 18 | 1 | $4,200 | Keep |
| trade-ups.worst-case | 25 | 1 | $6,500 | Keep |
| trade-ups.saved-templates | 12 | 5 | $42,942 | Keep |
| trade-ups.collection-search | 15 | 3 | $18,284 | Keep |
| trade-ups.inventory-filters | 18 | 4 | $41,345 | Keep |
| trade-ups.contract-comparison | 25 | 4 | $69,985 | Keep |
| trade-ups.input-optimizer | 35 | 3 | $63,598 | Keep |
| trade-ups.risk-presets | 32 | 4 | $101,747 | Keep |
| trade-ups.specialist-throughput | 40 | 4 | $140,507 | Keep |
| trade-ups.candidate-scanning | 42 | 4 | $156,119 | Keep |
| trade-ups.budget-controls | 45 | 3 | $102,211 | Keep |
| trade-ups.safe-execution | 55 | 3 | $187,387 | Keep |
| trade-ups.five-covert-research | 75 | 1 | $176,000 | Keep |
| business.operating-desk | 15 | 3 | $36,910 | Keep |
| business.training-plans | 20 | 5 | $158,104 | Keep; cap monitored |
| business.schedule-profiles | 15 | 4 | $53,834 | Keep |
| business.budget-policies | 18 | 4 | $60,564 | Keep |
| business.shift-planning | 25 | 3 | $53,661 | Keep |
| business.scheduler | 35 | 5 | $283,025 | Keep; cap monitored |
| business.operation-batching | 40 | 4 | $193,803 | Keep |
| business.pause-policies | 30 | 3 | $63,598 | Keep |
| business.warehouse-racks | 25 | 5 | $218,613 | Keep |
| business.listing-infrastructure | 35 | 5 | $254,723 | Keep |
| business.operations-reporting | 20 | 3 | $36,910 | Keep |
| business.expense-analysis | 30 | 3 | $59,623 | Keep |
| business.roi-reporting | 40 | 3 | $93,694 | Keep |
| business.cashflow-projection | 50 | 3 | $132,023 | Keep |
| business.overhead-controls | 55 | 5 | $644,126 | Keep; cap monitored |
| business.case-operator-desk | 35 | 3 | $82,337 | Keep |
| business.sales-workflow | 40 | 3 | $102,211 | Keep |
| business.scout-network | 45 | 4 | $233,641 | Keep |
| business.contract-lab | 50 | 4 | $275,631 | Keep |
| business.junior-desk | 55 | 4 | $319,775 | Keep |
| business.executive-suite | 75 | 1 | $230,000 | Keep |

The acquisition-time estimate is the gate time in the strategy table plus the time to accumulate the listed cash at that strategy's realized rate. It is intentionally not a single universal number: a $351k fee desk is much earlier for a trader than an opener, while a collector can prioritize low-cost organization tools. No cross-branch purchase is mandatory for the proposed Prestige alternatives.

## Conclusion and residual uncertainty

The evidence supports the 500–800-hour goal only as cumulative multi-Prestige mastery. It does not support requiring level 100 every run. First Prestige should use level 25 and a branch goal; later gates should be 30/36/45/55 with bounded permanent acceleration. The current 3.2× universal economic scaling is rejected. Exact long-run market profit, liquidity and employee information value remain uncertain without real player telemetry, and the local client cannot prevent deliberate save editing. Prompt 6 should implement the accompanying specification without altering CS2 odds or fabricating historical progress.
