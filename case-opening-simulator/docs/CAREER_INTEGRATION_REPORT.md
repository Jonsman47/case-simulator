# Career Integration Report

Status: Career Overhaul Prompt 7 implementation
Save schema: v39
Audit date: 2026-11-14

## 1. Navigation before and after

Before Prompt 7 the progression menu exposed five overlapping destinations: Career, Business, Prestige, Achievements, and Statistics. Historical `/automation`, `/upgrades`, and `/skill-tree` links also remained in circulation even though their mechanics had already moved to Business and Career.

The final Progression menu contains exactly four destinations:

1. Business — employees, operating capital, policies, facilities, and operation reporting.
2. Career & Upgrades — Career XP, ranks, five upgrade specializations, and all 95 Career upgrades.
3. Prestige — eligibility, tier/path score, PP, permanent perks, Legacy Vault, and reset confirmation.
4. Achievements & Stats — the achievement catalog, financial/Career/Business/Prestige reporting, and recent Career chapters.

`/progress` is the canonical combined destination. `/achievements` redirects to `/progress?tab=achievements`; `/stats` redirects to `/progress?tab=stats`; `/achievements-stats` redirects to `/progress`. Existing `/automation`, `/upgrades`, and `/skill-tree` redirects remain directed to their working replacements. Browser Back and deep links are covered by Playwright.

## 2. Achievement audit

The audited catalog now contains 151 stable definitions: 130 active and 21 retired compatibility records. The pre-integration catalog contained 117 definitions, so Prompt 7 adds 34 Career-era milestones. Two existing objectives received material rule corrections: realized profit is ledger-backed, and wear completion uses only genuinely obtainable variants.

The audit identified three obsolete families: retired Automation modules, the legacy Skill Tree/run-upgrade tracks, and obsolete high-count Prestige milestones. Their IDs and any stored completion/claim records remain readable, but their conditions are disabled and the UI labels completed copies as Legacy records. They cannot unlock or pay again.

The active catalog is presented through six player-facing categories:

- Case Opening
- Trading
- Collecting
- Trade-Ups
- Business
- Career & Prestige

New milestones cover ledger-backed realized profit, CSWEAR negotiations and sales, lifetime collection discovery tiers, special Pattern research, profitable Trade-Ups, all five employee roles and meaningful operations, Career rank levels, all five Prestige tiers, permanent perk investment, Legacy Vault use, and nine bounded Current Run challenges.

## 3. Obtainable wear rules

`collection_wear_master` no longer assumes that every skin supports all five conditions. Its denominator and progress walk the catalog's real minimum/maximum float and imported wear ranges via the authoritative wear helper. A restricted-range skin contributes only the conditions that can actually be rolled. Tests cover a 0.00–0.08 skin and confirm that only Factory New and Minimal Wear are counted.

The Collection Book retains its existing discovery records; no historical entry or item identity is rewritten.

## 4. Lifetime and Current Run scope

Lifetime is the default scope. A Lifetime completion remains after Prestige and its reward is permanently exact-once.

Current Run definitions explicitly store both `scope: currentRun` and the active Career `runId`. Prompt 7 includes nine Current Run goals. Prestige removes the finished run's Current Run progress while preserving all Lifetime records and all unknown historical IDs. The next run can unlock and claim a Current Run goal once under its new run ID. Rewards are intentionally modest and cannot bypass Prestige Points.

The UI labels Lifetime, Current Run, Completed, Claimable, Claimed, Locked, and retired Legacy records. Filters expose All, Available, In Progress, Completed, Claimable, Lifetime, and Current Run.

## 5. Reward handling and compatibility

Achievement claims still use the reducer as the only mutation authority. Single claims and Claim All mark stored progress claimed in the same state transition that grants cash. Economy-ledger IDs and Career-XP event IDs include the achievement identity and run identity, preventing retries, reloads, or repeated callbacks from paying twice.

New definitions may explicitly award Career XP. Previously claimed legacy achievements are included in the v35 legacy-ID marker and never gain retroactive XP. Prompt 7 does not fabricate historical XP or payouts.

Legacy rewards that referenced retired Upgrade Points or Skill Points are preserved economically but no longer revive obsolete currencies. At claim time they convert at the established transitional values of $100 per Upgrade Point and $50 per Skill Point. Existing claimed states remain claimed.

Achievements do not award Prestige Points. PP remains primarily earned from completed Prestiges.

## 6. Shared reporting selectors

`src/career/progressionReporting.ts` is the centralized integration layer used by Stats and covered by consistency tests. It reports:

- Career: lifetime/current-run XP, current snapshot, highest level, specialization totals, upgrade levels, and recent milestones.
- Business: hired/active employees, legitimate operations, reserved capital, ledger revenue, operating expenses, payroll, and realized result for lifetime/current run.
- Prestige: tier, runs, PP earned/spent/available, perks, highest score, best XP run, most profitable retained run, Vault record, and retained history.
- Collection: All Time and Current Run unique discoveries and entry counts.
- Finances: current cash, reserved employee capital, inventory, escrow, and economic net worth without double-counting reserved funds.

Financial cash flow remains separate from realized profit and unrealized inventory value. Employee budget allocation is capital reservation, not expense. Wages and completed operations come from authoritative ledger allocations. Historical pre-v34 gaps continue to be labeled incomplete rather than reconstructed.

## 7. Achievements & Stats experience

Achievements and Statistics share one route with two accessible tabs rather than duplicate top-level entries. The achievement screen uses compact cards, six categories, progress bars, explicit requirements, scope labels, claim state, Claim All, and a completion summary. Retired locked definitions are hidden; already-earned retired records remain visible.

Statistics adds an All Time / Current Run reporting switch and integrated panels for Career/Collection, Business/Prestige, financial accounting, and recent Career chapters. Current state metrics such as wallet and reserved capital remain current rather than being misleadingly duplicated by scope.

## 8. Career History

Each new Prestige archive records the existing run identity/timing/tier/score/PP/net-worth/Vault fields plus highest Career level, realized profit, collection discoveries, and Business result. Stats displays the available recent chapters and explicitly states that detailed history is capped at 24 runs. Older saves retain their shorter archived records; missing fields display as unavailable rather than being invented.

Permanent aggregate records remain available even when detailed chapter records are compacted.

## 9. Progression guidance and obsolete UI

The Career dashboard now provides contextual next actions: XP to the next level, affordable available upgrades, the next Prestige goal when applicable, and a direct link to Achievements & Stats. Onboarding terminology now directs players to Career & Upgrades and employee-based Business rather than retired automation/upgrades.

No legacy purchase control was re-enabled. Compatibility readers and neutral archived fields remain because saves from older schemas still need to load.

## 10. Save schema v39

Persistent achievement scope/run identity and cumulative PP earned/spent require schema v39. The idempotent v38→v39 migration:

- preserves money, inventory, instance IDs, wear, float, Pattern/paint seed, and cost basis;
- preserves Career XP, employees, budgets, watchlists, marketplace/escrow/request lineage, Prestige tier/history/Vault, collection scopes, and cloud revision metadata;
- marks historical achievement progress Lifetime without paying it again;
- derives total PP spent from the existing permanent perk levels;
- derives total PP earned as spent plus currently available PP;
- creates no fabricated transaction or Career-XP event.

Achievement progress normalization keys Current Run entries by achievement ID plus run ID so future runs cannot overwrite one another during parsing. The completed Prestige path removes the finished run's bounded Current Run entries.

## 11. Balance impact

Case odds, drop rates, item values, Pattern premiums, employee costs, upgrade costs, Prestige eligibility/score/PP formulas, and the 500–800-hour Career curve are unchanged. New achievement XP is milestone-based and exact-once; Current Run cash/XP rewards are modest. The representative Career simulation is rerun as a release gate because achievement XP rewards changed, even though its modeled core action-rate constants are unchanged.

## 12. Verification and limitations

Prompt 7 adds deterministic coverage for category/scope rules, obtainable wear, retired definitions, run-keyed unlocks, exact-once single/Claim All rewards, Prestige scope reset, v38→v39 PP accounting, shared reporting consistency, four-entry navigation, redirects, deep links, and browser Back.

Final evidence: TypeScript passed; 78 Vitest files / 447 tests passed; ESLint passed with zero errors; all 2,134 generated assets verified; production/PWA build and `verify:release` passed; the representative simulation retained the 781.1-hour projection; and 23/23 Chromium journeys passed in 3.9 minutes after the two intentional Progression-navigation visual baselines were refreshed. Exact commands and the GitHub CI result are also recorded in `PROJECT_STATUS.md`.

Known limitations:

- Detailed Prestige chapter history is intentionally capped at 24 records.
- Pre-v34 financial history and pre-v39 chapter fields cannot be reconstructed exactly and are shown as unavailable.
- Offline operations are reported from bounded retained operation records; permanent financial totals remain ledger-backed.
- Live Supabase Auth/RLS/RPC and real multi-device conflicts require deployment credentials and are not claimed from local/mock tests.
- Prompt 8 completed the migration-matrix hardening, cloud/security/performance/accessibility sweep, and local/offline release cleanup. Prestige recovery now uses a state-bound proof and source-run request identity instead of a boolean, and Settings can replace the current lineage with the verified pre-Prestige snapshot. Save validation rejects duplicate item identity and corrupt escrow without silently deleting an item. See `CAREER_OVERHAUL_FINAL_RELEASE_REPORT.md` and `CAREER_OVERHAUL_RECOVERY_AND_ROLLBACK.md`. Live Supabase verification remains blocked on credentials.
