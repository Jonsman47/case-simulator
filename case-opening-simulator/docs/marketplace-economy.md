# Simulated Marketplace and Economy

Updated: 2026-11-11 · Save schema: v34

## Scope and safety

This is a fictional in-game market. It never connects to Steam trading, handles real money, or claims that simulated prices are cash offers. Reference catalog prices and documented Pattern evidence feed the existing valuation engine; NPC activity is generated locally and remains clearly labeled as simulated.

## Virtual catalog and supply

- `Market` is the non-transactional price checker. `CSWEAR` is the simulated marketplace. The Market price checker shows a live O(1) offer count and deep-link for every skin; CSWEAR contains browsing, buying, negotiation, owned-item listing, escrow and history.
- CSWEAR begins with a catalog of all 2,092 supported skins. Every card shows its image, rarity, lowest simulated asking price, complete pattern-aware value range and skin-specific estimated offer count.
- Supply is calculated in O(1) per skin from rarity, reference value, weapon demand, number of source cases/collections, deterministic circulation history and the current market epoch. Cheap circulating skins can have tens or hundreds of thousands of offers; elite items may have single-digit supply.
- Counts are explicitly labeled **simulator estimates**. They are not represented as live CSFloat, Steam or third-party inventory.
- The total market can contain millions of offers without allocating millions of objects. The UI starts with 24 listings, grows automatically near the bottom, and uses `react-window` so only nearby rows are mounted. At most 18 generated listing pages are retained in the component cache; evicted pages regenerate deterministically when revisited.
- Listing IDs derive from the persisted market epoch, skin and source index. Seven-day epochs give every newly generated virtual listing exactly seven real-world days between `createdAt` and `expiresAt`; player listings already use the same lifetime. Long offline gaps jump directly to the current epoch instead of replaying or reviving expired populations.
- Wear, edition, float, Pattern ID/classification/tier, seller and price filters are applied during bounded deterministic population scans. Sorting includes price, float, credible discount, creation/expiry and Pattern value. `Best deals` discounts estimated-confidence Patterns so uncertain appraisals cannot dominate solely on an unreliable valuation.

## Exact listings and Pattern scarcity

- Each generated listing contains an exact item instance: base skin, wear, float, Pattern ID/classification, StatTrak/Souvenir state, estimated value, seller, creation/expiry times, derived active/expired status, liquidity and scarcity.
- Ordinary listings regenerate identically from their stable ID inputs. Interacted listings are compact persisted exceptions; negotiation state and seller memory therefore survive epoch changes and reloads.
- Purchased virtual IDs are stored in a removal ledger and are excluded from subsequent regeneration. The reducer also retains the request ledger, so repeat clicks cannot charge or transfer twice.
- Documented notable, rare, exceptional and iconic Patterns receive progressively stronger availability gates. Exact Pattern supply uses deterministic stochastic rounding; `0 active listings` is a normal, stable result for elite seeds such as AK-47 Case Hardened Pattern #661.
- Pattern scarcity is skin-specific because classification comes from the existing weapon/finish classifier. The simulator never applies seed 661 or another universal premium to unrelated finishes.

## NPC behavior and negotiation

- Eighteen stable hidden archetypes generate a much larger population of distinct sellers. Identity, username, avatar, patience, price expectations, negotiation tolerance and reputation are deterministic per listing; the archetype label remains hidden.
- A seller receives a stable reservation floor when the listing is created. Negotiation rounds mutate remembered history and patience; reopening the dialog does not create a new floor.
- Higher asking prices, thin supply and exceptional variants generally increase resistance. Coherent offers can be rejected, countered or accepted; regressive lowballs consume patience and can end the conversation.
- Buying after acceptance charges the accepted amount once, removes the exact listing once, records history, increments market statistics and presents the shared NEW/Claim reveal. The request ledger rejects repeated transaction IDs.

## Player listings and NPC buyers

- Listing an owned unlocked item moves it to escrow immediately. Cancellation and expiry restore that exact instance; no valuation or Pattern field is regenerated.
- Periodic market ticks may create one bounded NPC offer based on asking price versus fair value, item liquidity, rarity, Pattern, float and the buyer's preferences. Attractive liquid listings sell faster; unreasonable asks can remain unsold indefinitely.
- Accept and decline are explicit. Accepted sales credit once and append durable transaction history. Offers and listings survive save/load.

## Instant selling and auto-sell

- Manual, bulk and automatic instant sales use the same deterministic item quote. Baseline liquidity returns 85–95% of current item value; existing legitimate progression bonuses are applied and the final quote is safely bounded and displayed before confirmation.
- `Sell Duplicates — Keep Best` groups by base weapon/finish identity and can retain a custom N eligible copies. It ranks by actual final item value with deterministic tie-breaking.
- Locked, favorite, exceptional Pattern, knife/glove and configured StatTrak/Souvenir protections are retained in addition to N. The preview separates kept/protected items from proposed sales.

## Current trade-up model

- Ordinary contracts require ten compatible inputs and output the next rarity.
- Five Covert inputs use the October 22, 2025 CS2 rule: regular inputs can yield a regular knife or gloves from valid source pools; StatTrak inputs can yield a StatTrak knife and never gloves.
- Current Souvenir behavior follows the May 21, 2026 update: Souvenir and normal inputs may be mixed, while Souvenir properties are removed from the output.
- Each input contributes source-pool probability; outputs are uniform inside the selected valid source pool. The UI exposes outcome odds, predicted float/wear/value and expected value.
- Input wear is normalized against every input skin's own min/max range, averaged, then mapped into the selected output skin's min/max range. The output receives a fresh immutable Pattern exactly once.

## Persistence and authority

- v31 saves migrate through v32 and v33 to v34. v33 realigns virtual supply to persisted seven-day epochs; v34 adds bounded economic accounting while retaining marketplace escrow, transactions, materialized negotiations, removed-ID tombstones and all player progress. Inventory, money, IDs, float and Patterns are never rerolled.
- The save stores only player listings, transaction history, request IDs, removed virtual IDs and interacted NPC listings. It never stores the simulated catalog population.
- Local guest play is client-authoritative because the project is a static PWA. Reducer transactions are atomic and idempotent within the saved game, but local state is not a cheat-resistant server boundary.
- `supabase/migrations/20261105_marketplace_v31.sql` adds normalized NPC/listing/negotiation/history/request-ledger tables, RLS/grants, and an idempotent `marketplace_buy_now` RPC that row-locks both listing and save before transferring the exact JSON item and currency in one database transaction.
- That migration was not deployed or tested in this workspace because no live Supabase URL/key/service credentials were supplied. The frontend local reducer does not pretend that this unavailable deployment was verified.

## Performance targets

- Catalog supply precomputation: under 250 ms in the unit benchmark.
- First dedicated listing batch: under 250 ms on the development reference machine.
- Page 1,001 of a high-supply skin: under 2 seconds and fewer than 30,000 generated candidates.
- Mounted listing rows: viewport plus three overscan rows. Generated page cache: at most 18 pages plus compact interacted exceptions.
- No full-market scan is used for catalog sorting or offer counts.

## Reference supply snapshot

With the 2026-11-06 catalog and base reference values, the deterministic model reports 188,981,378 active offers. Applying the live simulated market modifiers in the verified browser session produced 167,515,785. Representative base-reference counts were:

- P250 | Sand Dune: 849,589 offers.
- AWP | Dragon Lore: 966 offers.
- Karambit | Case Hardened: 54 offers.
- AK-47 | Case Hardened Pattern #661: zero offers in the verified epoch.

These are calibrated simulator populations and deliberately are not described as real third-party listing counts.

## Verification

- Unit coverage includes total supply, common-versus-elite circulation, iconic Pattern zero-supply epochs, deterministic identities, stable non-overlapping batches, seven-day expiry, filters, sorting, purchased-ID exclusion, negotiation overrides, high-offset performance, exact-once reducer and ledger transfer, escrow, and v34 save migration.
- Browser coverage verifies Market → CSWEAR deep links, continuous virtualized loading, bounded mounted rows, catalog → dedicated skin market → exact purchase and the compact removal ledger.
- Verification passes: 70 Vitest files/376 tests, zero-error lint, TypeScript, production/PWA build, 2,134-asset verification, `verify:release`, and 16/16 Chromium journeys. The two changed Market/CSWEAR journeys were rerun after final cursor-restoration hardening and passed 2/2.

## Primary rules references

- [Valve, October 22, 2025 update](https://www.counter-strike.net/newsentry/516350567072662004?l=english): five regular Covert items for a regular knife/gloves; five StatTrak Covert items for a StatTrak knife.
- [Valve, May 21, 2026 update](https://store.steampowered.com/news/posts/?appids=730&enddate=1779410445): Souvenir items may be mixed with normal items and lose Souvenir properties in trade-ups.
- Detailed probability and normalized-float implementation follows the current community-documented contract model where Valve's update notes do not publish an equation.
