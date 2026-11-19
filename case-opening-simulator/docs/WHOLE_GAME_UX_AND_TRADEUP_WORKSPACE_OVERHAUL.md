# Whole-Game UX and Trade-Up Workspace Overhaul

Date: 2026-11-18
Save schema: v41 (unchanged)

## Interaction policy

This pass treats repeated gameplay as a workspace rather than a stack of unrelated pages. Core actions stay close to their working context, large collections use bounded internal scrolling or existing virtualization, and route-local choices survive navigation for the browser session. It does not use CSS `zoom`, transforms, smaller mobile touch targets, or gameplay/economy changes.

Session-persisted UI preferences are deliberately separate from the authoritative save. A storage failure falls back to the normal defaults and cannot affect money, inventory, Patterns, marketplace requests, contract results, or exact-once transaction IDs.

## Trade-Up workspace

At desktop widths the workspace is explicitly asymmetric:

- Left: a compact, sticky Inventory source with search, rarity, wear, collection, edition, compatibility, float/price, protected-item visibility, sort, and an internally scrolling picker.
- Right: the larger contract sheet, 10 ordinary or five Covert slots, edition state, probability/EV analysis, possible outcomes, warnings, review, result reveal, and bounded history.
- The Review action is available in the contract header and in a dedicated in-flow review dock. The dock never overlays EV or outcome information.
- Tablet and mobile keep the same semantic order in one column with no horizontal overflow.

Selection and every filter are preserved in `sessionStorage`, so navigating to Inventory and returning does not discard an unfinished manual contract. Execution remains a deliberate reducer action. Negative expected value remains advisory; the established high-loss acknowledgement and automated Trade-Up Specialist rules are unchanged.

### Quick fill rules

`Select Random 10` becomes `Select Random 5` for the five-Covert contract. `Fill Cheapest`, `Fill Lowest Float`, and `Fill Remaining` operate only on the currently filtered pool.

All four actions:

- call the same eligibility and compatibility authorities as manual selection;
- exclude locked, favorited, exceptional-Pattern, escrowed, Vault-protected, or otherwise ineligible instances;
- preserve an existing partial selection and never duplicate an instance;
- keep StatTrak inputs separate from the standard Regular/Souvenir group;
- do not partially replace a selection when Random/Cheapest/Lowest Float cannot complete it;
- never execute the contract or change inventory ownership.

The UI explains an insufficient pool instead of silently relaxing filters. The deterministic pure selector is unit tested independently from the React page.

## Page-by-page workflow changes

### Cases

- Selected case, filter, sort, and last quantity survive route changes in the current browser session.
- The catalog scrolls inside its own desktop panel while the selected-case detail and opening controls remain beside it.
- Case cards and imagery are shorter without losing odds, license, or value information.
- Batch summaries provide `Open Again ×N`, which creates one fresh protected opening session. The existing reducer still deducts the cost once and awards each predetermined result once.
- The repeat control wraps safely on mobile instead of overflowing the summary header.

### Inventory

- Shorter virtualized rows show more owned items while retaining the existing bounded grid and detailed inspection.
- The value/action panel is tighter; direct Trade-Ups and CSWEAR-listing shortcuts reduce navigation.
- Existing saved filters/sort remain authoritative, and the multi-select toolbar stays visible while a batch selection is active.

### CSWEAR

- Catalog search, weapon, rarity, sort, and loaded catalog context persist for the session.
- Every skin market preserves its wear, edition, Pattern, float, price, seller, and sort query independently.
- Existing deterministic virtual identities, bounded page cache, row virtualization, negotiation state, tombstones, and per-query scroll restoration are preserved.
- Cards and listing rows are shorter; no marketplace supply, price, negotiation, expiry, or transaction rule changed.

### Work, Business, Quests, Career, and Help

- Work keeps its focused viewport-bounded game overlay and uses smaller overview art/cards for a faster replay loop.
- Business employee art, cards, section gaps, and control areas are denser; the status sidebar remains visible at wide layouts.
- Current Quests sort claimable stages first and tracked quests next. The section switcher stays visible, cards use less padding, and wide screens can show three columns.
- Career specialization/search/filter choices persist for the session, and the specialization and upgrade explorer use tighter panels.
- Help search/category choices persist, making tutorial or mechanic lookup resilient to route changes.

Home, Market, Prestige, Achievements/Stats, Settings, and the remaining routes inherit the shared density improvements without changing their domain logic or navigation structure.

## Density implementation

Desktop compact mode now reduces common structural padding, section margins, grid gaps, and control minimum heights by roughly 12.5–25% per token. The shell uses a wider 124 rem maximum, and the header/navigation are shorter. Large Text opts out of these compact remaps. The rules begin at 640 px, so mobile touch targets are not globally shrunk.

Measurements were captured at 100% browser zoom with `scripts/captureWholeGameUx.mjs`. Screenshots and JSON are stored under:

- `docs/visual-evidence/whole-game/before/`
- `docs/visual-evidence/whole-game/after/`

Representative measured results:

| Workflow | Viewport | Before | After | Result |
| --- | ---: | ---: | ---: | --- |
| Cases page scroll lengths | 1920×1080 | 4.01 | 1.35 | 66% less page travel; 8 → 12 visible cards |
| Cases page scroll lengths | 1366×768 | 7.02 | 1.49 | 79% less page travel; opening controls remain above the fold |
| Cases page scroll lengths | 1280×720 | 7.49 | 1.52 | 80% less page travel; 3 → 6 visible cards |
| Work page scroll lengths | 1366×768 | 1.07 | 1.00 | full overview in one viewport |
| Work page scroll lengths | 1280×720 | 1.14 | 1.07 | 6% less page travel; eight cards remain represented |
| Work page scroll lengths | 375×812 | 3.42 | 3.25 | 5% less page travel without smaller touch targets |
| Header + desktop navigation | 1366×768 | 192 px | 176 px | 8% less persistent shell height |

The Trade-Up page deliberately does not chase a lower total document height: the requested contract is now larger than the picker and contains visible 10-slot imagery, honest analysis, outcomes, and two reachable review controls. At 1366×768 the page remains about 1.6 viewports, has no horizontal overflow, and replaces repeated full-page travel with a bounded picker plus preserved selection. At mobile widths the page remains naturally vertical, but it no longer overlays analysis with a sticky action bar.

Across all 15 measured route/viewport combinations there is zero horizontal document overflow.

## Sticky and internal-scroll policy

- Sticky elements are used only when they reserve safe content space: selected Case detail, Inventory bulk actions, Quest tabs, and wide Business status.
- The Trade-Up review dock stays in normal grid flow after visual inspection found that a bottom-sticky version could obscure analysis.
- Long data lists use Case/Trade-Up internal panels, Inventory and CSWEAR virtualization, or bounded marketplace caches.
- Mobile falls back to natural vertical flow where a fixed panel would cover content.

## Compatibility and known limitations

- No save migration is needed; schema v41 and all cloud serialization remain unchanged.
- Session-only context does not intentionally follow the player to another browser/device.
- A 375 px screen cannot show a 10-slot contract, its full picker, EV analysis, and outcomes simultaneously. It uses a readable vertical workspace rather than shrinking those controls into illegibility.
- Exact seed-specific artwork and live credentialed Supabase deployment remain the same documented limitations as before this pass.

## Verification coverage

Coverage added in this pass includes pure quick-fill selection, Random 10, five-Covert Random 5, cheapest, lowest-float, fill-remaining, uniqueness, protected-item exclusion, edition grouping, quantity persistence, an exact-once `Open Again ×2` journey, route-return Trade-Up context, desktop left/right geometry, reachable review actions, and horizontal-overflow checks at desktop, laptop, tablet, and mobile widths.

Final command results and GitHub CI status are recorded in `PROJECT_STATUS.md` after the release run.
