# CS2 Case Opening Simulator

A client-side CS2 case-opening game built with React, TypeScript, and Vite. It includes 42 cases, 2,092 skins, weighted drops, roulette reveals, inventory and selling, trade-ups, collection tracking, market simulation, progression systems, local saves, and optional Supabase cloud saves.

## Requirements

- Node.js 20.19 or newer
- npm 11 (the repository uses `package-lock.json` as its authoritative lockfile)
- About 220 MB of free space for generated CS2 images plus build output

## Clean installation

The large generated image set is intentionally not committed. A small checksummed manifest is committed instead, so a clean checkout can reproduce the exact required files.

```bash
npm ci
npm run assets:sync
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173/`.

`assets:sync` downloads only missing or corrupt files and verifies all 2,134 images against their recorded sizes and SHA-256 checksums. Development and production builds run `assets:verify` first and stop with an actionable error if the image set is incomplete.

## Development commands

```bash
npm run dev                 # Verify assets, then run Vite with HMR
npm test                    # Run the Vitest suite
npm run typecheck           # Run TypeScript project checks
npm run lint                # Run ESLint
npx playwright install chromium
npm run test:e2e            # Run Chromium critical-flow and responsive tests
npm run assets:verify       # Verify all generated case and skin images
npm run generate:pattern-lookups # Rebuild compact pattern lookup data
npm run build               # Verify assets, type-check, bundle, and generate the PWA
npm run verify:pwa          # Inspect the completed release output
npm run verify:release      # Lint, test, build, and verify the PWA
npm run preview:prod        # Preview the production build locally
```

## CS2 catalog and assets

Runtime catalog data is generated into `src/data/generated/`. The corresponding binaries live in ignored `public/assets/cs2/` directories to avoid adding roughly 197 MiB of images to normal Git history.

The committed `src/data/generated/cs2-assets.manifest.json` contains each public path, stable source URL, byte size, and SHA-256 checksum. This gives clean installations and deployment jobs a reproducible image step without committing thousands of binaries.

To reproduce the current assets:

```bash
npm run assets:sync
```

To refresh the catalog from a newer ByMykel CSGO-API dataset:

1. Place the source JSON files in `../CSGO-API/public/api/en`, or update the ignored `asset-import.config.json`.
2. Optionally provide `../CounterStrike2Skins/images` as an image-only fallback.
3. Run `npm run import:cs2-assets`.
4. Review `src/data/generated/import-report.txt` and the regenerated asset manifest.
5. Run `npm run verify:release`.

The importer writes images into `public/assets/cs2`, regenerates skin/case/rarity modules, and records a manifest for later clean-checkout recovery. At runtime, the shared image component retries once and displays `public/assets/placeholder.png` if an individual image cannot load.

Public image and sound URLs are resolved through Vite’s base path. Root hosting and subpath hosting such as GitHub Pages therefore use the same generated catalog safely.

## Game mechanics notes

- New saves start at `$100`.
- Kilowatt and Revolution are open by default. Other priced cases require a one-time license.
- Case opening commits its economic transaction once, then runs an independent UI animation session. Notification clearing, route changes, cloud merges, and unrelated settings updates do not interrupt the active roll.
- The Work screen contains Poop Cleaning, Sort Boxes, Precision Strike, and Memory Circuit jobs with capped performance rewards and persisted cooldowns.
- Trade-ups validate contract inputs but intentionally allow value-negative attempts.
- Batch opening begins with Open 1 and Open 10; upgrades and skills unlock larger batches.
- Optional cloud save uses Supabase when its environment variables are present and otherwise uses the local mock backend.

## Optional environment variables

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_BASE_PATH=/case-opening-simulator/
```

See `docs/release-deployment.md` for production hosting, PWA behavior, and deployment checks. Performance budgets and measured bundle changes are in `docs/performance-budget.md`; Work reward math is in `docs/work-economy.md`. See `docs/supabase-cloud-setup.md` for account, RLS, conflict-resolution, privacy, and real-backend verification instructions.
