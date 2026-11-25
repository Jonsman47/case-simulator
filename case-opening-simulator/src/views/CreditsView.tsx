import { ExternalLink, Gamepad2, Heart, Image, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AssetImage } from '../components/AssetImage'
import { useGame } from '../hooks/useGame'

const sourceBase = 'https://github.com/Jonsman47/case-simulator/blob/main/case-opening-simulator'

export function CreditsView() {
  const { availableCases } = useGame()
  return <section className="min-w-0 space-y-4" aria-label="About and credits">
    <header className="relative grid min-w-0 gap-4 overflow-hidden border border-rarity-special/60 bg-cs-surface p-5 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center sm:p-7">
      <div><p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-rarity-special"><Gamepad2 size={16} /> About the game</p><h1 className="mt-2 text-3xl font-bold text-cs-text sm:text-4xl">Case Opening Simulator</h1><p className="mt-2 text-lg font-semibold text-rarity-special">Created by Jonsman</p><p className="mt-3 max-w-xl text-sm leading-6 text-cs-muted">A fictional CS2-inspired game about opening cases, collecting skins, trading and building a Career. Every balance and item here is simulated.</p><Link className="mt-4 inline-flex min-h-10 items-center border border-rarity-special px-3 text-sm font-semibold text-rarity-special" to="/">Return to the game</Link></div>
      {availableCases[0]?.image ? <div className="grid min-h-40 place-items-center border border-cs-border bg-cs-panel"><AssetImage alt="Example game case" className="h-36 w-36 object-contain" src={availableCases[0].image} /></div> : null}
    </header>
    <div className="grid gap-3 md:grid-cols-2">
      <section className="min-w-0 border border-cs-border bg-cs-surface p-4"><h2 className="flex items-center gap-2 font-semibold text-cs-text"><Heart size={18} className="text-rarity-special" /> Development</h2><p className="mt-2 text-sm leading-6 text-cs-muted">Design and development by <strong className="text-cs-text">Jonsman</strong>. The game is an unofficial fan project.</p></section>
      <section className="min-w-0 border border-cs-border bg-cs-surface p-4"><h2 className="flex items-center gap-2 font-semibold text-cs-text"><ShieldCheck size={18} className="text-cs-green" /> Simulated play</h2><p className="mt-2 text-sm leading-6 text-cs-muted">Openings, marketplace offers, balances, rewards and trades exist only in this simulator. There are no real-money payouts or transferable CS2 items.</p></section>
    </div>
    <section className="min-w-0 border border-cs-border bg-cs-surface p-4"><h2 className="flex items-center gap-2 font-semibold text-cs-text"><Image size={18} className="text-rarity-industrial" /> Assets and attribution</h2><p className="mt-2 text-sm leading-6 text-cs-muted">Case and skin images come from the documented CS2 catalog sources and are stored locally for the game. Work and Business visuals have recorded source and license details. Pattern data uses the credited source listed in its provenance notes.</p><div className="mt-3 flex flex-wrap gap-2"><a className="inline-flex min-h-10 items-center gap-1 border border-cs-border px-3 text-xs text-rarity-industrial" href={`${sourceBase}/docs/ASSET_SOURCES.md`} rel="noreferrer" target="_blank">Visual asset licenses <ExternalLink size={13} /></a><a className="inline-flex min-h-10 items-center gap-1 border border-cs-border px-3 text-xs text-rarity-industrial" href={`${sourceBase}/README.md`} rel="noreferrer" target="_blank">CS2 catalog sources <ExternalLink size={13} /></a><a className="inline-flex min-h-10 items-center gap-1 border border-cs-border px-3 text-xs text-rarity-industrial" href={`${sourceBase}/docs/pattern-reference-sources.md`} rel="noreferrer" target="_blank">Pattern data credits <ExternalLink size={13} /></a></div></section>
    <p className="border-l-2 border-cs-border pl-3 text-xs leading-5 text-cs-muted">Case Opening Simulator is unofficial and is not affiliated with or endorsed by Valve, Steam or Counter-Strike. Their names and game assets remain the property of their respective owners.</p>
  </section>
}
