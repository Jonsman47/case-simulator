import type { ReactNode } from 'react'
import { rarityDefinitions } from '../data/rarities'
import type { RarityKey } from '../data/gameState'

const borderByRarity: Record<RarityKey, string> = {
  consumer: 'border-rarity-consumer',
  industrial: 'border-rarity-industrial',
  milSpec: 'border-rarity-mil-spec',
  restricted: 'border-rarity-restricted',
  classified: 'border-rarity-classified',
  covert: 'border-rarity-covert',
  special: 'border-rarity-special',
  contraband: 'border-rarity-contraband',
}

export function PlaceholderView({
  accent = 'special',
  children,
  title,
}: {
  accent?: RarityKey
  children?: ReactNode
  title: string
}) {
  return (
    <section className="w-full border border-cs-border bg-cs-surface p-3 sm:p-5">
      <div className={`border-l-4 ${borderByRarity[accent]} pl-4`}>
        <h2 className="text-2xl font-semibold text-cs-text sm:text-3xl">{title}</h2>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="min-h-60 border border-cs-border bg-cs-panel p-3">
          {children ?? (
            <div aria-hidden="true" className="grid h-full min-h-60 grid-cols-3 gap-3">
              <div className="col-span-2 bg-cs-panelMuted" />
              <div className="bg-cs-panelMuted" />
              <div className="bg-cs-panelMuted" />
              <div className="col-span-2 bg-cs-panelMuted" />
            </div>
          )}
        </div>
        <div className="border border-cs-border bg-cs-panel p-3">
          <div aria-hidden="true" className="space-y-3">
            {rarityDefinitions.map((rarity) => (
              <div key={rarity.key} className={`h-3 border-l-4 ${rarity.borderClass} bg-cs-panelMuted`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
