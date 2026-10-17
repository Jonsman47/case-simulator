# Performance Budget

Measured on 2026-10-17 with `npm run build` on Node 22-class tooling. Sizes are Vite minified output; gzip values are Vite's computed transfer estimates.

| Chunk | Before Prompt 5 | After Prompt 5 | Change |
| --- | ---: | ---: | ---: |
| Pattern engine | 1,012.82 kB / 396.92 kB gzip | 308.40 kB / 75.85 kB gzip | -704.42 kB raw / -321.07 kB gzip |
| Price data | 648.70 kB / 124.16 kB gzip | 291.68 kB / 80.56 kB gzip | -357.02 kB raw / -43.60 kB gzip |
| Application entry | 620.88 kB / 194.22 kB gzip | 623.85 kB / 194.90 kB gzip | +2.97 kB raw / +0.68 kB gzip |
| Skin catalog | 1,310.28 kB / 114.16 kB gzip | 1,310.28 kB / 114.16 kB gzip | unchanged |
| PWA precache | 91 entries previously | 96 entries / 4,155.31 KiB | includes new lazy chunks and generated lookups |

The pattern calculators now run only in `npm run generate:pattern-lookups`; production uses a compact generated array. Generated skin prices use compact tuples, and decoded records are cached on first access. Route screens remain lazy-loaded, market/inventory lists remain virtualized, and images keep lazy loading and fixed object-contain dimensions.

## Release budgets

- Application entry: target ≤ 650 kB raw and ≤ 205 kB gzip.
- Pattern data: target ≤ 350 kB raw and ≤ 90 kB gzip.
- Price data: target ≤ 325 kB raw and ≤ 90 kB gzip.
- Any new route chunk: target ≤ 100 kB raw unless documented.
- No page may create horizontal document overflow at 1920×1080, 1366×768, or 390×844.
- The generated skin catalog is allowed above Vite's 500 kB warning while it remains a lazy shared data chunk. Prompt 6 should investigate indexed/static-data delivery rather than deleting catalog detail.

Browser tests verify responsive overflow and critical journeys. Precise cold-load timing and memory numbers are intentionally not claimed because this development machine and local Vite server are not a controlled performance lab; Prompt 6 should add repeatable Lighthouse/device profiling.
