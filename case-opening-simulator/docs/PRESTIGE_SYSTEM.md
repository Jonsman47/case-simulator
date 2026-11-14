# Prestige System (Save Schema v39)

## Purpose

Prestige is a deliberate career chapter reset. It archives a completed run, awards bounded permanent Prestige Points (PP), preserves a small explicitly selected Legacy Vault, and starts a materially fresh economy. It does not alter official case odds, fabricate Pattern value, or turn wealth alone into eligibility.

## Five tiers

| Tier | Name | Run level | Score | Path requirement | Base PP |
|---|---|---:|---:|---|---:|
| 1 | Fresh Start | 25 | 70 | 1 primary + 1 support | 3 |
| 2 | Established Operator | 30 | 74 | 1 primary + 1 support | 5 |
| 3 | Professional Reset | 36 | 78 | 1 primary + 2 support | 8 |
| 4 | Mogul Reinvestment | 45 | 82 | 1 primary + 2 support | 12 |
| 5 | Legendary Legacy | 55 | 86 | 2 primary + 2 support | 17 |

After Tier 5, additional runs repeat Tier 5. The first-time tier bonus cannot repeat, history remains bounded, and permanent perks have hard caps.

The five typed paths are Case Opening & Collecting, Trading, Pattern Hunting, Trade-Ups, and Business. Every objective is calculated from current-run counters, Career discoveries, or the authoritative economy ledger. The Prestige screen shows the exact numerator and target for primary and support objectives.

## Score and PP

Each component is clamped to 0–100 before weighting:

`score = .35 level + .25 bestPath + .15 secondPath + .10 breadth + .10 solvency + .05 stewardship`

`PP = base[tier] + clamp(floor((score-threshold)/5), 0, 4) + clamp(extraPrimaryPaths, 0, 2) + firstTimeTierBonus`

The one-point first-time bonus is granted only while advancing the highest completed tier. Event and retired Skill Tree multipliers do not multiply PP.

## Atomic reset and safety

The UI creates a full current-schema (v39) save envelope in a dedicated local recovery key and reads/parses it back before dispatching the reset. If storage or verification fails, nothing resets. The reducer additionally requires `backupVerified`, a stable request ID, and a valid Vault selection. Completed request IDs are retained in a bounded exact-once ledger.

Prestige is blocked while any player listing is in escrow, a marketplace acquisition is awaiting claim, a negotiation is open, an employee contract awaits approval, or the provider has a cloud conflict. The reducer rechecks gameplay blockers at commit time.

## Legacy Vault

The Vault begins with one slot. Its permanent perk adds one slot per level to a hard maximum of ten. Selection is explicit in the confirmation flow. A vaulted item preserves its instance ID, skin ID, edition, float, Pattern/paint seed, market metadata, lock/favorite flags, discovery timestamp, and ledger acquisition cost basis. It is not cloned into an additional reward and cannot be selected from marketplace escrow.

## Reset policy

Reset: cash (to the bounded permanent starting amount), non-vault run inventory, current-run XP and anti-farm windows, all run-based Career upgrades except the explicitly bounded Research Notes retention, employees/budgets/schedules, business facilities, case licenses/unlocks, current-run collection discoveries, temporary events, Work cooldowns, recent drops, and run statistics.

Preserve: Prestige tier/run count/PP/perks, lifetime Career XP and rank records, achievements, All Time Collection, collection rewards, lifetime economy aggregates, archived economy summaries, compact Prestige run history, settings, tutorial state, migration markers, and exact Vault items.

## Permanent perks

- Career Momentum: +5% Career XP/level, capped at +40%; it affects awarded XP after anti-farm reduction and never money or RNG.
- Seed Capital: fixed +$250/level, maximum five levels.
- Research Notes: retains `floor(level × retention)` per run-upgrade node, at 5%/level and a 25% cap.
- Legacy Vault: one extra slot/level, total cap ten.
- Operations Manual: -2% employee payroll/operating wage/level, capped at 10%, stacking multiplicatively after bounded Career payroll discounts.
- Legacy Insignia: cosmetic-only permanent progression.

## Collection and history

Collection Book now exposes `All Time` and `Current Run`. All Time is permanent. Current Run is a separate persisted set cleared only by a completed Prestige. v37 and older discoveries are migrated to All Time; because their original run cannot be proven, Current Run starts empty and the UI explains the limitation.

Pattern novelty uses a normalized identity containing skin ID, edition (standard/StatTrak/Souvenir), wear, Pattern family, Pattern tier, and classification name. Stored keys remain compact hashes. No old item is rerolled.

Prestige history stores only 24 compact run summaries: run/request IDs, timing, tier, score, PP, ending cash/value, run XP, completed paths, and vaulted item IDs. The economy ledger independently archives its bounded financial run summary.

## Migration and cloud compatibility

v37→v38 creates the Prestige state and empty Current Run Collection without changing money or item identity. Existing prestige count maps to completed runs and highest tier (capped at five); old bonus levels remain loadable for compatibility. Current cloud envelopes use v39 and preserve the same request/run lineage. Real Supabase operation still requires configured credentials and is not implied by local-backend tests.

Prompt 7 adds the idempotent v38→v39 integration migration. It records cumulative PP earned and spent from authoritative current PP plus existing permanent perk levels, while preserving the tier, completed runs, Vault, request lineage, and all inventory identity. New run archives also record highest Career level, realized profit, discovery count, and Business result; older archives display unavailable fields honestly. Lifetime achievements survive Prestige. Current Run achievements carry the Career run ID, are removed only after a successful reset, and may pay their bounded reward once in the new run. Achievement rewards never mint PP. The complete integration policy is documented in `CAREER_INTEGRATION_REPORT.md`.
