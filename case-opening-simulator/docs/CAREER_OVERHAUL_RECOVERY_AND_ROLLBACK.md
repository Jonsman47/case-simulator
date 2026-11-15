# Career Overhaul Recovery and Rollback

## User save backups

Open Settings → Save Management and choose **Download Save** or **Download Backup**. Keep the JSON outside browser storage. Before every Prestige, the app also writes and reads back a current v39 snapshot under the dedicated local Prestige recovery key. The reset is not dispatched until that parsed snapshot matches the exact current run and critical state.

## Restore a normal export

Use Settings → Load Save File. The importer parses and migrates the entire file before offering replacement. It never merges inventory or balances. Invalid JSON, future schemas, invalid item identity/numbers, duplicate owned IDs, unsafe sizes, and corrupt escrow are rejected; the source file remains unchanged.

## Restore a pre-Prestige snapshot

Settings → Save Management → Prestige Recovery shows the available verified snapshot. Choose **Restore Snapshot**, review its timestamp and confirm **Replace With Recovery Save**. This discards progress after the snapshot and restores the old run exactly. It does not combine the old run with the post-Prestige run.

Never merge those lineages manually: each may contain the same items, achievement claims, PP awards, ledger transactions and employee capital. Combining them can duplicate value and invalidate exact-once guarantees. A signed/server-authoritative merge is not available in the local PWA.

## Corrupted local storage

1. Do not reset immediately; first copy the raw `case-opening-simulator:game-state` value from browser developer tools if possible.
2. Preserve that byte-for-byte copy for diagnosis.
3. Import the most recent downloaded backup or use the verified Prestige recovery snapshot.
4. If neither parses, start a new local run only after preserving the corrupted bytes. Do not delete individual inventory entries to force a load.

The game fails closed rather than silently deleting duplicate or invalid valuable items. Recovery may therefore require a developer to inspect the preserved source against the documented schema.

## Cloud conflicts

Cloud writes use an expected revision. If another device saved first, sync stops and Settings shows both local and remote summaries. Choose one complete version:

- **Keep local version** backs up the remote and replaces it through a fresh revision check.
- **Use cloud version** backs up local and replaces local state.

No automatic money, inventory, XP, PP, Vault or run-history merge occurs. A pre-Prestige offline device reconnecting to a post-Prestige cloud save therefore produces an explicit conflict instead of joining incompatible runs.

## Newer saves and older clients

An older client must not open or overwrite a newer schema. The parser rejects a save whose version exceeds its supported version. Upgrade the client before loading. Never edit the version number downward: newer fields and exact-once lineage may be lost even if the JSON then appears readable.

## Deployment rollback

Code rollback is safe only when the older deployment can read the newest save schema written in production. For v39 saves:

1. Prefer a forward fix on the v39-capable release.
2. If code must roll back, retain the v39 parser/migrations and cloud revision contract in the rollback build.
3. Do not deploy an older client that writes v38 or lower over v39 cloud rows.
4. Back up the database and static deployment before schema/RPC changes.
5. Roll back application assets independently from database migrations when possible.
6. If a Supabase migration fails, stop writes, restore the database backup or apply a forward corrective migration, then verify RLS and `save_game_if_revision` before re-enabling sync.

The repository does not claim a database downgrade path. PostgreSQL/Supabase migrations should be corrected forward unless a tested full database restore is available.

## Verification checklist

- Export parses on the current release.
- Item instance IDs, float, Pattern, edition and cost basis match.
- Money, XP, PP, employee reserved capital and escrow match.
- Save reloads twice without new rewards or migration credit.
- Cloud revision increments once and no conflict remains.
- After Prestige recovery, the restored run ID is the snapshot run ID and the post-Prestige archive/award is absent.
