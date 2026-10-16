import { Box, Crown, Crosshair, Gem, PackageOpen, Shield, Sparkles, Trophy, UserRound, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createPublicPlayerSummary, type CloudProfile, type PublicPlayerSummary } from '../cloud/cloudSave'
import { AssetImage } from '../components/AssetImage'
import { PatternBadge } from '../components/PatternInfo'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { getWearLabel } from '../utils/itemLabels'

const avatarIcons = {
  case: Box,
  crown: Crown,
  crosshair: Crosshair,
  gloves: Shield,
  knife: Gem,
}

function guestProfile(now: number): CloudProfile {
  return {
    avatarKey: 'crosshair',
    createdAt: now,
    displayName: 'Local Guest',
    isProfilePublic: false,
    isTrophyShowcasePublic: false,
    updatedAt: now,
    userId: 'local-guest',
  }
}

export function PlayerProfileView() {
  const { userId } = useParams()
  const { cloud, state } = useGame()
  const getPublicProfile = cloud.getPublicProfile
  const isOwnProfile = !userId || userId === cloud.session?.user.id
  const ownProfile = useMemo(
    () => cloud.profile ?? guestProfile(state.lastSaved),
    [cloud.profile, state.lastSaved],
  )
  const ownSummary = useMemo(
    () => createPublicPlayerSummary(state, { ...ownProfile, isTrophyShowcasePublic: true }),
    [ownProfile, state],
  )
  const [remoteResult, setRemoteResult] = useState<{
    error?: string
    profile: PublicPlayerSummary | null
    userId: string
  }>()

  useEffect(() => {
    if (isOwnProfile || !userId) {
      return
    }

    let isCancelled = false

    void getPublicProfile(userId)
      .then((profile) => {
        if (!isCancelled) {
          setRemoteResult({ profile, userId })
        }
      })
      .catch((nextError) => {
        if (!isCancelled) {
          setRemoteResult({
            error: nextError instanceof Error ? nextError.message : 'Profile could not be loaded.',
            profile: null,
            userId,
          })
        }
      })

    return () => {
      isCancelled = true
    }
  }, [getPublicProfile, isOwnProfile, userId])

  const currentRemoteResult = remoteResult?.userId === userId ? remoteResult : undefined
  const remoteProfile = currentRemoteResult?.profile
  const error = currentRemoteResult?.error
  const profile = isOwnProfile ? ownSummary : remoteProfile

  if (!profile) {
    return (
      <section className="grid min-h-[30rem] w-full place-items-center border border-cs-border bg-cs-surface p-6 text-center">
        <div>
          <UserRound className="mx-auto text-cs-muted" size={42} />
          <h2 className="mt-4 text-2xl font-semibold text-cs-text">{remoteProfile === undefined && !error ? 'Loading profile…' : 'Profile unavailable'}</h2>
          <p className="mt-2 max-w-lg text-sm text-cs-muted">{error ?? 'This player is private, does not exist, or has not published a profile.'}</p>
          <Link className="mt-5 inline-flex min-h-11 items-center border border-rarity-special px-4 text-sm font-semibold text-rarity-special" to="/leaderboards">Back to Leaderboards</Link>
        </div>
      </section>
    )
  }

  const AvatarIcon = avatarIcons[profile.avatarKey as keyof typeof avatarIcons] ?? Crosshair

  return (
    <section className="w-full min-w-0 border border-cs-border bg-cs-surface p-4 sm:p-7">
      <header className="grid gap-5 border border-cs-border bg-cs-panel p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="grid h-20 w-20 place-items-center border border-rarity-special bg-rarity-special/10 text-rarity-special">
          <AvatarIcon size={38} strokeWidth={1.6} />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase text-rarity-special">{isOwnProfile ? 'Your profile' : 'Public player profile'}</p>
          <h1 className="mt-1 truncate text-3xl font-semibold text-cs-text sm:text-4xl">{profile.username}</h1>
          <p className="mt-2 text-sm text-cs-muted">Joined {new Date(profile.createdAt).toLocaleDateString()} · Updated {new Date(profile.updatedAt).toLocaleString()}</p>
        </div>
        {isOwnProfile ? (
          <Link className="inline-flex min-h-11 items-center justify-center border border-rarity-special px-4 text-sm font-semibold text-rarity-special" to="/settings">Profile & privacy settings</Link>
        ) : null}
      </header>

      {!cloud.session && isOwnProfile ? (
        <div className="mt-4 border border-rarity-industrial/60 bg-rarity-industrial/10 p-4 text-sm text-cs-muted">
          You are playing as a local guest. Your game remains fully playable, but this profile is visible only on this device until you create an account.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Gem} label="Inventory value" value={formatCurrency(profile.inventoryValue)} />
        <Stat icon={PackageOpen} label="Cases opened" value={profile.casesOpened.toLocaleString()} />
        <Stat icon={Crown} label="Prestige" value={profile.prestigeLevel.toLocaleString()} />
        <Stat icon={Sparkles} label="Rare patterns" value={profile.rarePatterns.toLocaleString()} />
        <Stat icon={Trophy} label="Achievements" value={profile.achievementCount.toLocaleString()} />
        <Stat icon={Gem} label="Best skin" value={formatCurrency(profile.mostValuableSkin)} />
        <Stat icon={Shield} label="Total profit" value={formatCurrency(profile.totalProfit)} />
      </div>

      <section className="mt-6 border border-cs-border bg-cs-bg p-3 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase text-rarity-special">Social trophy showcase</p>
            <h2 className="mt-1 text-2xl font-semibold text-cs-text">Displayed skins</h2>
          </div>
          <p className="text-xs text-cs-muted">Only selected trophies are shared; the complete inventory stays private.</p>
        </div>

        {profile.trophyItems.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {profile.trophyItems.map((item) => (
              <article className="min-w-0 border border-cs-border bg-cs-panel p-4" key={item.instanceId}>
                <div className="aspect-[16/9] overflow-hidden bg-cs-panelMuted/30">
                  <AssetImage alt={`${item.weapon} | ${item.finish}`} className="h-full w-full object-contain p-3" src={item.image} />
                </div>
                <h3 className="mt-3 truncate text-base font-semibold text-cs-text">{item.weapon} | {item.finish}</h3>
                <p className="mt-1 font-mono text-[10px] uppercase text-cs-muted">{item.rarity} · {getWearLabel(item.wear)} · Float {item.floatValue.toFixed(6)}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <PatternBadge compact item={item} />
                  <span className="font-mono text-sm font-semibold text-cs-green">{formatCurrency(item.marketValue)}</span>
                </div>
                <p className="mt-3 border-t border-cs-border pt-3 text-[11px] text-cs-muted">Catalog artwork represents the finish, not this exact seed.</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid min-h-56 place-items-center border border-dashed border-cs-border bg-cs-panel p-6 text-center">
            <div>
              <Trophy className="mx-auto text-cs-muted" size={36} />
              <p className="mt-3 font-semibold text-cs-text">No public trophies</p>
              <p className="mt-1 text-sm text-cs-muted">The showcase is empty, private, or contains items that are no longer owned.</p>
            </div>
          </div>
        )}
      </section>
    </section>
  )
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 border border-cs-border bg-cs-panel p-4">
      <div className="flex items-center gap-2 text-cs-muted"><Icon size={16} /><span className="font-mono text-[10px] uppercase">{label}</span></div>
      <p className="mt-2 truncate font-mono text-xl font-semibold text-cs-text">{value}</p>
    </div>
  )
}
