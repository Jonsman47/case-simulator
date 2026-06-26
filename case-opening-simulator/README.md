# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Release Builds

Use `npm run verify:release` before publishing. It runs linting, tests, a production build, and PWA output checks. See [docs/release-deployment.md](docs/release-deployment.md) for GitHub Pages, Vercel, Netlify, S3, Supabase environment variables, and the post-release checklist.

## Game Mechanics Notes

- New saves start at `$50`. Kilowatt and Revolution are open by default; every other priced case requires a one-time license before it can be opened.
- Case license costs are derived from the case price and discounted by applicable upgrades, prestige bonuses, and skill-tree license perks. Buying a license adds the case to the unlocked list permanently for that save.
- The hourly side job, **A Clean Pooping Job**, pays normal game currency and stores its cooldown in a separate localStorage key so refreshing cannot replay the reward.
- Event rewards use standard money, items, price movement, drop modifiers, or discounts. Event-token currencies are intentionally not part of the economy.
- The Admin Panel is visible only to the `Jonsman` account/session and the `/events` route redirects non-admin sessions back home.
- Trade-ups only block invalid contracts: wrong count, mixed rarity, locked/favorited inputs, or no possible outcome. They do not block value-negative attempts; the player decides whether the risk is worth taking.
- Batch opening starts with Open 1 and Open 10. Bulk Loader upgrades and Opening Line skill-tree tiers progressively add Open 20, Open 30, and later buttons up to the supported cap.
- The case-opening animation is a CS-style horizontal item ticker. It keeps a content-width reel and extra cards after the target item so the stream does not expose the dark stage before the final card lands.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## CS2 Asset Import

The simulator can import real CS2 skin and case definitions from the ByMykel CSGO-API dataset while still falling back to the placeholder seed data when generated files are absent.

1. Download or update the datasets outside version control:
   - `../CSGO-API/public/api/en` must contain `skins.json`, `skins_not_grouped.json`, and `crates.json`.
   - `../CounterStrike2Skins/images` is optional and used only as an image fallback.
2. Edit the ignored `asset-import.config.json` if your local paths differ.
3. Run:

```bash
npm run import:cs2-assets
```

The importer writes downloaded images to `public/assets/cs2`, generated TypeScript data to `src/data/generated`, and a validation report to `src/data/generated/import-report.txt`.

Raw datasets, `asset-import.config.json`, and downloaded image output are ignored by Git. Commit generated TypeScript files when you want the app to use the imported catalog. The runtime uses Vite glob imports to detect generated files; if `skins.generated.ts` or `cases.generated.ts` are missing, the existing placeholder skins and cases remain active.

When generated modules are present, the game reads imported skin float bounds, wear ranges, rarity display names, rarity colours, drop tables, StatTrak/Souvenir availability, and image paths directly from those files. Images are served from `/assets/cs2/...` through public URLs instead of being imported into the bundle, with a shared fallback image handler for missing assets.

To update for new CS2 content, refresh the ByMykel API dataset, rerun `npm run import:cs2-assets`, review `src/data/generated/import-report.txt` for missing references or image fallbacks, then rebuild and test the app.

The CounterStrike2Skins fallback is intentionally image-only. Its `output.jsonl` metadata is used to match a skin image by normalized name when the API image download fails; it is not used for cases, floats, prices, or drop tables.

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
