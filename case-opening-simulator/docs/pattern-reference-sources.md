# Paint-pattern reference data and valuation policy

Updated: 2026-10-16

The simulator separates facts that can be reproduced from the game data from market-value estimates. A pattern name or percentage can be reproducible while its price premium is still only an estimate.

## Reproducible data sources

- Paint seeds use Valve's inclusive `0–1000` range.
- Fade percentages use the MIT-licensed [`csgo-fade-percentage-calculator`](https://github.com/chescos/csgo-fade-percentage-calculator). It implements Valve's pattern transform and model-specific normal/reversed UV mapping. The project reports use by CSFloat, Skinport and CSGOSKINS.GG, among others.
- Case Hardened and Heat Treated blue-coverage percentages use the MIT-licensed [`csgo-blue-gem-calculator`](https://github.com/chescos/csgo-blue-gem-calculator). It uses model-specific pixel regions (for example AK top/magazine versus knife play/back side), so coverage is never treated as universal across weapons.
- Doppler and Gamma Doppler variants use the catalog's paint-kit metadata. The local CSGO-API snapshot identifies Ruby (415), Sapphire (416), Black Pearl (417), Doppler phases 1–4 (418–421), Emerald (568), and Gamma phases 1–4 (569–572). A seed is still stored for item identity, but it does not choose the phase.

## Curated community classifications

- AK-47 Case Hardened tiers are based on the weapon-specific tier list published by [CS2 Pattern Prices](https://cs2pattern-prices.com/guides/blue-gem-tier-guide): Tier 1 seeds `151, 179, 321, 387, 661, 670, 955`; Tier 2 seeds `4, 13, 168, 429, 592, 905`. Pattern 661 is labeled iconic only on the AK-47.
- Five-SeveN Tier 1 uses the weapon-specific seeds documented by [CS2 Search](https://cs2search.app/guide/five-seven/case-hardened/blue-gem): `278, 363, 670, 690, 768, 868`.
- Karambit Case Hardened seed 387 is treated as an iconic named Blue Gem. Other Case Hardened and Heat Treated items use measured model-specific blue coverage with conservative generic labels; the simulator does not assert an unverified community tier.
- Karambit Marble Fade uses model-specific Max Fire & Ice lists: first max `412`; second max `16, 146, 241, 359, 393, 541, 602, 649, 688, 701`. The same seeds are deliberately not applied to other knife models because UV layouts differ.

## Premium policy

The premium table is a game-economy estimate, not a live cash appraisal:

| Classification | In-game multiplier |
| --- | ---: |
| Ordinary seed / unsupported pattern | 1.00× |
| High Fade (93%+) | 1.10× |
| Near Full Fade (97%+) | 1.20× |
| Full Fade (99.5%+) | 1.35× |
| Doppler Phase 2 / Phase 4 | 1.20× / 1.10× |
| Gamma Doppler Phase 2 / Phase 4 | 1.25× / 1.10× |
| Ruby / Sapphire / Black Pearl / Emerald | 3.5× / 4× / 3× / 4× |
| AK Tier 2 / Tier 1 / seed 661 | 6× / 18× / 100× |
| Five-SeveN Tier 1 | 6–8× |
| Karambit Marble Fade 2nd / 1st Max | 3× / 6× |
| Karambit Case Hardened seed 387 | 250× |

Measured high-blue patterns that are not in a curated weapon tier receive smaller bounded multipliers. Most seeds remain at 1.00×. Final values are finite, nonnegative, rounded to cents, and capped at $1 billion. Market simulation changes the base condition value and then reapplies the single stored intrinsic pattern multiplier; it does not compound the pattern premium on each tick.

## UI limitation

The catalog contains one thumbnail per finish/paint-kit, not a render for every seed. Interfaces explicitly state that a thumbnail does not depict the seed-specific appearance. The project does not generate or present fake seed screenshots.
