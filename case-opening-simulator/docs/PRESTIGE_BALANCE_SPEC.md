# Prestige Balance Specification (Prompt 6 Input)

Status: implemented in save schema v38. Runtime details and migration policy are documented in `PRESTIGE_SYSTEM.md`.

Evidence: `CAREER_ECONOMY_BALANCE_REPORT.md`, seed `3308146696`, 300,000 aggregate careers and 500,000 item-level case openings.

## Design goals

Prestige is a deliberate career chapter reset, not a punishment and not an instant loop. It must accept opening/collecting, trading, Pattern hunting, trade-ups or Business as valid mastery paths. One lucky item may help net worth but cannot satisfy activity breadth. A market crash cannot remove already earned run milestones. Level 100 is an optional legendary single-run achievement, not a first-Prestige gate.

## Five-tier gates

| Tier earned | Minimum run level | Competent regular modeled run hours | Required score | Path goals required |
|---|---:|---:|---:|---:|
| 1 | 25 | 63 | 70 | 1 primary + 1 supporting |
| 2 | 30 | 93 with 1.10× acceleration | 74 | 1 primary + 1 supporting |
| 3 | 36 | 134 with 1.20× | 78 | 1 primary + 2 supporting |
| 4 | 45 | 205 with 1.30× | 82 | 1 primary + 2 supporting |
| 5 | 55 | 286 with 1.40× | 86 | 2 primary + 2 supporting |

Total modeled competent-regular mastery is 781 engaged hours. Acceleration is applied only to run XP, capped as shown, and never changes money, case odds, item values or market RNG.

## Score formula

Reject the earlier fixed 30/25/20/15/10 weighted score because it forces every path and lets a lucky valuation dominate. Use:

`PrestigeScore = 0.35 × level + 0.25 × bestPath + 0.15 × secondPath + 0.10 × breadth + 0.10 × solvency + 0.05 × stewardship`

Each component is 0–100 and clamped before weighting.

- `level`: progress between the tier's minimum level and its stretch level (+10 levels).
- `bestPath` and `secondPath`: highest two normalized path-goal scores; the second path can be a supporting goal.
- `breadth`: distinct meaningful ledger-backed activity categories, capped at five. It does not require equal branch XP.
- `solvency`: nonnegative wallet, no overdue payroll, and net worth target using a capped log scale. A single item contributes at most 40 points here until realized or retained through a minimum holding window.
- `stewardship`: no unresolved escrow/conflict/pending approval and no negative business allocation.

Eligibility requires the tier level, score threshold, required path goals, no unresolved save conflict, no pending marketplace acquisition, no unresolved employee approval, and explicit confirmation. Positive trading profit is not universally mandatory.

## Path goals

Numbers are provisional Prompt-6 constants and should be represented as typed definitions with tests.

### Opening & Collecting

Primary: a tier-scaled number of paid openings plus unique discoveries, with at least one meaningful rarity/wear/Pattern milestone. Supporting: collection percentage or current-run discovery count. Auto openings count at half rate and cannot satisfy the unique milestone alone.

### Trading & Flipping

Primary: positive realized profit from at least a tier-scaled number of unrelated external counterparties/items. Supporting: gross volume with a positive risk-adjusted margin. Unrealized appreciation and self/owned-surface transfers do not count.

### Pattern Hunting

Primary: verified current-run special Pattern discoveries or acquisitions retained through a bounded review window. Conservative estimated Patterns count less than market-grounded observations. Zero-supply periods never create fake progress.

### Trade-Ups

Primary: completed legitimate contracts across multiple signatures with honest opportunity cost; at least one profitable or advanced result at higher tiers. Supporting: contract volume or collection breadth. Repeated identical signatures diminish.

### Business Management

Primary: positive ledger-backed business contribution after payroll and expenses across at least two roles. Supporting: trained roles, completed operations or maintained runway. Hiring alone and idle scans do not count.

## Prestige Points

Use a bounded formula without logarithmic profit dominance:

`PP = floor(base[tier] + scoreBonus + pathBonus + firstTimeBonus)`

- `base = [3, 5, 8, 12, 17]`
- `scoreBonus = clamp(floor((score - threshold) / 5), 0, 4)`
- `pathBonus = clamp(completedPrimaryPaths - requiredPrimaryPaths, 0, 2)`
- `firstTimeBonus = 1` only the first time each tier is reached

Expected awards are 4–8, 6–10, 9–13, 13–17 and 18–22. Repeating a completed tier yields at most its base plus score/path bonuses and cannot repeat the first-time bonus.

## Permanent perks and acceleration

Permanent perks must be bounded and primarily improve rebuilding convenience/research:

- run XP acceleration: +5% per relevant perk level, global cap 40%;
- starting cash: fixed tier-scaled grants, capped below the first meaningful business purchase;
- research retention: limited analysis/preset unlocks, never odds or hidden future information;
- inventory/Legacy Vault capacity: fixed slots, no multiplier;
- fee/payroll improvements: combined permanent + run discount must respect existing production floors;
- no permanent case rarity, float or Pattern-probability bonus.

No perk may create positive-EV case opening or guaranteed market/trade-up profit.

## Reset and preservation

Reset: ordinary wallet (replace with tier starting grant), run inventory except selected Vault items, employee ownership/training/budgets, run Career XP/levels, run Career upgrades, current-run discovery book, active events, temporary buffs and ordinary business infrastructure.

Preserve: Prestige tier/points/perks, lifetime Career XP/statistics/ledger aggregates, achievements and claim state, lifetime collection discoveries, lifetime records, cosmetics/titles, cloud identity/revision metadata, and bounded Legacy Vault items. Archive a compact run summary before mutation.

Never silently delete valuable items. The confirmation screen must list every retained and reset category, require explicit Vault selection, block while escrow/pending acquisitions exist, and create a local recovery backup before committing.

## Legacy Vault

- Base capacity: 1 item; bounded permanent expansion to 10.
- Locked/favorite status does not automatically consume a Vault slot; the player explicitly selects.
- Escrow, pending acquisitions and items already absent from inventory are ineligible.
- Preserve instance ID, float, Pattern, edition, acquisition cost basis and discovery timestamp.
- Vault items do not provide starting cash and cannot be repeatedly re-discovered for XP.
- Selling a Vault item later uses its preserved cost basis and normal fees.

## Collection Book

All Time is append-only discovery identity across Prestiges. Current Run resets after the archived run summary is written. Lifetime discovery XP cannot repeat; Current Run may award a smaller bounded rediscovery milestone in Prompt 6, keyed by run ID. Invalid/unavailable wear conditions never count toward completion.

## Exploit protections

- One exact-once Prestige request ID and one run-transition ledger record.
- New run ID created atomically; replay returns the existing result.
- PP award stored in the archived run summary and cannot be recomputed for the same run.
- Transition backup and migration markers cannot regenerate credit.
- Score uses realized ledger profit and bounded valuation; transfers are excluded.
- Pending capital, payroll, escrow, acquisitions, negotiations and approvals must be resolved.
- Clock changes cannot reduce a recorded earned tier or replay a first-time bonus.
- Client-side save editing remains outside the security promise.

## Prompt 6 implementation checklist

Implement typed tier/path/perk definitions, score selectors, eligibility explanations, atomic reducer transition, Vault selection, run archive, All Time/Current Run switch, v38 migration if required, cloud round trips, exact-once tests, recovery backup, and browser confirmation tests. Re-run the same simulation seed after implementation and compare actual tier gates with this specification. Do not reuse the legacy universal 3.2× economic target multiplier.
