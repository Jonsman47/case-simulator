import { BarChart3, Medal } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Achievements } from './Achievements'
import { StatsView } from './StatsView'

type ProgressTab = 'achievements' | 'stats'

export function AchievementsStats() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: ProgressTab = searchParams.get('tab') === 'stats' ? 'stats' : 'achievements'

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex flex-wrap gap-2 border border-cs-border bg-cs-panel p-2" aria-label="Achievements and statistics sections">
        <button
          aria-pressed={tab === 'achievements'}
          className={[
            'inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-semibold',
            tab === 'achievements'
              ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
              : 'border-cs-border bg-cs-surface text-cs-muted hover:text-cs-text',
          ].join(' ')}
          onClick={() => setSearchParams({ tab: 'achievements' })}
          type="button"
        >
          <Medal size={16} />
          Achievements
        </button>
        <button
          aria-pressed={tab === 'stats'}
          className={[
            'inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-semibold',
            tab === 'stats'
              ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
              : 'border-cs-border bg-cs-surface text-cs-muted hover:text-cs-text',
          ].join(' ')}
          onClick={() => setSearchParams({ tab: 'stats' })}
          type="button"
        >
          <BarChart3 size={16} />
          Statistics & Career History
        </button>
      </div>
      {tab === 'achievements' ? <Achievements /> : <StatsView />}
    </div>
  )
}
