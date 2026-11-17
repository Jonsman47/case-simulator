# Quests, NPCs, official odds, and notable-drop experience

Implementation date: 2026-11-17
Save schema: v40

## Authoritative standard weapon-case odds

The primary source is the [Perfect World/Valve probability disclosure dated 2017-09-11](https://www.csgo.com.cn/news/gamebroad/20170911/206155.shtml). It states a 1:5 ratio between each weapon rarity and the next lower rarity, a 2:5 Rare Special-to-Covert ratio, equal probability for items of the same quality, and 1:10 StatTrak eligibility where supported. Its published table rounds the weapon-case tiers to 79.923%, 15.985%, 3.197%, 0.639%, and 0.256%.

The simulator stores the normalized ratios rather than independently rounded percentages:

| Tier | Ratio units | Runtime probability | Player-facing rounded rate |
| --- | ---: | ---: | ---: |
| Mil-Spec | 125 | 79.9232736573% | 79.92% |
| Restricted | 25 | 15.9846547315% | 15.98% |
| Classified | 5 | 3.1969309463% | 3.20% |
| Covert | 1 | 0.6393861893% | 0.64% |
| Rare Special | 0.4 | 0.2557544757% | 0.26% |

`src/data/officialDropOdds.ts` reweights the imported table by rarity while retaining each item's imported relative weight inside its tier. `src/data/cases.ts` applies it after price balancing. `getEffectiveCaseDefinition` reapplies it after collection, legacy-upgrade, Prestige, skill, event, and daily transforms, so none of those paths can silently change a standard case's official tier distribution. The resulting drop table is the one consumed by manual/batch openings, the Case Operator, legacy/offline opening paths, displayed odds, EV, opening statistics, and simulations. Wear, float, Pattern, StatTrak eligibility, and item identity remain downstream independent rolls.

The production catalog contains 42 imported standard key-opened weapon cases. It currently contains no souvenir package, sticker capsule, terminal, or other disclosed container class. The tiny built-in test/fallback catalog is explicitly `custom` and is never presented as production CS2 odds. Future nonstandard containers must opt into `custom` and implement the corresponding disclosed table; they must not inherit standard weapon-case odds.

The old first-opening Special override and the later fabricated Gold near-miss reel card are both removed. Reward generation always occurs before animation and the reveal cannot reroll it. There is no pity mechanic.

## Quest catalog

There are 36 stable handcrafted quest definitions, organized into five types:

| Type | Count | Quests |
| --- | ---: | --- |
| Story | 8 | The First Crack; The Curator's Path; Rook's Opening Race; Pattern Language; Contract Science; The Broker's Code; Case Chronicle; The Gilded Circle |
| Collection Hunts | 12 | Sidearm Sampler; Rifle Rack; SMG Circuit; Shotgun Row; Sniper Ledger; Factory File; Field-Tested Stories; Wear Spectrum; Pink Dossier; Red Archive; Pattern Echoes; Current Run Mosaic |
| Opening | 8 | Three-Case Tour; Session Rhythm; Kilowatt Study; Revolution Record; Personal Value Record; Covert Watch; Gold Watch; Batch Discipline |
| NPC contracts | 5 | Mara's Sidearm Request; Mercer's Rifle Request; Iris's Pattern Sample; Kade's Result Set; Sana's Settled Ledger |
| Weekly side quests | 3 | Weekly Case Rotation; Weekly Active Shift; Weekly Broker Notes |

Requirements read authoritative collection, inventory, journal, statistics, Career, and NPC state. Discovery goals remain complete after sale. Ownership goals re-evaluate the current inventory. Delivery goals reject locked, favorite, and Trophy Room items, remove the chosen instance through the reducer once, and record that disposal in the economy ledger. One instance therefore cannot be delivered twice.

Players may track up to three quests. The Home and Cases screens show a compact tracked-goal widget. The `/quests` screen provides Current Quests, Collection Hunts, Characters, and Completed & Journal sections. Daily objectives remain separately linked and labeled.

### Rewards and safeguards

| Quest band | Typical stage rewards | Safeguards |
| --- | --- | --- |
| Beginner | 45–100 Career XP, $0.50–$2 Opening Credit, occasional $2–$3 cash | Stable request and stage-period identity; no item rewards |
| Intermediate | 90–220 Career XP, $0.50–$2 credits, modest reputation/cosmetics | Cash is reducer-capped at $100 per stage and credits at $10 per stage |
| Advanced optional | 180–450 Career XP, recognition title/decoration, bounded credits | No guaranteed rare skin, no altered odds, no timer pressure |
| Weekly | 80–110 Career XP, $0.50–$1.50 credits, at most $3 cash | Monotonic period, one progress instance and claim per week, bounded processed IDs |

Opening Credit retains its existing noncash restrictions and global cap. Quest requests are retained in a bounded exact-once ledger. Career XP has its own stable `quest:<quest>:<stage>:<period/run>` identity. Reloads, UI rerenders, repeated reducer actions, and cloud import cannot replay a claim.

## Recurring cast

| NPC | Role | Functional interaction |
| --- | --- | --- |
| Mara Voss | Beginner collector | First collection story, sidearm delivery, beginner weekly shift |
| Eli Mercer | Veteran collector | Breadth and rifle/wear hunts |
| Iris Vale | Pattern specialist | Journal/Pattern education and an exact sample delivery |
| Rook Vega | Rival trader | Bounded Current Run discovery score; no multiplayer claim or odds manipulation |
| Dr. Kade | Trade-up researcher | Honest completed-contract milestones and research reputation |
| Finn Blaze | Case enthusiast | Case variety, sessions, and journal records |
| Sana Bell | Market broker | Settled CSWEAR sales and credible realized outcomes |
| Anton Gild | High-end collector | Optional Covert/Gold lifetime recognition |

Each character has local original SVG portrait art created for this project, short introduction/stage dialogue, seen-dialogue state, bounded history, reputation, interests, and quest involvement. Rook's rival score is a deterministic bounded function of run activity; it is not real-time multiplayer and never affects drops.

## Rare reveal and Drop Journal

Classified results receive a short pink accent and original synthesized tone; Covert results receive a stronger red treatment; Rare Special/Contraband results receive the gold reveal, full Pattern/float line, persistent close step, first-rare and personal-best markers, and an original synthesized tone. Reveals remain skippable, keyboard accessible, bulk compatible, sound-setting aware, and covered by the global reduced-motion CSS policy.

The permanent journal records only generated openings from manual, automation, or Case Operator paths. Marketplace purchases and non-opening rewards never qualify. A record stores the exact instance/skin identity, source case, run ID, date, rarity, wear, float, paint seed, verified Pattern metadata, and value at discovery. It stores at most 100 entries and 480 recent event identities, while lifetime aggregate counters and first/best IDs remain compact. v40 deliberately starts legacy players with an empty journal rather than fabricating historical records.

## Prestige and persistence

- Lifetime story progress, NPC reputation/history, cosmetics, and the complete Drop Journal survive Prestige.
- Current Run quest progress, run case/session counters, and Rook's run score reset.
- Weekly progress resets only when a new monotonic week is observed; Prestige does not mint an extra weekly reward.
- All Time Collection drives lifetime quests; Current Run Collection drives run-scoped quests.
- Save v39 → v40 creates empty quest/journal state without touching cash, inventory, item IDs, paint seeds, floats, cost basis, Career XP, employees, Prestige, Vault, CSWEAR escrow, or cloud lineage.

## Balance evidence

The deterministic early-game model ran 500 seeds for six playstyles at 15, 30, 60, 120, 600, and 3,000 active minutes. At two hours: fresh beginners averaged 59.96 opens / 7.10 quest stages / $50 cash; opening-focused players 70.66 / 7.26 / $10.83; collectors 39.99 / 7.00 / $92; traders 29.99 / 7.00 / $165.90; quest-focused players 60 / 7.10 / $75.69; and Work-focused players 24 / 7.00 / $188.12. Every profile retained at least two modeled available quests, recorded zero repeated rewards, and had no majority bankruptcy. Total modeled quest/daily credit support remained capped at $20 through 50 hours. Opening-focused waiting time remains intentionally higher because official negative-EV cases were not made profitable.

The full Career simulation remains the authority for the 95-upgrade/five-employee/Prestige economy and is rerun by `npm run simulate:career`.

## Known limitations and Prompt 2 boundary

- NPC dialogue is curated local text, not a generative service.
- Rival activity is transparent deterministic simulation, not multiplayer.
- Generic skin thumbnails do not render the exact Pattern seed.
- The current production catalog has no nonstandard containers to exercise the other official disclosure tables.
- Live Supabase Auth/RLS/RPC and physical multi-device cloud behavior require project credentials and are not claimed from local tests.
- Prompt 2 may expand living-world content, but Case Mastery and a replacement Dynamic Events system are intentionally not part of this implementation.
