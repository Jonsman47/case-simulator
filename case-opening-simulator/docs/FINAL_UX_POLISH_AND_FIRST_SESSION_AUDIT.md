# Final UX polish and first-session audit

Updated: 2026-11-24. Usability overhaul Prompt 4 of 4.

## Notifications

`GameUiEvent` remains the transient, authoritative source. Each event has a unique ID, type, and creation time. `toastPolicy.ts` derives priority and dismissal policy from the event type; no animation or toast-read state is saved. The reducer's `DISMISS_UI_EVENT` removes only the chosen ID. The existing administrative `CLEAR_UI_EVENTS` remains separate and never claims rewards. Achievement and quest badges are selected from persistent claim state, so closing a toast cannot clear a badge.

Routine messages live for 4 seconds, progression messages for 8 seconds, and failed case, sale, and Trade-Up actions stay until dismissed. Failures have a Review action. At most three noncritical toasts show at once; the next queued event takes an opening when a toast closes or expires. The reducer holds at most 50 recent ordinary UI events, deduplicates event identities, and reserves room for critical failures. Repeated identical failure messages collapse. Temporary events are dropped on save load and state replacement, preventing replay after reload. Existing auto-sale and batch-opening summaries already aggregate repeated operations; the case reveal and summary carry the detailed batch results rather than duplicate drop toasts.

Toasts defer behind the beginner tutorial and any open dialog, including case and Trade-Up reveals and Work minigames. Critical failures remain visible. Feature introductions also wait behind dialogs. The toast stack sits below the header, clamps to the usable viewport width and height, and has individually named keyboard-accessible X buttons. The 320 px Large Text audit found and fixed a 7 px left overflow: `100vw` included the scrollbar, so the stack now sizes from its containing block. A batch's fourth genuine notification was observed entering the three-toast stack after independent dismissal.

## Feedback and accessibility

The status header briefly shows the committed cash delta, Career XP gained, level reached, and item-count increase. It does not display a speculative transaction. Career's existing XP bar keeps its short width transition. Quest fractions and bars accent genuine progress and completion. Achievement claims emit one event only after the successful reducer claim, with the actual cash award; claiming all emits one aggregate event. The achievement badge remains tied to claim state. Newly opened skins receive a brief Inventory ring on first display in the current browser session; a session marker prevents that highlight from replaying after reload. Business highlights its newest operation row instead of producing a toast for every employee tick. Existing Trade-Up and rare-drop reveals remain the main result presentation.

New feedback uses short color/width transitions and no particles or global timers. Reduced Motion disables transitions; the existing motion setting and `prefers-reduced-motion` also govern older effects. Routine toasts use polite status announcements; critical failures use alerts. Toasts do not take keyboard focus, and X buttons work with Enter. The existing claim controls, focusable glossary, and tutorial spotlight remain interactive.

## Structured first-session audit

This is an automated and code-assisted usability audit, **not a human 30-minute study**. The browser journey follows the actual first-session path rather than checking only headings. Existing tutorial, Home, unlock, Trade-Up, Work, and returning-save journeys supply the additional evidence.

| Stage | Audited path | Finding |
| --- | --- | --- |
| First 5 minutes | Home goal → Cases → real opening → result → Inventory item and estimated value | The core path is reachable. The guide's target remains usable, and the reveal owns the screen while active. |
| First 15 minutes | Claim first standalone quest stage → complete Sort Boxes Work → see earned cash | Quest claim advances its saved stage. Work result is shown in its modal; the routine toast waits until the modal closes. |
| First 30 minutes | Inspect then instantly sell a skin → return Home → reload | Sale revenue records only the actual sale. Home remains a next-action hub, and the dismissed tutorial does not restart. |
| Returning player | Continue Opening, recent activity, permanent unlocks, paused tutorial and rewards | Covered by existing returning-save and Home browser journeys; no forced fresh-player welcome. |
| Experienced player | Skip/replay guide, batch result, exact-once claim, dismiss routine toast | Batch opening and achievement-claim journeys remain quick. No toast must be closed to continue gameplay. |

Problems found and fixed in this prompt: a toast X previously cleared every UI event; important toasts could crowd a reveal; feature introductions could appear while another dialog was open; Work notifications could cover minigame controls; cash/XP and item acquisition changed without local feedback; and the mobile toast stack overflowed with Large Text. The first-session browser test also corrected assumptions about the deliberately prompt single-case close and variable Work presentation; those were test synchronization issues, not gameplay changes.

## Manual 30-minute player script

Ask a player unfamiliar with Counter-Strike to think aloud. Avoid explaining terms unless they ask; record where they hesitate, what they click, and whether they can say what changed.

1. **0–5 minutes:** Start a fresh save. Ask what the goal is, then let them follow the guide to open one case and inspect its rarity, wear, and estimated value. Observe whether the spotlight button is clickable and whether they find Inventory and Home afterward.
2. **5–15 minutes:** Ask them to find a cash recovery method, play one Work game, find a quest, track it, and claim an earned stage. Ask what Case Opening Funds can buy and have them open one glossary term with mouse, keyboard, or touch.
3. **15–25 minutes:** Have them open a small batch, inspect the summary, sell one item instantly, and explain how that differs from a CSWEAR listing. Ask what an achievement badge means before and after claiming a reward. Dismiss the second of three toasts and watch the others.
4. **25–30 minutes:** Return Home, identify the next goal and next unlock, reload, and continue the last case. Try a low-cash recovery path. Repeat one action with Reduced Motion and at a narrow mobile width if the player is comfortable.
5. Record any blocked control, confusing term, wrong value, unexpected repeat, clipping, or notification that obscures the task. Capture only a screenshot of a concrete defect and note the viewport and browser zoom.

## Performance, saves, and limits

The UI event list is bounded, timers exist only for visible toasts and are cleaned on dismissal/unmount, and layout is observed only when dialogs mount or unmount. No economy, case-odds, item, Career, Work, quest, Trade-Up, Business, or Prestige formula changes were made. Save schema remains **v43**. The UI event queue and feedback are transient; achievement claims still pass through the existing exact-once reducer.

Known limit: automated journeys can prove reachability and state accuracy but cannot prove the game is subjectively enjoyable or that every first-time player understands a term. The manual script above is the next evidence source.

## Verification

The local release gate passed TypeScript, ESLint, 97 Vitest files / **548 tests**, the production/PWA build, and release validation of all 2,134 CS2 assets. The full Career economy simulation passed its 300,000 career samples; the early-game simulation passed six playstyles with 500 runs each and no repeated quest rewards. The final complete Chromium run passed **65/65 Playwright journeys** in 8.9 minutes, including the first-session path, tutorial and returning-save compatibility, individual toast dismissal, and desktop/mobile layout. A first full run exposed stale Work assertions that expected a toast inside a modal, plus an inventory highlight check after its brief lifetime; those browser journeys were corrected to observe the intended states and passed on the final complete run. GitHub CI evidence will be recorded after the remote run.
