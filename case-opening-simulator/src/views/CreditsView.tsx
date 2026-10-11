export function CreditsView() {
  return (
    <section className="grid gap-5 border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="border-l-4 border-rarity-covert pl-4">
        <p className="font-mono text-xs uppercase text-rarity-covert">Credits</p>
        <h2 className="mt-1 text-3xl font-semibold text-cs-text">Made by Jonsman</h2>
      </div>

      <div className="grid gap-3 text-sm leading-6 text-cs-muted">
        <p>
          This is a fictional CS2-style case opening simulator built for fan/game purposes.
        </p>
        <p>
          All balance, inventory values, openings, trades, mini-games, and rewards use fake money only.
        </p>
        <p>
          This project is not affiliated with Valve, Steam, Counter-Strike, or any official CS2 marketplace.
        </p>
        <p>
          Skin, case, and related visual data are used as fan references inside a simulator experience.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border border-cs-border bg-cs-panel p-3">
          <p className="font-mono text-[10px] uppercase text-cs-muted">Creator</p>
          <p className="mt-1 text-sm font-semibold text-cs-text">Jonsman</p>
        </div>
        <div className="border border-cs-border bg-cs-panel p-3">
          <p className="font-mono text-[10px] uppercase text-cs-muted">Purpose</p>
          <p className="mt-1 text-sm font-semibold text-cs-text">Fan simulator</p>
        </div>
        <div className="border border-cs-border bg-cs-panel p-3">
          <p className="font-mono text-[10px] uppercase text-cs-muted">Currency</p>
          <p className="mt-1 text-sm font-semibold text-cs-text">Fake money</p>
        </div>
      </div>
    </section>
  )
}
