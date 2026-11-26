# Performance and Work game bug fixes

Updated: 2026-11-26. Save schema remains **v43**.

## Reproduction and profiling

`scripts/profileGameplayStress.mjs` drives real Chromium or Firefox sessions at 1366×768. Its extended path opens 110 cases including repeated ten-case batches, inspects items, drags a Warehouse box through 80 pointer moves, starts Memory Circuit, and repeatedly changes routes. The corrected large-cash fixture is installed before app initialization. Run it against Vite development (`http://127.0.0.1:5175`) or a local production preview (`http://127.0.0.1:4174`); use `--cycles=8 --cash=100000` for the extended path. Results include animation-frame gaps, event-loop delays, save serialization/write timing, console errors, and Chromium Long Tasks and optional CPU profiles. Firefox does not expose the Chromium Long Tasks API, so frame gaps and event-loop delay are its stall indicators.

Environment: Windows x64 build 10.0.26200, AMD Ryzen 7 7735U, 16 logical cores, 15 GiB RAM reported by Node, headless Chromium 156.0.8078.4 and Firefox 157.0. Development measurements use the same local machine and viewport. Browser scheduling, image cache and background processes can add noise; these are observed runs, not a universal FPS guarantee.

The earlier short baseline fixtures accidentally installed save data before the old page unloaded; that page overwrote the fixture. Those short files are **not** evidence for the intended high-cash large-inventory scenario. The matched extended runs below use the corrected fixture and actual repeated case transactions.

The short production preview runs before the Case card change also used that default-wallet fixture, so their results are excluded from the high-cash before/after table. A corrected production run after the final build provides a development-versus-production observation, but it cannot be paired with an identical pre-Case-card production build without rebuilding the old revision.

On the final production build, the corrected four-cycle stress path measured a 250 ms maximum frame gap, nine Long Tasks over 50 ms, zero over 200 ms, and an 89 ms maximum Long Task in Chromium. Firefox measured 650 ms maximum in the first run and 501 ms on a repeat; its 95th-percentile frame gap was 200 ms in both. These Firefox stalls were concentrated around ten-case animation and Skip-to-summary phases. Save operations stayed at or below 3 ms, and neither run reported a page error. Raw captures are `stress-final-prod-chromium.json`, `stress-final-prod-firefox.json`, and `stress-final-prod-firefox-repeat.json`. Production Firefox still has visibly long frames; this update does **not** establish that all intermittent freezes are solved.

| Matched development stress path | Before Case card fix | After Case card fix |
| --- | ---: | ---: |
| Firefox, eight cycles, longest frame gap | 901 ms | 417 ms |
| Firefox, frames over 200 ms | 59 | 57 |
| Firefox, event-loop delay maximum | 873 ms | 322 ms |
| Firefox, 95th-percentile frame gap | 234 ms | 234 ms |
| Chromium, four cycles, longest frame gap | 417 ms | 367 ms |
| Chromium, Long Tasks over 50 ms | 21 | 23 |
| Chromium, Long Tasks over 200 ms | 6 | 1 |
| Chromium, longest Long Task | 396 ms | 226 ms |
| Chromium, event-loop delay maximum | 345 ms | 282 ms |

Raw matched captures: `stress-extended-after-reels-dev-firefox.json`, `stress-after-casecards-dev-firefox.json`, `stress-phases-dev-chromium.json`, and `stress-after-casecards-dev-chromium.json`. A Chromium CPU profile identified React development `logComponentRender` and `JSXDEV` reconciliation around repeated Case cards with whole `GameState` props. Each card now receives stable primitive props and a memoized component; unrelated game-state changes do not recursively diff the entire state for every card. Save stringify/write times were only a few milliseconds in these sessions and were **not** the confirmed main bottleneck. No persistence writes were deferred. Smaller stalls and poor 95th-percentile Firefox pacing remain, so the reported random freeze is improved but not proven eliminated on every device.

The matched Firefox runs observed maximum save serialization and write time of 3 ms each, with zero console errors. The four-cycle Chromium runs observed 4.7/2.4 ms before and 3.8/2.6 ms after for serialization/write. Chromium's sampled JavaScript heap was 58→58 MiB before and 54→54 MiB after across the recorded path; this short, sampled result is insufficient to rule out a long-session leak. The stress script records route milestones and phase-tagged stalls for future comparison.

Among the Chromium run's recorded top frame stalls, the worst case-animation gap fell from 417 to 200 ms and transaction-click gap from 367 to 217 ms. The after run's overall 367 ms maximum was tagged during initialization. The scripted Warehouse drag produced no entry in the top-stall sample, while the React Profiler test establishes the narrower fact that pointer movement causes no board commits. These observations do not substitute for a physical Firefox frame trace.

The number of Chromium tasks over 50 ms did not fall; the main gain was fewer severe tasks over 200 ms. Route transitions are timestamped in the raw captures and the path repeatedly navigates between Cases, Inventory, Home and Work, but a separate input-to-paint navigation latency percentile was not captured. That remains an explicit measurement gap rather than an asserted speedup.

The multi-case reel also bounds decorative cards and animated lanes while retaining all committed outcomes and result-summary items. In isolation that reel change barely improved matched Firefox stress results; the Case card render change had the clearer effect. Warehouse dragging now moves the visual box directly through a ref during pointer movement; React does not commit the whole board on every pointer pixel. A Profiler test observes zero React commits over 80 pointer moves. Browser focus changes pause the conveyor deadline and cancel an active drag, with timer/listener cleanup. Keyboard, touch, first-action start, scoring and exact-once Work settlement remain on the existing path.

## Inventory selling

Sell Instantly opens a compact centered confirmation separate from the long item inspection panel. It shows the exact owned image, name, wear/edition, proceeds, applicable resale warning and visible Cancel/Confirm actions. The footer stays visible on short screens. Escape cancels, focus returns to Sell Instantly, and a submission guard prevents rapid duplicate calls. The existing authoritative sale handler still decides item eligibility, fees and settlement; locked and escrowed items retain their protection.

## Package Delivery

Each round uses a cryptographically generated seed and a deterministic generator with scattered, barrier and zigzag obstacle layouts. A breadth-first search validates start, two package pickups, two corresponding destinations, no overlaps, and a route within the existing 22-move budget. Invalid candidates are retried; a validated rotated fallback handles exhausted attempts. Unit coverage replays 2,000 seeds and checks variety across another 120. An active run's seed, map and progress live in session storage so a reload does not reroll it. Completion removes that snapshot before the existing exact-once Work reward dispatch. Rewards and cooldowns did not change.

## Memory Circuit

One seven-pad sequence is generated at round start. The visible rounds use its prefixes of 3, 5 and 7, preserving earlier pads exactly. Four lightweight Web Audio tones match the pad during playback and player input. Audio starts from the Start user gesture, respects mute and volume, and has no bearing on scoring. Demonstration and input phases are distinct; input during demonstration is ignored. Audio and timer resources are closed on unmount. The existing Work reward and cooldown authority remains unchanged.

## Feature walkthroughs

Optional element-by-element guides cover Cases, Inventory, Work, Trade-Ups, CSWEAR, Career, Business and Prestige using the existing spotlight engine. Each uses real controls, fallback copy when a target is absent, Back/Skip, Help replay, and URL step state for reload recovery. Contextual introductions defer while a reveal or Work game is active. The beginner tutorial still observes the committed opening. These guides explain actions but never execute a purchase, sale, contract, hire or Prestige reset.

## Compatibility and limits

No case odds, item generation, pricing, reward amounts, Career curves, cloud revision fields, or save schema changed. Package active-run state is session-only and does not modify cloud saves. A browser crash may still lose in-progress Work state beyond what session storage preserves; completed rewards remain reducer-controlled. The automated stress path does not prove physical Firefox behavior, sustained multi-hour memory stability, or that all intermittent freezes are eliminated. Reproduce manually in normal Firefox with DevTools Performance recording on Vite development and local production preview, repeat ten-case openings and Warehouse drags, then inspect main-thread gaps and memory over 30 minutes.

## Verification

Standalone `npm run lint` and `npm run typecheck` passed. `npm run verify:release` passed, including 99 Vitest files / 561 tests, production/PWA build and all 2,134 CS2 images; `npm test` is the same 561-test command exercised inside that gate. `npm run simulate:career` passed both the 300,000-career / 500,000-opening economy model and the six-playstyle early-game model (500 runs per style, zero repeated rewards). The full Chromium Playwright suite passed **71/71** journeys, including selling, all Work games, beginner tutorial, optional guide, marketplace, save reload, and mobile layout. Performance runs completed in development and production Chromium and Firefox as described above. GitHub [CI run 45836781304](https://github.com/Jonsman47/case-simulator/actions/runs/45836781304) passed for implementation commit `3a59c1071e2075c87756b69c934f63dfa9a308a9`, including 71/71 Linux browser journeys. The final documentation-only commit receives its own CI run.
