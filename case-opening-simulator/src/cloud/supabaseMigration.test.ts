import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20261016_social_cloud_v29.sql?raw'

describe('Supabase social/cloud migration', () => {
  it('keeps private saves owner-only and removes anonymous table access', () => {
    expect(migration).toMatch(/game_saves_select_self[\s\S]*auth\.uid\(\)[\s\S]*user_id/i)
    expect(migration).toMatch(/revoke all on public\.game_saves from anon/i)
    expect(migration).not.toMatch(/grant select on public\.game_saves to anon/i)
  })

  it('uses an atomic expected-revision RPC without accepting a client user id', () => {
    const functionBlock = migration.match(/create or replace function public\.save_game_if_revision[\s\S]*?\$\$;/i)?.[0] ?? ''

    expect(functionBlock).toContain('p_expected_revision')
    expect(functionBlock).toContain('revision_conflict')
    expect(functionBlock).toContain('auth.uid()')
    expect(functionBlock).not.toContain('p_user_id')
  })

  it('exposes only opted-in summaries through security-invoker views', () => {
    expect(migration).toMatch(/create view public\.leaderboard_entries\s+with \(security_invoker = true\)/i)
    expect(migration).toMatch(/where profiles\.public_profile = true/i)
    expect(migration).not.toMatch(/create view public\.leaderboard_entries[\s\S]*save_data/i)
  })

  it('enforces normalized public names and owner-only social writes', () => {
    expect(migration).toMatch(/unique index if not exists profiles_display_name_unique[\s\S]*lower\(display_name\)/i)
    expect(migration).toMatch(/public_stats_update_self[\s\S]*auth\.uid\(\)[\s\S]*user_id/i)
    expect(migration).toMatch(/public_trophy_update_self[\s\S]*auth\.uid\(\)[\s\S]*user_id/i)
  })
})
