import { AlertTriangle, BookOpen, BriefcaseBusiness, ExternalLink, HelpCircle, PackageOpen, RotateCcw, Search, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useSessionStorageState } from '../hooks/useSessionStorageState'
import type { OnboardingTipId } from '../data/gameState'

interface HelpArticle {
  category: string
  title: string
  body: string
  example?: string
  path: string
  warning?: string
  guide?: OnboardingTipId
}

const HELP_ARTICLES: HelpArticle[] = [
  { category: 'Getting Started', title: 'Your first session', body: 'Pick an affordable case, confirm its case-and-key cost, watch the full opening, then inspect the exact item in Inventory. Work is the safe early-game way to rebuild cash.', example: 'Start with a low-cost unlocked case; one paid opening awards one item exactly once.', path: '/', guide: 'career' },
  { category: 'Cases & Odds', title: 'Real odds and negative expected value', body: 'Standard weapon cases use the published rarity distribution. Every opening is independent: there is no pity counter or guaranteed Gold. Case price and key cost are both shown before opening.', example: 'A long losing streak does not improve the next roll. Budget openings as entertainment, not guaranteed profit.', path: '/cases', warning: 'Ordinary case opening has negative expected value.' },
  { category: 'Inventory & Patterns', title: 'Float, wear and Pattern', body: 'Float determines wear inside the skin’s valid range. Pattern is the permanent paint seed (0–1000 where applicable). Only documented finish- and weapon-specific patterns receive premiums.', example: 'Pattern #661 can be important for a specific Case Hardened skin; it is not universally valuable.', path: '/inventory' },
  { category: 'Quests & Collection Hunts', title: 'Discovery and ownership goals', body: 'Quest stages use authoritative opening, inventory, Work, market and journal progress. Discovery remains recorded after selling; ownership and delivery goals require the actual item.', example: 'Track up to the supported limit and claim a completed stage from its quest card.', path: '/quests', guide: 'quests' },
  { category: 'NPCs & Rivals', title: 'Collectors, specialists and rivals', body: 'NPC quests request exact categories of discoveries or items. Delivery permanently consumes the selected eligible item and the confirmation names the reward.', example: 'Locked, favorited and trophy items are excluded from delivery choices.', path: '/quests?tab=characters' },
  { category: 'CSWEAR & Trading', title: 'Buying, selling, fees and escrow', body: 'Estimated value is not realized profit. Bought items require a claim; listed items move into seven-day escrow. A sale settles only when a buyer accepts, after the displayed fee.', example: 'Compare asking price, credible estimate, cost basis and expected proceeds before listing.', path: '/cswear', guide: 'cswear' },
  { category: 'Trade-Ups', title: 'Contracts, float and risk', body: 'Ordinary contracts consume 10 same-rarity eligible items. Eligible Covert contracts consume 5. Collection weighting and normalized input float determine the real output distribution, while input opportunity cost measures what you permanently give up.', example: 'Expected value is the probability-weighted average, not a promised result.', path: '/trade-ups', warning: 'Execution permanently consumes every selected input.', guide: 'trade_up' },
  { category: 'Work', title: 'Skill-based early cash', body: 'Each job has a persistent cooldown and a bounded payout. Precision and Memory reward performance, while accessible keyboard or click alternatives remain available.', example: 'A claimed job cannot be replayed for another reward until its cooldown expires.', path: '/work' },
  { category: 'Career & Upgrades', title: 'XP, specializations and prerequisites', body: 'Career XP comes from meaningful verified activity and uses anti-farming windows. The 95 upgrades have level, specialization activity and prerequisite requirements.', example: 'Unlocking an upgrade means it is available to consider; purchasing still costs the displayed cash.', path: '/career', guide: 'career' },
  { category: 'Business & Employees', title: 'Wages, budgets and controls', body: 'Employees automate bounded economic activity using allocated budgets. They pay wages, respect inventory and risk controls, and pause for exceptional or high-value decisions.', example: 'Market Scouts notify you about watchlist matches; they do not secretly buy the item.', path: '/business', guide: 'business' },
  { category: 'Prestige & Legacy Vault', title: 'Exactly what resets', body: 'Prestige resets run cash, non-vault inventory, run XP/upgrades, employees, budgets, licenses and current-run records. It preserves lifetime achievements, All Time Collection, Prestige perks, history and exact Vault items.', example: 'A verified recovery snapshot is created before the atomic reset.', path: '/prestige', warning: 'Review the reset list and Legacy Vault before confirming.', guide: 'prestige' },
  { category: 'Achievements & Stats', title: 'Claiming and honest accounting', body: 'Completed achievements with rewards stay claimable until claimed. Stats separate cash flow, realized profit, inventory value and net worth using the bounded economy ledger.', example: 'Claim All is exact-once and the navigation badge updates immediately.', path: '/progress' },
  { category: 'Saves & Recovery', title: 'Local saves, cloud conflicts and backups', body: 'Autosave is local-first. Cloud sync can use local mock behavior or configured Supabase. Conflicts require choosing a complete version; balances and inventories are never blindly added together.', example: 'Export a backup before destructive actions or moving devices.', path: '/settings', warning: 'Never overwrite the only copy of a valuable save.' },
]

const categories = Array.from(new Set(HELP_ARTICLES.map((article) => article.category)))

export function HelpCenter() {
  const { state, updateOnboardingState } = useGame()
  const [query, setQuery] = useSessionStorageState('help:query', '')
  const [category, setCategory] = useSessionStorageState('help:category', 'All')
  const articles = useMemo(() => HELP_ARTICLES.filter((article) => {
    const matchesCategory = category === 'All' || article.category === category
    const haystack = `${article.category} ${article.title} ${article.body} ${article.example ?? ''}`.toLowerCase()
    return matchesCategory && haystack.includes(query.trim().toLowerCase())
  }), [category, query])

  function replayBeginner() {
    updateOnboardingState({ activeStepId: 'welcome', completedStepIds: [], isDismissed: false, isPaused: false, isReviewing: true })
  }

  function replayGuide(guide: OnboardingTipId) {
    updateOnboardingState({ dismissedTipIds: state.ui.onboarding.dismissedTipIds.filter((id) => id !== guide), isDismissed: true, isPaused: false, isReviewing: false })
  }

  return <section className="w-full border border-cs-border bg-cs-surface p-3 sm:p-5" data-testid="help-center">
    <header className="flex flex-col gap-3 border-l-4 border-rarity-industrial pl-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="flex items-center gap-2 font-mono text-xs uppercase text-rarity-industrial"><HelpCircle size={15} /> Help Center</p><h1 className="mt-1 text-2xl font-semibold text-cs-text">Learn the current game</h1><p className="mt-1 max-w-3xl text-sm text-cs-muted">Search concise guides, jump to the real screen, or replay an interactive walkthrough.</p></div>
      <button className="inline-flex min-h-10 items-center justify-center gap-2 border border-rarity-special px-3 text-sm font-semibold text-rarity-special hover:bg-rarity-special/10" onClick={replayBeginner} type="button"><RotateCcw size={16} /> Replay beginner tutorial</button>
    </header>
    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <label className="relative"><span className="sr-only">Search Help Center</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cs-muted" size={17} /><input className="min-h-11 w-full border border-cs-border bg-cs-panel pl-10 pr-3 text-sm text-cs-text" onChange={(event) => setQuery(event.target.value)} placeholder="Search cases, trading, Prestige…" type="search" value={query} /></label>
      <select aria-label="Help category" className="min-h-11 border border-cs-border bg-cs-panel px-3 text-sm text-cs-text" onChange={(event) => setCategory(event.target.value)} value={category}><option>All</option>{categories.map((entry) => <option key={entry}>{entry}</option>)}</select>
    </div>
    <nav aria-label="Help categories" className="mt-3 flex gap-2 overflow-x-auto pb-1">{['All', ...categories].map((entry) => <button aria-pressed={category === entry} className={`shrink-0 border px-3 py-1.5 text-xs ${category === entry ? 'border-rarity-industrial bg-rarity-industrial/10 text-rarity-industrial' : 'border-cs-border text-cs-muted hover:text-cs-text'}`} key={entry} onClick={() => setCategory(entry)} type="button">{entry}</button>)}</nav>
    <div className="mt-4 grid gap-3 xl:grid-cols-2">{articles.map((article) => <article className="border border-cs-border bg-cs-panel p-4" key={`${article.category}:${article.title}`}>
      <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center border border-cs-border bg-cs-surface text-rarity-industrial">{article.warning ? <ShieldCheck size={17} /> : article.category.includes('Business') ? <BriefcaseBusiness size={17} /> : article.category.includes('Cases') ? <PackageOpen size={17} /> : <BookOpen size={17} />}</span><div><p className="font-mono text-[10px] uppercase text-rarity-industrial">{article.category}</p><h2 className="mt-1 font-semibold text-cs-text">{article.title}</h2></div></div>
      <p className="mt-3 text-sm leading-6 text-cs-muted">{article.body}</p>
      {article.example ? <p className="mt-3 border-l-2 border-cs-border pl-3 text-xs leading-5 text-cs-text"><strong>Example:</strong> {article.example}</p> : null}
      {article.warning ? <p className="mt-3 flex items-start gap-2 border border-rarity-covert/50 bg-rarity-covert/5 p-2 text-xs text-rarity-covert"><AlertTriangle className="mt-0.5 shrink-0" size={14} /> {article.warning}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2"><Link className="inline-flex min-h-9 items-center gap-2 border border-cs-border px-3 text-xs font-semibold text-cs-text hover:border-rarity-industrial" to={article.path}>Open screen <ExternalLink size={13} /></Link>{article.guide ? <button className="min-h-9 border border-cs-border px-3 text-xs text-cs-muted hover:text-cs-text" onClick={() => replayGuide(article.guide!)} type="button">Replay feature guide</button> : null}</div>
    </article>)}</div>
    {articles.length === 0 ? <div className="mt-4 border border-cs-border bg-cs-panel p-8 text-center text-sm text-cs-muted">No help articles match that search.</div> : null}
  </section>
}
