# Release Build And Deployment Guide

This guide covers production builds, PWA verification, and static hosting for Case Opening Simulator.

## Release Commands

Run the full local release gate before tagging or deploying:

```bash
npm ci
npm run assets:sync
npm run verify:release
```

`verify:release` runs lint, the Vitest suite, a production build, and `scripts/verifyReleaseBuild.mjs`, which checks:

- hashed production assets in `dist/assets`
- `manifest.webmanifest`
- `sw.js`
- core cached assets such as `favicon.svg`, `icons.svg`, `assets/placeholder.png`, and `sounds/case-opening.mp3`
- runtime caches for CS2 images and sounds
- all 2,134 generated CS2 images listed in the checksummed asset manifest

For a quick production build only:

```bash
npm run build
npm run verify:pwa
npm run preview:prod
```

## Vite Production Configuration

Production config lives in `vite.config.ts`.

- `base` defaults to `/` and can be overridden with `VITE_BASE_PATH`.
- GitHub Pages uses `npm run build:github`, which builds with `/case-opening-simulator/`.
- Vite emits hashed JS/CSS/assets for cache busting.
- `vite-plugin-pwa` generates the PWA manifest and service worker.
- Chart.js is dynamically imported only when a chart is mounted. Generated catalog, price, pattern, React, icon, and virtualization code uses stable cacheable chunks; current measurements and accepted limits are in `performance-budget.md`.

## PWA Behavior

PWA settings live in `pwa.config.ts`.

- The app shell, manifest, favicon, placeholder image, icons SVG, and primary case-opening sound are pre-cached.
- Generated CS2 catalog images under `assets/cs2` are not pre-cached because the dataset can be large.
- CS2 images and sounds are cached at runtime after first use.
- `PWAUpdatePrompt` displays update/offline-ready notifications and lets players reload when a new build is available.

## Static Asset Notes

Before release:

- Keep generated CS2 images in `public/assets/cs2` out of normal Git history. They currently total roughly 197 MiB.
- Run `npm run assets:sync` on a clean checkout. It downloads only missing or corrupt files from the committed `src/data/generated/cs2-assets.manifest.json` and verifies their sizes and SHA-256 checksums.
- `npm run dev`, `npm run build`, and `npm run build:github` refuse to start when required images are missing. This prevents a release from silently shipping a text-only catalog.
- Use `npm run assets:verify` for an offline integrity check. It never downloads files.
- Regenerate the manifest with `npm run import:cs2-assets` when updating the upstream catalog. Review the generated import report before committing catalog changes.
- Compress any new image/audio assets before adding them to `public`.
- Keep sounds short and web-friendly (`mp3`, `ogg`, or compressed `wav`).
- Run `npm run build` and watch for oversized chunks. The generated skin/case data chunks are expected to be large; split or defer them if startup becomes slow.
- Run `npx playwright test` after the release gate. It covers the focused Work games, 1/2/3/5/10 openings, exact-once transactions, persistence, all player routes, console errors, and 1920×1080, 1366×768, 1280×720, and 390×844 layouts.

## Dependency Audit

Use:

```bash
npm audit
npm ls --depth=0
```

Current runtime dependencies are used by the app:

- `chart.js` / `react-chartjs-2` for charts
- `lucide-react` for UI icons
- `nanoid` for IDs
- `react`, `react-dom`, `react-router-dom`
- `react-window` for virtualized inventory rendering
- `workbox-window` for the PWA registration and update prompt

Do not remove `ts-node`; it powers the CS2 asset importer.

The project declares npm in `packageManager` and uses `package-lock.json`. Do not generate or commit a second lockfile.

## Settings scope

The release provides sound effects and case-opening audio but no background-music library. The interface is English-only. Misleading Music and Language controls were removed while their legacy serialized fields remain readable for save compatibility.

## Environment Variables

Optional cloud save uses Supabase. If unset, the app falls back to local mock cloud storage.

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_BASE_PATH=/case-opening-simulator/
```

Apply both migrations, in order, before enabling cloud save in production:

1. `supabase/migrations/20260625_optional_cloud_saves.sql`
2. `supabase/migrations/20261016_social_cloud_v29.sql`

The second migration adds private profiles, opt-in public summaries and trophies, security-invoker public views, and the atomic revision-checked save RPC. Never place a Supabase service-role key in a Vite environment variable; the browser must use only the public anon key. See `docs/supabase-cloud-setup.md` for the complete authentication, policy, rate-limit, and verification checklist.

The local/mock cloud path is covered by automated tests. Live Supabase signup, email delivery, RLS/RPC, cross-device conflicts, and production rate limits still require a configured project and must not be described as verified until that checklist is completed with real credentials.

## GitHub Pages

1. Commit your source changes.
2. Build and publish:

```bash
npm ci
npm run assets:sync
npm run deploy
```

3. In GitHub repository settings, set Pages to deploy from the `gh-pages` branch.
4. Verify the deployed URL loads, the PWA manifest is reachable, and localStorage save/load persists after reload.

If your repository name is not `case-opening-simulator`, update the `build:github` base path in `package.json`.

## Vercel

1. Import the repository in Vercel.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add `npm run assets:sync` before the build in the provider's install/build pipeline, or restore a verified asset cache keyed by `cs2-assets.manifest.json`.
5. Add optional environment variables for Supabase cloud save.
6. Deploy and verify:
   - app loads at the production URL
   - opening a case updates localStorage
   - reload keeps save progress
   - PWA manifest and service worker are served

## Netlify

1. Import the repository in Netlify.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Run `npm run assets:sync` before the build, or restore a verified asset cache keyed by the manifest.
5. Add optional environment variables in Site configuration.
6. For client-side routing, add a redirect rule if needed:

```txt
/* /index.html 200
```

## Static S3 Bucket

1. Run `npm ci`, `npm run assets:sync`, and `npm run build`.
2. Upload `dist` to the bucket.
3. Configure the bucket or CDN to serve `index.html` for unknown routes.
4. Set long cache headers for hashed assets and shorter cache headers for `index.html`, `sw.js`, and `manifest.webmanifest`.
5. Serve over HTTPS; service workers require a secure context.

## Release Tags

Use semantic version tags after the release gate passes:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Post-Release Checklist

- Open the deployed app on desktop and mobile.
- Confirm localStorage save/load still works after reload.
- Confirm cloud save login/sync works if Supabase env vars are configured.
- Confirm a stale second device produces a conflict choice instead of merging money or inventories.
- Confirm private profiles and trophy showcases cannot be read from another account.
- Treat published rankings as client-reported until game results are validated by an authoritative server.
- Confirm the service worker installs and update prompts appear on a later deployment.
- Monitor hosting logs, browser console reports, and user feedback.
- Track performance on the main case opening flow, inventory, and collection book.
- Plan content patches for new cases, market tuning, assets, and achievement balancing.
