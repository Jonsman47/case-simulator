# Economy Balance Audit

Audit date: 2026-10-19

The final balance pass used deterministic simulations and direct formula checks. It did not alter drop odds, saved item values, or existing player progress because the measured systems remained bounded and no infinite reward loop was reproduced.

## Case-opening samples

Each row uses 100,000 deterministic openings against the production catalog and current base market values. The seeds were `20261019`, `20261020`, and `20261021` respectively.

| Progress sample | Case | Cost | Average item value | Average result per opening | Rare-drop rate |
| --- | --- | ---: | ---: | ---: | ---: |
| Early | Kilowatt Case | $2.65 | $0.96 | -$1.69 | 1.146% |
| Mid | Operation Wildfire Case | $5.54 | $2.25 | -$3.29 | 0.838% |
| Late | CS:GO Weapon Case | $121.49 | $33.89 | -$87.60 | 0.727% |

The simulator is intentionally not a guaranteed-profit case loop. Selling, market events, valuable patterns, skills, and prestige can improve individual outcomes, but exact-once deductions and bounded multipliers remain authoritative.

## Work income

The repeatable `economyBalance.test.ts` scenario completes every job immediately when its cooldown expires.

| Scenario | Assumptions | Gross Work income/hour |
| --- | --- | ---: |
| Early | No bonuses, 60% skill-job performance | $448.67 |
| Mid | Click Income level 3, Side Job Route tier 3, 60% performance | $1,067.84 |
| Late | Click Income level 10, Side Job Route tier 10, perfect performance | $3,814.20 |

These are theoretical active-play ceilings that require returning exactly at every cooldown. Rewards are committed by one reducer transaction, cooldown timestamps are persisted, performance is clamped to 0–1, and repeated completion actions during cooldown do not pay again.

## Automation and multiplier bounds

- Case Farm produces $360/hour at level 1 with two unlocked cases, $14,652/hour at level 5 with 20 cases, and $82,368/hour at level 10 with all 42 cases before speed or passive-skill bonuses. The maximum passive-income skill brings the latter base rate to $123,552/hour; reaching it requires the late-game module and skill investment.
- Auction House discounts cap at 24%, listings cap at eight, and refresh time never falls below seven minutes. A discounted item can be sold, but limited refreshes and up-front capital prevent an unbounded same-tick loop.
- Combined non-event sale multipliers remain below 2.1× at the tested maximum Upgrade, Prestige, Market Analyst, auto-sell, and market-skill levels.
- Combined tested automation interval multipliers remain finite and above 0.29× before each module's own hard minimum interval is applied.
- Warehouse capacity prevents unattended systems from silently generating items beyond available storage.
- Rare-pattern premiums are intrinsic, stored once per item, bounded, and never repeatedly compounded by market ticks.

## Decision

No economy constants were changed in Prompt 6. The current numbers are internally consistent and exploit protections are covered by reducer, offline-progress, Auction House, Work, and browser exact-once tests. Long-session human pacing and a real deployed leaderboard remain the two places where further live telemetry could justify a later content-balance patch.
