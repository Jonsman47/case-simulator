# Home, beginner guide, unlocks, and layout

Implemented for usability overhaul Prompt 1 of 4. This document records the inspected behavior and the new integration points. Prompts 2–4 remain planned.

## Problems found before implementation

- Home offered a thin opening shortcut, recent drops, and a tracked quest. It did not surface affordable next actions, rewards, persistent milestones, or locked feature progress.
- The former 13-step tutorial polled DOM targets on a timer. Its result step could advance from an opening count before the actual reveal. Tooltip geometry and fallback controls were brittle during responsive navigation and modals.
- Advanced destinations appeared immediately, giving a fresh player little indication of when they were useful. The prior save did not record permanent feature discovery.
- The shared desktop header and the mobile status strip consumed substantial vertical space. Existing responsive density changes did not address the Home layout or guide.

## Home and sources of truth

Home uses the real game state and the existing case-opening route. Continue Opening retains the last selected case, displays its catalog image and current price, applies the actual Opening Credit quote, and navigates to `/cases?case=<id>`. If that case is unavailable, it selects the cheapest openable case. When cash is insufficient, the button is disabled and Work is recommended. No item or reward is generated on Home.

The compact status strip shows the optional cloud profile name, Career rank/level/XP, Prestige tier, and claimable notification count. Goals come from up to three tracked, unlocked quests, with live stage progress and reward details. A valid completed stage can be claimed through the existing quest reducer. Quick actions use the unlock selector. Recent activity combines persisted drops, Trade-Up history, completed quests, promotions, and unlocked achievements; a fresh save shows an empty state. The next unlock panel shows the earliest unmet feature with a reliable progress fraction. Recommendations use a fixed priority: claimable rewards, unaffordable case, then a currently viable Trade-Up contract.

## Beginner guide

An original small SVG portrait represents one gameplay guide. It is unrelated to quest NPCs or reputation. The guide has twelve stable steps:

1. Welcome and the core loop (centered explanation).
2. Cash and Work recovery (wallet spotlight).
3. Cases navigation (real nav event).
4. Affordable starter selection (actual case card event).
5. Open 1 (actual opening control and transaction).
6. Wait for the committed item and completed result reveal.
7. Rarity, wear, and estimated value (result spotlight).
8. Inventory navigation.
9. Inspect the acquired instance in its actual detail panel.
10. Quests navigation and beginner goal.
11. Work navigation, with a skip-step option.
12. Return Home and finish.

Each step specifies its ID, route or destination, target, explanation, event requirement, and recovery text in `OnboardingTutorial.tsx`. Action steps advance on route, selection, opening count relative to the saved baseline, authoritative item identity plus reveal completion, or exact item inspection. Continue cannot bypass those actions. Pause, Back, Skip step where appropriate, Skip tutorial, and replay from Help or Settings are available. Reload retains version, current and last-valid step, completed IDs, dismissal/pause state, opening baseline, and acquired instance ID. A reloaded reveal can continue from the saved real item without rolling again. Prestige does not reset the beginner guide.

The spotlight targets real DOM controls. Its overlay does not take pointer events, so the highlighted control stays clickable. A MutationObserver handles route/modal/target replacement, ResizeObserver and scroll/resize listeners handle geometry changes, and transition tracking runs animation frames only during a relevant transition. Tooltip placement checks viewport sides and remains in bounds. If a target is absent, a route action or recovery message and Skip remain available. Centered explanations may block the background briefly.

## Feature unlock order and permanence

| Feature | New-player condition | Existing gate retained |
| --- | --- | --- |
| Collection Book | First genuine skin acquisition/discovery | Collection records are permanent |
| Quests | First committed case opening | Existing quest requirements |
| Market Price Checker | First real sale | Existing market transaction logic |
| CSWEAR | Career level 3, or prior market use | Existing economics |
| Trade-Ups | Ten eligible, compatible ordinary inputs validated by the authoritative analyzer | Five-Covert contracts retain their own rules |
| Business | Career level 15, or an existing hire | Employee roles remain gated at levels 15/35/55 |
| Prestige | Existing Prestige eligibility, or a previous Prestige | Existing formula and requirements |

Home, Cases, Inventory, Work, Achievements & Stats, Help, Settings, and beginner Career stay available immediately. Locked deep links render a condition/progress page at the same route, so bookmarks are not lost. Unlock IDs latch in the save: selling or consuming an input cannot relock a discovered feature. One notification is presented per new unlock, recorded separately from acknowledgement, deferred during case and acquisition reveals, and followed by an optional first-visit introduction. These presentations never issue gameplay rewards.

## Save and compatibility

Schema v42 adds bounded tutorial and feature UI metadata only. The v41 migration keeps prior tutorial completion/dismissal and grants existing players all navigation unlocks to avoid revoking previously available destinations. It does not alter money, inventory, odds, item identities, market economics, Career, Business, quest rewards, or Prestige. New players progress through the rules above. Cloud serialization continues to use the existing save envelope and migration path.

## Layout and browser evidence

The Home uses compact content-aware sections and responsive grids; grid children have `min-width: 0`. The shared status header hides secondary metrics at narrow widths and the Home omits the large event banner. The Work dialog avoids repeating its title/icon on 320 px screens so Memory Circuit controls fit at 320×568. There is no global zoom, transform, or overflow suppression. The guide and unlock cards fit within the viewport and support Large Text, Light Mode, and reduced motion.

Measurement and five total before/after Home screenshots are in `docs/visual-evidence/home-overhaul/`. The prior desktop header/navigation measured 135 + 41 = 176 px; the new layout measured 73 + 41 = 114 px at 1366 px width. The prior mobile status header measured 321 px and the new header 127 px. These are component-height comparisons, not a claim of an exact overall density percentage. The capture script measured 76 route/viewport/setting combinations across the requested seven resolutions and major routes: zero horizontal overflow and zero clipped cards. Home fits within one page at 1920, 1366, 1280 and 768 px widths; at 320×568 it spans 2.27 pages while both first-case actions remain in the initial viewport. The corresponding 320 px result before the final narrow-image adjustment was 2.35 pages with zero fully visible actions. Automated browser journeys cover genuine opening, recovery, unlocks, returning saves, and responsive layout.

Final local verification: standalone `npm run typecheck`, `npm run lint`, `npm test` (92 files, 525 tests), `npm run build`, and `npm run verify:release` passed. `npx playwright test` passed 56/56 Chromium journeys using the installed Chrome channel at 100% zoom. `npm run simulate:career` passed its 300,000-career and 500,000-opening economy samples, 95 upgrade rows, 45 employee rows, and 500 seeds for each of six early-game playstyles. Remote GitHub CI is checked separately after the push.

## Limits

- The first-visit guide teaches essential early systems; deeper terminology and Help prose remain for Prompt 3.
- The selected case must still be available and affordable under current game state; Home falls back to an openable case when the previous selection is unavailable.
- Browser visual evidence is a sampled geometry check, not proof of every possible content length or operating-system font.
