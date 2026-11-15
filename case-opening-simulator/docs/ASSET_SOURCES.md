# Visual asset sources

Last verified: 2026-11-15

All assets listed here are stored locally under `public/assets/work/` or `public/assets/business/`; the game does not hotlink them and they remain available offline. Files were selected from the original publisher pages, not from image-search mirrors. No attribution is required for CC0 material, but the sources are recorded for provenance and future maintenance.

## Kenney CC0 packs

Kenney's asset pages and the included `License.txt` files identify these packs as **CC0 1.0 Universal / public domain**. Commercial use, modification, and redistribution are permitted without attribution.

| Source pack | Original URL | Local use |
| --- | --- | --- |
| Sokoban | <https://kenney.nl/assets/sokoban> | Colored crates, packages, and sorting docks for Sort Boxes and Warehouse Rush |
| Pixel Platformer | <https://kenney.nl/assets/pixel-platformer> | Dirt/stone blocks and pickaxe art for Diamond Miner |
| Tiny Factory | <https://kenney.nl/assets/tiny-factory> | Horizontal and vertical conveyor tiles for Warehouse Rush |
| Racing Pack | <https://kenney.nl/assets/racing-pack> | Delivery van and road tiles for Package Delivery |
| Crosshair Pack | <https://kenney.nl/assets/crosshair-pack> | Precision Strike target artwork |
| UI Pack: Sci-Fi | <https://kenney.nl/assets/ui-pack-sci-fi> | Illuminated red, green, blue, and yellow Memory Circuit pads |
| Toon Characters | <https://kenney.nl/assets/toon-characters> | Five employee portraits on the Business page |

Selected Kenney files were renamed descriptively and retained as compact PNGs. The committed selection is approximately 35 KiB rather than the full source archives.

## OpenGameArt CC0 assets

| Asset | Creator | Original URL | License | Local use |
| --- | --- | --- | --- | --- |
| Trash can | ItzNinjaFool / Christopher Smith | <https://opengameart.org/content/trash-can-0> | CC0 (the page also offers GPL; this project uses the CC0 grant) | Poop Cleaning disposal target |
| Circuit Tileset | eugeneloza | <https://opengameart.org/content/circuit-tileset> | CC0 | `circuit-01.png` through `circuit-17.png` and Circuit Repair pieces |
| Ore Tileset — Eight Ores | DavoltC | <https://opengameart.org/content/ore-tileset-eight-ores> | CC0 | Coal, iron, gold, diamond, and stone tiles in Diamond Miner |

## Integration and performance policy

- Only the required sprites are committed; source ZIP files and the temporary download staging directory are excluded.
- Assets are loaded from same-origin `/assets/...` paths and are included by the PWA's runtime asset caching rules.
- Images use intrinsic aspect ratios and `object-contain` to avoid stretching and layout shift.
- Pixel sprites use nearest-neighbor rendering where appropriate; employee portraits remain small transparent PNGs.
- `src/utils/visualAssets.test.ts` verifies that representative required files exist and are non-empty.
- If a source is replaced, update this file and keep evidence of an equally permissive license. Assets with unclear licensing must not enter the repository.
