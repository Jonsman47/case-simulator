# Global Card and Layout Audit

Date: 2026-11-20

Baseline: `8fd2c28` (`main`)

Scope: layout-only; no gameplay, economy, probability, item, or save-schema changes

## Root causes

The overlap was not one isolated card bug. Three layout contracts had drifted apart after the compact-density pass:

1. The Cases catalog still let grid rows stretch from compact minimum heights instead of sizing each row from its tallest real card. A rendered card could be about 240 px tall while its content needed roughly 296 px, so content visibly entered the next row.
2. The virtualized Inventory used fixed 308/316 px rows even when a card needed up to roughly 368 px. `react-window` positioned the next row at the stale fixed offset, producing real visual overlap. CSWEAR had the same class of risk in its fixed-height listing rows.
3. Long names, prices, Pattern labels, editions, buttons, and Large Text inherited `min-width: auto`, truncation, or non-wrapping flex/grid behavior. Some shared cards also clipped overflow rather than allowing their content to define height.

The audit also found that the five status cards switched to a single tablet row too early. At 768 px with Large Text this produced character-by-character wrapping even though the elements technically remained inside their boxes.

## Corrections

- Added a reusable `content-card-grid` contract: max-content grid rows, stretched equal-height cards within each row, `min-width: 0`, bounded controls, and safe wrapping without global overflow hiding.
- Made Cases cards content-aware and removed truncation from names, costs, unlock text, and best-drop content.
- Updated Inventory virtual row heights for desktop/mobile and Large Text, and moved the five-column breakpoint to 1440 px so laptop cards retain usable width.
- Increased CSWEAR virtual listing rows for normal and Large Text modes and made marketplace cards/listings wrap their real content.
- Applied the shared card contract to Work, Business, Career, Quests, Prestige, Achievements, Stats, and Trade-Ups where their grids or metrics had the same failure mode.
- Removed unsafe value truncation and line clamps from audited card content while preserving compact padding and spacing.
- Changed the shared status header to a 2/3-column tablet layout, retaining the five-column compact row on desktop.

## Measured visual verification

The production audit visits Cases, Inventory, Trade-Ups, CSWEAR, Work, Business, Career & Upgrades, Quests, Prestige, Achievements, and Stats at:

- 1920×1080
- 1366×768
- 1280×720
- 768×1024
- 375×812
- both normal and Large Text modes

That is 110 screenshots per revision. Transient tutorials, notifications, and PWA prompts are dismissed in the fixture so they cannot hide the layout under test. Geometry checks inspect card scroll dimensions, document overflow, grid boundaries, and sibling card intersections.

| Measurement | Baseline | Fixed |
| --- | ---: | ---: |
| Clipped/overflowing cards | 376 | 0 |
| Unexpected horizontal overflow | 0 | 0 |
| Cards outside their grid | 2 | 0 |
| Card bounding-box intersections | 0 | 0 |
| Screenshots inspected | 110 | 110 |

The baseline's visible overlap came from content overflowing a too-short card/virtual row; the card boxes themselves did not intersect, which is why both scroll geometry and screenshots are retained.

## Evidence

- [Cases before](visual-evidence/card-layout-audit/before/cases-laptop-1366-standard.png)
- [Cases after](visual-evidence/card-layout-audit/after/cases-laptop-1366-standard.png)
- [Inventory before](visual-evidence/card-layout-audit/before/inventory-laptop-1366-standard.png)
- [Inventory after](visual-evidence/card-layout-audit/after/inventory-laptop-1366-standard.png)
- [Cases mobile Large Text](visual-evidence/card-layout-audit/after/cases-mobile-375-large-text.png)
- [Inventory mobile Large Text](visual-evidence/card-layout-audit/after/inventory-mobile-375-large-text.png)
- [Business tablet Large Text](visual-evidence/card-layout-audit/after/business-tablet-768-large-text.png)
- Machine-readable reports: [baseline](visual-evidence/card-layout-audit/before/geometry.json) and [fixed](visual-evidence/card-layout-audit/after/geometry.json)

## Automated regression coverage

`e2e/card-layout.spec.ts` seeds long item names, six-digit prices, StatTrak, Pattern data, and both normal/Large Text settings. It verifies Cases and Inventory at all five required viewport sizes, asserting that:

- every card's scroll width/height fits its rendered box;
- no card bounding boxes intersect;
- grids and the document do not horizontally overflow.

The broader Playwright suite continues to cover Light Mode, Large Text persistence, all player routes, Work, opening controls, and responsive layouts. The Work snapshot was intentionally refreshed after inspection because removing its description clamp correctly increased the first row by 20 px.

## Verification results

- `npm test`: passed — 91 files / 520 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero errors.
- `npm run build`: passed — 2,134 assets verified, 1,922 modules bundled, PWA generated.
- `npm run verify:release`: passed, including all 2,134 CS2 images.
- `npx playwright test e2e/card-layout.spec.ts`: passed — 10/10.
- Final 110-screenshot geometry audit: passed — 0 clipped, 0 horizontal overflow, 0 outside-grid cards, 0 intersections.
- Full `npx playwright test`: passed — 48/48 Chromium journeys in 4.4 minutes.
