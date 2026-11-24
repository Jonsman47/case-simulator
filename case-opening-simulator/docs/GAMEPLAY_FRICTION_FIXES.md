# Gameplay friction fixes — usability overhaul Prompt 2/4

Updated: 2026-11-24. Save schema remains v42. No case odds, pricing, Trade-Up probabilities, rewards, or Career formulas changed.

## Trade-Up picker

An empty contract now presents every eligible input rarity in descending rarity order, omitting empty groups. Items within each group start at highest current estimated market value and descend. The picker retains its bounded internal scroll and the existing search, edition, wear, collection, float, price, and manual sort controls. A manual sort changes order **within** rarity groups. The first genuine selection uses `getTradeUpCompatibilityReason` to restrict the normal picker to that item's rarity and compatible edition. Clearing the contract restores all groups when the All rarities view was active. Explicitly choosing a different rarity clears incompatible selected inputs with an explanation. The existing Regular, StatTrak™, and Souvenir badges remain visible.

Quick-fill selects from a single authoritative rarity and edition pool. With no selected item and All rarities visible, it chooses the highest rarity with enough eligible inputs to complete its 10-input contract (or the five-Covert contract); then the existing quick-fill selector applies Random, Cheapest, Lowest Float, or Fill Remaining within a compatible edition group. Protected items and duplicate instance IDs remain excluded. A complete eligible pool is required for Random, Cheapest, and Lowest Float; Fill Remaining can leave slots open. Selecting a skin first always gives that contract priority. The selection is memoized by item identity, and quick-fill counting is linear in visible inventory size.

## Warehouse Rush

The initial box and all four labeled bins are visible while idle. Opening the game does not start the countdown. Pressing 1–4, tapping a bin, or pressing a box begins the ten-box round; the first valid keyboard/bin action is scored immediately. Pointer capture lets mouse or touch users drag the actual box while a floating visual follows the pointer. Releasing above a bin finds its real DOM hitbox and passes that bin through the same `settle` scoring path as keyboard and tap input. Releasing outside gives guidance and lets the player retry before the current box expires. Cancellation and window blur clear the drag; the conveyor timer continues, including during a drag. A per-box guard prevents double scoring. The reducer still receives one completion action for the round, so cooldown and rewards use their existing exact-once path. Instructions describe the box, colors, four keyboard numbers, mistakes, and ten-box finish in a short paragraph.

## Diamond Miner

The text now says to click reachable blocks, break them to move downward, use more swings on hard blocks, seek valuable ores and diamonds, and finish by cashing out or spending all 18 swings. A one-line hint appears beside the swing counter. The grid, hardness, swing budget, score function, controls, reward, and cooldown are unchanged.

## Multi-case opening

The authoritative `OPEN_CASE` reducer still commits all items before the animation. After the normal reveal, the batch panel closes itself and opens the existing summary. Premium batches retain an 1.8-second minimum result hold so a rare item can be seen. Manual Skip closes a batch animation immediately; it does not call the reducer again. Single-case premium reveals retain deliberate manual inspection. The summary uses the actual opened items, item images, rarity accents, edition/pattern/float/value details, Career XP, discovery IDs, notable drops, and the actual cash cost recorded with the opening event. `Open Again ×N` retains case and quantity.

The save format deliberately omits transient opening UI events. A session-only pending-batch receipt therefore stores the committed event summary and exact item instance IDs. On reload it restores the summary only when those IDs match the saved `lastOpenedItems`; it never generates items or dispatches a second opening. Closing or repeating clears the receipt. This is UI recovery within the same browser session, not a new persistent economy field or cloud merge rule. The optional `cashCost` on newly created opening UI events is backward compatible; older events simply omit the cost pill.

## Verification and limits

- Unit suite: 93 files, 532 tests passed. Focused tests cover mixed-rarity quick-fill, unique IDs in a large pool, mouse/touch pointer lifecycle, first keyboard action, Diamond Miner instructions, automatic premium batch completion, and exact-once skip.
- Standalone TypeScript, ESLint, production build, and `verify:release` passed. Release verification checked all 2,134 CS2 images.
- Career simulation passed 300,000 careers and 500,000 case openings with the existing 95 upgrade and 45 employee rows. The six-playstyle early-game simulation passed 500 seeds per playstyle. No economy calibration was changed.
- Browser journeys passed **59/59** against Chrome at 100% zoom, covering grouping/order/filter/clear, first drag and score, normal automatic batch summary and reload recovery, existing repeat and quick-fill flows, tutorial compatibility, and responsive routes. Playwright used failure-only screenshots; no extra visual captures were needed. GitHub CI status is recorded in the root project status after it finishes.
- Pending batch UI recovery is limited to the current browser session and a matching saved batch. A closed browser session does not replay an old summary. This does not affect the persisted inventory or transaction.
