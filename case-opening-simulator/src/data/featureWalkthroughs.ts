export interface WalkthroughStep {
  title: string
  body: string
  target: string
  recovery?: string
}

export interface FeatureWalkthrough {
  id: string
  label: string
  path: string
  steps: readonly WalkthroughStep[]
}

export const FEATURE_WALKTHROUGHS: readonly FeatureWalkthrough[] = [
  { id: 'cases', label: 'Case Opening', path: '/cases', steps: [
    { title: 'Choose a case', body: 'Select a case here. Each has its own price and possible skins.', target: '[data-onboarding-target="starter-case"]' },
    { title: 'Check the payment', body: 'The opening quote shows the total, any Case Opening Funds used, and the cash you pay.', target: '[aria-label="Opening payment breakdown"]', recovery: 'Choose a case to reveal its exact opening quote.' },
    { title: 'Open when ready', body: 'The Open button commits one real purchase. You can leave this guide without opening anything.', target: '[data-guide-target="open-one-button"]', recovery: 'Choose a case first; the guide never buys one for you.' },
    { title: 'Read the result', body: 'The reveal shows the actual skin. Its rarity and estimated value help you decide what to keep.', target: '[data-onboarding-target="opening-result"]', recovery: 'A result appears after an opening. You can revisit this lesson later.' },
  ] },
  { id: 'inventory', label: 'Inventory', path: '/inventory', steps: [
    { title: 'Find your skins', body: 'These are the exact items you own. Select one to inspect it.', target: '[data-onboarding-target="inventory-grid"]' },
    { title: 'Filter the list', body: 'Search and filters help when your collection grows.', target: '[data-onboarding-target="inventory-filters"]' },
    { title: 'Wear and Float', body: 'Wear names summarize condition. Float is the more precise wear number.', target: '[data-onboarding-target="inspection-wear"]', recovery: 'Select a skin to see its condition.' },
    { title: 'Pattern', body: 'A Paint Seed changes a finish. Only some finishes have valuable Patterns.', target: '[data-onboarding-target="inspection-pattern"]', recovery: 'Select a skin to inspect its Pattern.' },
    { title: 'Sell or protect', body: 'Selling is permanent. The confirmation shows exact proceeds; lock or favorite a skin you want to keep.', target: '[data-onboarding-target="item-details"]', recovery: 'Select a skin to review its available actions. This guide never sells it.' },
  ] },
  { id: 'work', label: 'Work', path: '/work', steps: [
    { title: 'Choose a job', body: 'Each job explains its controls before you start.', target: '[data-guide-target="work-job-card"]' },
    { title: 'Check pay and cooldown', body: 'The card shows the possible reward and when this job can pay again.', target: '[data-guide-target="work-reward"]' },
    { title: 'Play at your pace', body: 'Open a job when ready. The guide will not start a round or claim a reward.', target: '[data-guide-target="work-play"]' },
  ] },
  { id: 'trade-ups', label: 'Trade-Ups', path: '/trade-ups', steps: [
    { title: 'Choose compatible skins', body: 'Start with one eligible skin. The picker then shows only inputs compatible with that contract.', target: '[data-testid="trade-up-picker-panel"]' },
    { title: 'Rarity and edition', body: 'Inputs must satisfy the same contract rarity and edition rules. Filters help you browse without changing eligibility.', target: '[data-testid="trade-up-picker-panel"]' },
    { title: 'Fill the contract', body: 'Use ten compatible skins, or five for an eligible Covert contract. Quick-fill uses one valid pool.', target: '[data-testid="trade-up-contract-panel"]' },
    { title: 'Review possible results', body: 'Possible outputs, expected value and ROI are estimates across many contracts, not a promise.', target: '[data-testid="trade-up-workbench"]' },
    { title: 'Review before execution', body: 'Every input is permanently consumed when you execute. This guide never signs a contract.', target: '[data-testid="trade-up-contract-panel"]' },
  ] },
  { id: 'cswear', label: 'CSWEAR', path: '/cswear', steps: [
    { title: 'Search the market', body: 'Search and filter simulated skin markets to narrow the offers.', target: '[placeholder="Search all skins"]', recovery: 'The market catalog must be open to show its search control.' },
    { title: 'Compare prices', body: 'A market card shows an estimated starting price and offer count. Check an exact listing before buying.', target: '[data-guide-target="cswear-catalog"]', recovery: 'Return to the market catalog to compare offers.' },
    { title: 'Buying and negotiating', body: 'A listing shows its asking price, Float and Pattern. Negotiation can change the price, but never buys automatically.', target: '[data-guide-target="cswear-market"]', recovery: 'Open a skin market to review its listings.' },
    { title: 'Your listings', body: 'Your own listed skins are held in escrow until a sale or cancellation. Check fees before listing.', target: '[data-guide-target="cswear-tabs"]', recovery: 'Use the CSWEAR tabs to find your listings.' },
  ] },
  { id: 'career', label: 'Career & Upgrades', path: '/career', steps: [
    { title: 'Level and XP', body: 'Real gameplay adds Career XP. Your level and rank show your progress.', target: '[data-guide-target="career-progress"]' },
    { title: 'Specialization paths', body: 'Choose a path to see the upgrades that support that playstyle.', target: '[aria-labelledby="specializations-title"]' },
    { title: 'Upgrade explorer', body: 'Filter upgrades and inspect their costs and prerequisites before purchasing.', target: '[aria-labelledby="upgrade-explorer-title"]' },
    { title: 'Purchase when ready', body: 'An unlocked upgrade still has a cash cost. The guide never buys it.', target: '[aria-labelledby="upgrade-explorer-title"]' },
  ] },
  { id: 'business', label: 'Business', path: '/business', steps: [
    { title: 'Hire an employee', body: 'Employee roles unlock at Career levels. Review the role and hiring cost first.', target: '[data-guide-target="business-employees"]' },
    { title: 'Operating funds and wages', body: 'Employees need a budget and earn wages while active. Keep enough cash to run them.', target: '[data-guide-target="business-budget"]', recovery: 'Select an employee to see its operating controls.' },
    { title: 'Start and pause', body: 'You control when an employee works. Review its settings before starting.', target: '[data-guide-target="business-controls"]', recovery: 'Select or hire an employee to see its controls.' },
    { title: 'Research and alerts', body: 'Research and alerts help you watch market activity without making a purchase.', target: '[data-guide-target="business-research"]', recovery: 'Open the Research & alerts section.' },
  ] },
  { id: 'prestige', label: 'Prestige', path: '/prestige', steps: [
    { title: 'Check eligibility', body: 'Prestige requires a qualified Career run. The score and path goals show what is still needed.', target: '[data-guide-target="prestige-eligibility"]' },
    { title: 'Prestige Points', body: 'A completed reset awards Points that can buy permanent perks.', target: '[data-guide-target="prestige-points"]' },
    { title: 'Permanent perks', body: 'Perks persist into later runs. Read their cost before buying.', target: '[data-guide-target="prestige-perks"]' },
    { title: 'Legacy Vault and reset', body: 'The final review explains what resets and what survives, including protected Vault items. This guide never starts a reset.', target: '[data-guide-target="prestige-eligibility"]' },
  ] },
]

export function getWalkthrough(path: string): FeatureWalkthrough | undefined {
  return FEATURE_WALKTHROUGHS.find((guide) => guide.path === path)
}
