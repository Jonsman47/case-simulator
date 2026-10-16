# Supabase account, cloud-save, and social setup

Updated: 2026-10-16

The game is fully playable as a local guest. Supabase is optional. Without both browser environment variables, the app uses a clearly labelled local mock backend stored in the current browser.

## 1. Configure a test project

Use an isolated development/test Supabase project, not a production account containing player data.

Apply these migrations in order:

1. `supabase/migrations/20260625_optional_cloud_saves.sql`
2. `supabase/migrations/20261016_social_cloud_v29.sql`

The second migration hardens private-save grants, adds optimistic revision checks, unique validated display names, opt-in public summaries, trophy snapshots, and RLS-aware public views.

Copy `.env.example` to `.env.local` and set:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

Never use a secret/service-role key in a `VITE_*` variable. Vite values are shipped to every browser. The public key is not an authorization boundary; the included grants and row-level-security policies are.

Restart the development server after changing environment variables.

## 2. Authentication settings

- Enable email/password authentication.
- Configure the Site URL and allowed redirect URLs for the deployed origin.
- Configure the password-reset email template and redirect URL.
- Decide whether email confirmation is required. When it is enabled, Supabase may create the user without immediately returning a session; the UI reports that the confirmation setting needs attention.
- Configure Supabase Auth rate limits and CAPTCHA for the deployment's expected abuse profile. Client code cannot enforce trustworthy authentication rate limits.

Sessions are stored per browser, refreshed with the Supabase refresh-token endpoint before expiry, and removed locally even if the remote logout request fails. Passwords are sent only to Supabase Auth and are never saved in game storage.

## 3. Conflict policy

Each private save has an integer revision. `save_game_if_revision` atomically updates only when the browser's expected revision matches the database row.

- Same revision: upload the local save and increment once.
- Remote revision changed but content is equivalent: accept the newer revision.
- Divergent progress: stop automatic synchronization and ask the player to choose **Keep local** or **Use cloud**.
- Before replacement, the losing version is stored as a local versioned backup.
- Balances are never added, inventories are never blindly unioned, and duplicate rewards are never inferred from counters.
- Guest and signed-in account saves use separate local snapshots. Logout restores the guest snapshot.

The local save is retained until the remote envelope has parsed successfully. Save schema migration still runs through the normal v0–v29 loader, preserving instance IDs, floats, wear, paint seeds, stored pattern identity, and pattern valuation.

## 4. Privacy and trust boundaries

`game_saves` is private and readable/writable only by its authenticated owner. Public pages use separate, limited tables:

- `profiles`: display name, icon, creation date, and opt-in flags.
- `public_player_stats`: client-reported aggregate values only.
- `public_trophy_rooms`: at most 16 selected item snapshots, never the complete inventory.
- `leaderboard_entries` and `public_player_profiles`: `security_invoker` views over opted-in rows.

Email addresses, access/refresh tokens, raw saves, complete inventories, and private account identifiers are not included in public profile payloads.

The game remains mostly client-side. RLS prevents one account from reading or modifying another account's private rows, but it cannot prove that submitted gameplay statistics are honest. Leaderboards are therefore labelled **client reported**, not cheat-proof or server-authoritative.

## 5. Verification checklist

With a configured test project:

1. Register two disposable test accounts with different display names.
2. Confirm duplicate case-insensitive names are rejected.
3. Sign in, reload, and confirm the session refreshes.
4. Sync a v29 inventory containing a seeded pattern item and reload it unchanged.
5. Change the same account on two browsers, then verify the stale device receives the conflict chooser.
6. Test both conflict choices and confirm a local backup exists before replacement.
7. Confirm signed-out requests cannot query `game_saves`.
8. Confirm account A cannot select/update account B's save, profile-private fields, stats, or trophy row.
9. Opt into a public profile and trophy showcase; confirm only selected trophy snapshots appear.
10. Opt out and confirm the public profile and leaderboard entry disappear.
11. Exercise password reset, logout, offline edits, reconnection, and network-error states.

This repository does not include real Supabase credentials. Automated tests cover the mock backend, revision protocol, save migration/identity, privacy calculations, and static SQL security contract. A deployed test project is still required for real Auth email delivery, token expiry, PostgREST/RPC behavior, and cross-device RLS verification.
