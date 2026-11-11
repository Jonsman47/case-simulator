import { AcquisitionReveal } from '../components/AcquisitionReveal'
import { NpcMarketplace } from '../components/NpcMarketplace'
import { useGame } from '../hooks/useGame'

export function CSWear() {
  const { claimAcquisition, state } = useGame()

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-3 sm:p-5">
      <NpcMarketplace />
      {state.marketplace.pendingAcquisition && state.marketplace.pendingAcquisition.source !== 'trade-up'
        ? <AcquisitionReveal acquisition={state.marketplace.pendingAcquisition} onClaim={claimAcquisition} />
        : null}
    </section>
  )
}
