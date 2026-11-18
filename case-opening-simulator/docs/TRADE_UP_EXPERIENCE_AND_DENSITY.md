# Trade-Up Experience and UI Density Follow-Up

Date: 2026-11-18

## Scope

This follow-up replaces the compact spreadsheet-like Trade-Up presentation while preserving the existing `analyzeTradeUp` probability model and authoritative `TRADE_UP` reducer transaction. It also strengthens the desktop density system without CSS `zoom`, root transforms, altered case odds, or save rewrites.

## Manual risk versus eligibility

Manual profitability is advisory. A player-created contract can execute when its exact items, count, rarity, edition group, ownership/protection state, and output pool are valid. Negative EV and ROI never make `analysis.canTradeUp` false. Contracts at or below -50% estimated ROI require an explicit high-loss acknowledgment in the final review.

The employee Trade-Up Specialist is intentionally different. It still requires complete valuation data and enforces its configured input-value, daily budget, expected-profit, expected-ROI, rarity, collection, and confirmation rules. Missing valuations cannot be interpreted as a profitable automation opportunity.

An output with no finite positive estimate is now marked `Value unavailable`. It remains a real possible output, but the UI does not display a misleading -100% guaranteed loss. Known and unknown valuation coverage is shown separately.

## Edition rules and labels

- `StatTrak™` uses a textual orange badge.
- `Souvenir` uses a textual gold badge.
- `Regular` is shown wherever edition comparison matters.
- The shared badge appears on Inventory cards, item inspection, Trade-Up picker cards, selected slots, possible outcomes, history, and result reveals.
- The picker exposes Regular / StatTrak™ / Souvenir filters and a one-click compatible-only view.
- Selecting an incompatible item leaves the contract unchanged and explains the exact item and reason.
- Mixed-edition validation reports StatTrak™, regular, and Souvenir counts instead of a generic message.
- The existing implemented rule remains authoritative: StatTrak™ inputs form their own group; regular and Souvenir inputs are the standard group and produce a non-StatTrak output.

## Workbench and execution

The new workbench uses a tactical document/workbench hierarchy:

1. Large 5×2 standard input sheet, or five larger Covert slots.
2. Real images, rarity borders, edition labels, wear, float, and value in each filled slot.
3. Search, rarity, wear, collection, edition, price, float, compatibility, protection, and sorting controls.
4. Quick-fill from the currently visible eligible set without mutating ownership.
5. Sticky analysis, loss warnings, and a bounded real-outcome gallery with inspection.
6. Final irreversible review showing all exact inputs and opportunity cost.
7. Reducer execution followed by a skippable seal/process/result sequence.

The reducer commits the output, input consumption, ledger/statistics, Career XP, collection discovery, quest activity, pending acquisition, and bounded history exactly once before animation. Reloading cannot reroll the item. Claim only acknowledges the already-saved result.

## Density implementation

The desktop density pass operates at 640 px and above and deliberately opts out for Large Text. It reduces common layout padding, gaps, vertical rhythm, heading sizes, desktop body text, dialog whitespace, shell margins, header padding, and Inventory card height. The application width cap grows from 110 rem to 118 rem. Interactive controls retain practical desktop heights, while mobile sizing and touch behavior remain independent.

No global `zoom`, scale transform, or browser-unsafe font scaling is used.

### Measured Trade-Up layout evidence at 100% browser zoom

Measurements use the same deterministic Playwright capture script before and after. Negative horizontal overflow means the stable scrollbar gutter is narrower than the viewport; no viewport has positive horizontal overflow.

| Viewport | Before document / workbench | After document / workbench | Result |
| --- | ---: | ---: | --- |
| 1920×1080 | 1239 / 906 px | 1146 / 918 px | Document 7.5% shorter; premium slots still fit nearly within one viewport. |
| 1366×768 | 1607 / 1367 px | 1146 / 918 px | Document 28.7% shorter; workbench 32.9% shorter. |
| 1280×720 | 1607 / 1367 px | 1165 / 937 px | Document 27.5% shorter; workbench 31.5% shorter. |
| 768×1024 | 1866 / 1600 px | 1837 / 1583 px | Slightly shorter while retaining larger readable slots. |
| 375×812 | 2784 / 2316 px | 2916 / 2460 px | 6.3% taller by design: mobile keeps two readable slot columns rather than shrinking ten inputs below recognition. No horizontal overflow. |

The desktop/laptop target is therefore materially denser, while the intentionally more visual mobile Trade-Up sheet uses a little more vertical scrolling instead of undersized targets.

## Screenshot evidence

| Viewport | Before | After |
| --- | --- | --- |
| 1920×1080 | [before](visual-evidence/before/trade-ups-desktop-1920.png) | [after](visual-evidence/after/trade-ups-desktop-1920.png) |
| 1366×768 | [before](visual-evidence/before/trade-ups-laptop-1366.png) | [after](visual-evidence/after/trade-ups-laptop-1366.png) |
| 1280×720 | [before](visual-evidence/before/trade-ups-laptop-1280.png) | [after](visual-evidence/after/trade-ups-laptop-1280.png) |
| 768×1024 | [before](visual-evidence/before/trade-ups-tablet-768.png) | [after](visual-evidence/after/trade-ups-tablet-768.png) |
| 375×812 | [before](visual-evidence/before/trade-ups-mobile-375.png) | [after](visual-evidence/after/trade-ups-mobile-375.png) |

Raw measurements are stored beside each screenshot set. Reproduce them with:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5173'
node scripts/captureTradeUpDensity.mjs current
```

## Persistence

No save-schema migration is required. The feature adds no persistent gameplay field. Existing v41 item identities, editions, Patterns, history, pending acquisition, ledger, Career, quests, Business, Prestige, and cloud lineage remain unchanged. The existing pending-acquisition record is sufficient for reload-safe reveal behavior.

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed with zero errors.
- `npm test`: passed, 90 files / 513 tests.
- `npm run build`: passed; 2,134 assets / 197.4 MiB verified, 1,920 modules transformed, 139 PWA precache entries / 4,665.79 KiB generated. The existing advisory for a lazy catalog chunk over 500 KiB remains.
- `npm run verify:release`: passed, including unit, asset, production and PWA checks.
- `npm run simulate:career`: passed 300,000 careers, 500,000 production-linked openings, 95 upgrade rows, 45 employee rows and 500 seeds across each of six early-game playstyles. The five-tier competent-regular projection remained 781.1 engaged hours and every sampled case retained negative EV.
- `npx playwright test`: passed all 36 serial Chromium journeys in 7.6 minutes. Coverage includes the real negative-EV manual contract, high-loss confirmation, exact-once reducer/reveal/history/reload, edition labeling and incompatibility reasons, every player-facing route without console errors, and responsive layouts from 1920 px through 320 px.

Live Supabase deployment was not exercised because production credentials were not available; local/cloud-compatible serialization remains covered by the existing automated suite.
