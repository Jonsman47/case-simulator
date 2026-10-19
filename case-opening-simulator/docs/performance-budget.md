# Performance Budget

Measured on 2026-10-19 with `npm run build` on Node 22-class tooling. Sizes are Vite minified output; gzip values are Vite's computed transfer estimates.

| Chunk | Before Prompt 5 | After Prompt 5 | Final Prompt 6 | Final change from Prompt 5 |
| --- | ---: | ---: | ---: | ---: |
| Application entry | 620.88 kB / 194.22 kB gzip | 623.85 kB / 194.90 kB gzip | **202.52 kB / 54.18 kB gzip** | **-421.33 kB / -140.72 kB gzip** |
| React/router vendor | bundled in entry | bundled in entry | 225.17 kB / 72.13 kB gzip | separated and cacheable |
| Lucide icons | bundled in entry | bundled in entry | 34.04 kB / 11.77 kB gzip | separated and cacheable |
| Startup app + framework | 620.88 kB / 194.22 kB gzip | 623.85 kB / 194.90 kB gzip | **461.73 kB / 138.08 kB gzip** | **-162.12 kB / -56.82 kB gzip** |
| Chart renderer | bundled in entry | bundled in entry | 203.04 kB / 69.59 kB gzip | lazy, loaded only when a chart mounts |
| Pattern lookups | 1,012.82 kB / 396.92 kB gzip | 308.40 kB / 75.85 kB gzip | 302.88 kB / 73.55 kB gzip | -5.52 kB / -2.30 kB gzip |
| Price data | 648.70 kB / 124.16 kB gzip | 291.68 kB / 80.56 kB gzip | 206.86 kB / 55.79 kB gzip | -84.82 kB / -24.77 kB gzip |
| Case catalog | shared with other data | shared with other data | 219.77 kB / 18.18 kB gzip | separate generated-data chunk |
| Skin catalog | 1,310.28 kB / 114.16 kB gzip | 1,310.28 kB / 114.16 kB gzip | 1,309.57 kB / 114.27 kB gzip | effectively unchanged |
| PWA precache | 91 entries | 96 entries / 4,155.31 KiB | 78 entries / 4,178.38 KiB | route/data split reflected in manifest |

Prompt 6 removes Chart.js from the startup dependency graph with `DeferredChart`, keeps route screens lazy, and assigns stable cacheable chunks to React, icons, virtualization, generated skin data, generated prices, and pattern lookups. `index.html` no longer preloads the chart renderer. Price and pattern records remain decoded/cached once, inventory and market lists remain virtualized, and images retain lazy loading, async decoding, fallback handling, and fixed object-contain dimensions.

## Release budgets

- Application entry: target ≤ 225 kB raw and ≤ 65 kB gzip.
- Startup app + React/router/icons: target ≤ 500 kB raw and ≤ 150 kB gzip.
- Lazy chart renderer: target ≤ 225 kB raw and ≤ 75 kB gzip.
- Pattern data: target ≤ 350 kB raw and ≤ 90 kB gzip.
- Price data: target ≤ 250 kB raw and ≤ 70 kB gzip.
- Any ordinary route chunk: target ≤ 100 kB raw unless documented.
- No page may create horizontal document overflow at 1920×1080, 1366×768, 1280×720, or 390×844.
- The generated skin catalog is allowed above Vite's 500 kB warning because it is a compressed, cacheable data chunk shared by catalog-heavy routes. Moving it to an indexed/static-data service would add deployment and offline complexity disproportionate to the measured gain.

Browser tests verify responsive overflow and critical journeys. Windows baselines provide local pixel comparisons; cross-platform CI uses the same semantic/layout assertions but does not compare Windows-rendered pixels against Linux Chromium. Precise cold-network and device-memory claims are intentionally omitted because this development machine and local Vite server are not a controlled lab. The measured bundle graph and long-session safeguards are the reproducible release evidence.
