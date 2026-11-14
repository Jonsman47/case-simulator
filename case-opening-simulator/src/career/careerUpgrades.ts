import { getCareerSnapshot, type CareerSpecializationId, type CareerState } from './careerProgress'

export type UpgradeSpecialization = Exclude<CareerSpecializationId, 'work'>
export type CareerUpgradeLevels = Record<string, number>
export type CareerUpgradeEffectKind = 'unlock' | 'capacity' | 'speed' | 'discount' | 'precision'

export interface CareerUpgradeDefinition {
  id: string
  specialization: UpgradeSpecialization
  group: string
  name: string
  description: string
  consumer: string
  effectKey: string
  effectKind: CareerUpgradeEffectKind
  effectPerLevel: number
  effectUnit: string
  baseCash: number
  rankMultiplier: number
  requiredLevel: number
  requiredSpecializationXp: number
  prerequisites: string[]
  maxLevel: number
  resetsOnPrestige: true
}

export interface CareerUpgradeMigration {
  applied: boolean
  appliedAt: number
  legacySkillPoints: number
  legacyUpgradePoints: number
  legacyLearnedSkills: number
  legacyUpgradeLevels: number
  initialTransitionCredit: number
  transitionCredit: number
  note: string
}

export interface CareerUpgradeState {
  schemaVersion: 1
  levels: CareerUpgradeLevels
  purchasedAt: Record<string, number>
  migration: CareerUpgradeMigration
}

type NodeSpec = Omit<CareerUpgradeDefinition, 'specialization' | 'resetsOnPrestige' | 'prerequisites' | 'requiredSpecializationXp'> & {
  prerequisites?: string[]
  requiredSpecializationXp?: number
}

function defineBranch(specialization: UpgradeSpecialization, specs: NodeSpec[]): CareerUpgradeDefinition[] {
  return specs.map((spec) => ({
    ...spec,
    specialization,
    prerequisites: spec.prerequisites ?? [],
    requiredSpecializationXp: spec.requiredSpecializationXp ?? (
      spec.requiredLevel >= 75 ? 25_000
        : spec.requiredLevel >= 55 ? 12_500
          : spec.requiredLevel >= 35 ? 5_000
            : spec.requiredLevel >= 15 ? 1_000
              : 0
    ),
    resetsOnPrestige: true,
  }))
}

const CASE_OPENING_UPGRADES = defineBranch('caseOpening', [
  { id: 'case-opening.presentation-drive', group: 'Opening workflow', name: 'Presentation Drive', description: 'Shortens roulette and reveal presentation without changing the predetermined result.', consumer: 'Case-opening animation duration', effectKey: 'opening.animationSpeed', effectKind: 'speed', effectPerLevel: 0.1, effectUnit: ' faster presentation', baseCash: 300, rankMultiplier: 1, requiredLevel: 1, maxLevel: 3 },
  { id: 'case-opening.batch-controls', group: 'Opening workflow', name: 'Batch Controls', description: 'Raises the manual multi-open ceiling in measured steps.', consumer: 'Manual opening quantity selector', effectKey: 'opening.batchCapacity', effectKind: 'capacity', effectPerLevel: 5, effectUnit: ' cases per batch', baseCash: 650, rankMultiplier: 1, requiredLevel: 3, maxLevel: 4, prerequisites: ['case-opening.presentation-drive'] },
  { id: 'case-opening.repeat-presets', group: 'Opening workflow', name: 'Repeat Presets', description: 'Unlocks reusable quantity and stop-budget presets on the Career research panel.', consumer: 'Opening workflow preset library', effectKey: 'opening.repeatPresets', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' repeat presets', baseCash: 900, rankMultiplier: 1, requiredLevel: 5, maxLevel: 3 },
  { id: 'case-opening.favorite-presets', group: 'Opening workflow', name: 'Case Favorite Sets', description: 'Adds organized favorite-case sets for collection-focused opening plans.', consumer: 'Case research favorite-set capacity', effectKey: 'opening.favoriteSets', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' favorite sets', baseCash: 1_100, rankMultiplier: 1, requiredLevel: 7, maxLevel: 3 },
  { id: 'case-opening.queue-planner', group: 'Opening workflow', name: 'Queue Planner', description: 'Adds non-automatic queue planning slots with explicit projected cost.', consumer: 'Opening research queue planner', effectKey: 'opening.queueSlots', effectKind: 'capacity', effectPerLevel: 2, effectUnit: ' queue slots', baseCash: 1_500, rankMultiplier: 1.1, requiredLevel: 10, maxLevel: 3 },
  { id: 'case-opening.ev-basics', group: 'Case research', name: 'Case EV Basics', description: 'Unlocks expected-value and expected-loss summaries from known drop tables.', consumer: 'Career case research report', effectKey: 'opening.evBasics', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' research tool', baseCash: 1_300, rankMultiplier: 1.1, requiredLevel: 8, maxLevel: 1 },
  { id: 'case-opening.probability-table', group: 'Case research', name: 'Probability Table', description: 'Unlocks normalized rarity and item probability detail; it never predicts a future drop.', consumer: 'Career case research report', effectKey: 'opening.probabilityTable', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' probability report', baseCash: 2_000, rankMultiplier: 1.15, requiredLevel: 12, maxLevel: 1, prerequisites: ['case-opening.ev-basics'] },
  { id: 'case-opening.cost-planner', group: 'Case research', name: 'Cost Planner', description: 'Adds session budget projections for planned opening quantities.', consumer: 'Career case research report', effectKey: 'opening.costPlanner', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' planning tier', baseCash: 2_600, rankMultiplier: 1.2, requiredLevel: 15, maxLevel: 2, prerequisites: ['case-opening.ev-basics'] },
  { id: 'case-opening.loss-bands', group: 'Case research', name: 'Loss Bands', description: 'Shows conservative loss ranges around case EV rather than a misleading single outcome.', consumer: 'Career case research report', effectKey: 'opening.lossBands', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' risk report', baseCash: 4_000, rankMultiplier: 1.25, requiredLevel: 20, maxLevel: 1, prerequisites: ['case-opening.probability-table'] },
  { id: 'case-opening.price-history', group: 'Case research', name: 'Case Price History', description: 'Unlocks recorded case-cost trend context for budgeting decisions.', consumer: 'Career case research report', effectKey: 'opening.priceHistory', effectKind: 'precision', effectPerLevel: 7, effectUnit: ' days of context', baseCash: 5_500, rankMultiplier: 1.3, requiredLevel: 25, maxLevel: 3, prerequisites: ['case-opening.cost-planner'] },
  { id: 'case-opening.drop-journal', group: 'Collection opening', name: 'Drop Journal', description: 'Adds detailed per-case discovery tracking to opening research.', consumer: 'Career case research report', effectKey: 'opening.dropJournal', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' drop journal', baseCash: 2_200, rankMultiplier: 1.15, requiredLevel: 15, maxLevel: 1 },
  { id: 'case-opening.missing-highlights', group: 'Collection opening', name: 'Missing-Skin Highlights', description: 'Marks collection gaps in case research without affecting results.', consumer: 'Career case research report', effectKey: 'opening.missingHighlights', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' gap overlay', baseCash: 4_500, rankMultiplier: 1.25, requiredLevel: 22, maxLevel: 1, prerequisites: ['case-opening.drop-journal'] },
  { id: 'case-opening.duplicate-forecast', group: 'Collection opening', name: 'Duplicate Forecast', description: 'Estimates duplicate exposure for a planned case session from owned discoveries.', consumer: 'Career case research report', effectKey: 'opening.duplicateForecast', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' forecast tier', baseCash: 8_000, rankMultiplier: 1.4, requiredLevel: 35, maxLevel: 2, prerequisites: ['case-opening.missing-highlights'] },
  { id: 'case-opening.operator-batching', group: 'Case Operator', name: 'Operator Batching', description: 'Raises the Case Operator batch limit while preserving wallet and capacity checks.', consumer: 'Case Operator scheduler', effectKey: 'business.caseOperatorBatch', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' automated case per batch', baseCash: 7_500, rankMultiplier: 1.35, requiredLevel: 35, maxLevel: 3, prerequisites: ['case-opening.batch-controls'] },
  { id: 'case-opening.operator-budget-profiles', group: 'Case Operator', name: 'Operator Budget Profiles', description: 'Adds explicit operating-budget profile slots for the Case Operator.', consumer: 'Business employee policy summary', effectKey: 'business.caseBudgetProfiles', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' budget profiles', baseCash: 9_500, rankMultiplier: 1.45, requiredLevel: 40, maxLevel: 3 },
  { id: 'case-opening.stop-loss-controls', group: 'Case Operator', name: 'Stop-Loss Controls', description: 'Improves the number and clarity of visible Case Operator safety thresholds.', consumer: 'Business employee policy summary', effectKey: 'business.caseStopControls', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' safety controls', baseCash: 12_000, rankMultiplier: 1.5, requiredLevel: 45, maxLevel: 2 },
  { id: 'case-opening.capacity-brake', group: 'Case Operator', name: 'Capacity Brake', description: 'Increases the inventory reserve the operator can actively monitor before pausing.', consumer: 'Case Operator scheduler', effectKey: 'business.caseCapacityReserve', effectKind: 'capacity', effectPerLevel: 2, effectUnit: ' monitored reserve slots', baseCash: 15_000, rankMultiplier: 1.55, requiredLevel: 50, maxLevel: 3, prerequisites: ['case-opening.stop-loss-controls'] },
  { id: 'case-opening.session-audit', group: 'Case research', name: 'Session Audit', description: 'Unlocks a complete spend, return, discovery and duplicate session summary.', consumer: 'Career case research report', effectKey: 'opening.sessionAudit', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' audit report', baseCash: 40_000, rankMultiplier: 2, requiredLevel: 75, maxLevel: 1, prerequisites: ['case-opening.loss-bands', 'case-opening.duplicate-forecast'] },
])

const TRADING_UPGRADES = defineBranch('trading', [
  { id: 'trading.price-confidence', group: 'Market research', name: 'Price Confidence', description: 'Reveals whether a valuation is market-grounded, listing-based, or estimated.', consumer: 'Trading research report', effectKey: 'trading.priceConfidence', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' confidence view', baseCash: 500, rankMultiplier: 1, requiredLevel: 1, maxLevel: 1 },
  { id: 'trading.spread-view', group: 'Market research', name: 'Spread View', description: 'Shows the gap between instant liquidity and estimated market value.', consumer: 'Trading research report', effectKey: 'trading.spreadView', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' spread view', baseCash: 850, rankMultiplier: 1, requiredLevel: 4, maxLevel: 1 },
  { id: 'trading.liquidity-analysis', group: 'Market research', name: 'Liquidity Analysis', description: 'Adds supply-aware liquidity tiers to price research.', consumer: 'Trading research report', effectKey: 'trading.liquidityAnalysis', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' liquidity tier', baseCash: 1_500, rankMultiplier: 1.1, requiredLevel: 8, maxLevel: 3 },
  { id: 'trading.trend-context', group: 'Market research', name: 'Trend Context', description: 'Extends the visible historical context used for decisions, not future prediction.', consumer: 'Trading research report', effectKey: 'trading.trendDays', effectKind: 'precision', effectPerLevel: 7, effectUnit: ' days of trend context', baseCash: 2_000, rankMultiplier: 1.15, requiredLevel: 12, maxLevel: 4 },
  { id: 'trading.pattern-research', group: 'Market research', name: 'Pattern Research', description: 'Unlocks finish-specific Pattern evidence and confidence detail.', consumer: 'Trading research report', effectKey: 'trading.patternResearch', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' Pattern research tier', baseCash: 4_000, rankMultiplier: 1.25, requiredLevel: 18, maxLevel: 3 },
  { id: 'trading.float-comparison', group: 'Market research', name: 'Float Comparison', description: 'Adds float-aware comparisons within valid wear ranges.', consumer: 'Trading research report', effectKey: 'trading.floatComparison', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' float comparison tier', baseCash: 3_000, rankMultiplier: 1.2, requiredLevel: 15, maxLevel: 2 },
  { id: 'trading.saved-searches', group: 'CSWEAR tools', name: 'Saved Searches', description: 'Adds reusable CSWEAR research search slots.', consumer: 'Trading research tool capacity', effectKey: 'trading.savedSearches', effectKind: 'capacity', effectPerLevel: 2, effectUnit: ' saved searches', baseCash: 1_800, rankMultiplier: 1.1, requiredLevel: 10, maxLevel: 4 },
  { id: 'trading.filter-presets', group: 'CSWEAR tools', name: 'Filter Presets', description: 'Adds named filter combinations for repeated market research.', consumer: 'Trading research tool capacity', effectKey: 'trading.filterPresets', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' filter presets', baseCash: 2_400, rankMultiplier: 1.15, requiredLevel: 14, maxLevel: 4 },
  { id: 'trading.scout-watchlists', group: 'CSWEAR tools', name: 'Scout Watchlists', description: 'Raises the live Market Scout watchlist limit.', consumer: 'Market Scout watchlist validation', effectKey: 'business.scoutWatchlists', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' watchlist', baseCash: 5_000, rankMultiplier: 1.3, requiredLevel: 35, maxLevel: 5, prerequisites: ['trading.saved-searches'] },
  { id: 'trading.scout-coverage', group: 'CSWEAR tools', name: 'Scout Coverage', description: 'Raises the bounded candidate sample inspected during a Scout operation.', consumer: 'Market Scout scheduler', effectKey: 'business.scoutCandidates', effectKind: 'capacity', effectPerLevel: 10, effectUnit: ' candidates per scan', baseCash: 6_500, rankMultiplier: 1.35, requiredLevel: 35, maxLevel: 5, prerequisites: ['trading.liquidity-analysis'] },
  { id: 'trading.deal-indicators', group: 'CSWEAR tools', name: 'Credible Deal Indicators', description: 'Unlocks discount indicators only when valuation confidence is sufficient.', consumer: 'Trading research report', effectKey: 'trading.dealIndicators', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' confidence tier', baseCash: 8_000, rankMultiplier: 1.4, requiredLevel: 40, maxLevel: 3, prerequisites: ['trading.price-confidence', 'trading.liquidity-analysis'] },
  { id: 'trading.listing-history', group: 'CSWEAR tools', name: 'Listing History', description: 'Adds bounded listing-history context to manual comparisons.', consumer: 'Trading research report', effectKey: 'trading.listingHistoryDays', effectKind: 'precision', effectPerLevel: 7, effectUnit: ' days of listing context', baseCash: 9_000, rankMultiplier: 1.45, requiredLevel: 42, maxLevel: 4 },
  { id: 'trading.listing-capacity', group: 'Selling', name: 'Listing Capacity', description: 'Raises the Sales Assistant active ordinary-listing ceiling.', consumer: 'Sales Assistant listing validation', effectKey: 'business.salesListingCapacity', effectKind: 'capacity', effectPerLevel: 3, effectUnit: ' active listings', baseCash: 7_000, rankMultiplier: 1.35, requiredLevel: 35, maxLevel: 5 },
  { id: 'trading.fee-desk', group: 'Selling', name: 'Fee Desk', description: 'Reduces simulated CSWEAR seller fees within a strict safe cap.', consumer: 'Marketplace player-sale settlement', effectKey: 'trading.sellerFeeDiscount', effectKind: 'discount', effectPerLevel: 0.005, effectUnit: ' lower seller fee', baseCash: 12_000, rankMultiplier: 1.5, requiredLevel: 45, maxLevel: 5 },
  { id: 'trading.price-presets', group: 'Selling', name: 'Pricing Presets', description: 'Adds fair-value-relative manual listing presets.', consumer: 'Trading research tool capacity', effectKey: 'trading.pricePresets', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' pricing presets', baseCash: 5_500, rankMultiplier: 1.3, requiredLevel: 30, maxLevel: 4 },
  { id: 'trading.expiry-management', group: 'Selling', name: 'Expiry Management', description: 'Adds bounded Sales Assistant expiry and relist policy tiers.', consumer: 'Sales Assistant policy validation', effectKey: 'business.expiryPolicies', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' expiry policy tier', baseCash: 10_000, rankMultiplier: 1.45, requiredLevel: 45, maxLevel: 3 },
  { id: 'trading.seller-reputation', group: 'Negotiation research', name: 'Seller Reputation', description: 'Reveals the simulated seller reputation signal.', consumer: 'Trading research report', effectKey: 'trading.sellerReputation', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' reputation view', baseCash: 4_000, rankMultiplier: 1.25, requiredLevel: 20, maxLevel: 1 },
  { id: 'trading.patience-estimate', group: 'Negotiation research', name: 'Patience Estimate', description: 'Adds a conservative seller-patience band without revealing the reservation price.', consumer: 'Trading research report', effectKey: 'trading.patienceEstimate', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' patience precision tier', baseCash: 8_500, rankMultiplier: 1.4, requiredLevel: 38, maxLevel: 3, prerequisites: ['trading.seller-reputation'] },
  { id: 'trading.offer-range', group: 'Negotiation research', name: 'Offer Range Research', description: 'Shows a non-binding manual offer range; negotiation still requires player action.', consumer: 'Trading research report', effectKey: 'trading.offerRange', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' offer analysis tier', baseCash: 14_000, rankMultiplier: 1.55, requiredLevel: 50, maxLevel: 3, prerequisites: ['trading.patience-estimate'] },
  { id: 'trading.counter-history', group: 'Negotiation research', name: 'Counteroffer History', description: 'Expands the bounded negotiation history presented for a seller.', consumer: 'Trading research report', effectKey: 'trading.counterHistory', effectKind: 'capacity', effectPerLevel: 2, effectUnit: ' counteroffers retained', baseCash: 18_000, rankMultiplier: 1.6, requiredLevel: 55, maxLevel: 3, prerequisites: ['trading.offer-range'] },
  { id: 'trading.inventory-bridge', group: 'Selling', name: 'Inventory Bridge', description: 'Unlocks richer inventory-to-market comparison summaries.', consumer: 'Trading research report', effectKey: 'trading.inventoryBridge', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' inventory bridge', baseCash: 12_000, rankMultiplier: 1.5, requiredLevel: 50, maxLevel: 1, prerequisites: ['trading.price-presets'] },
  { id: 'trading.research-terminal', group: 'Market research', name: 'Research Terminal', description: 'Combines confidence, spread, liquidity, Pattern and float evidence into one advanced report.', consumer: 'Trading research report', effectKey: 'trading.researchTerminal', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' advanced terminal', baseCash: 75_000, rankMultiplier: 2.2, requiredLevel: 75, maxLevel: 1, prerequisites: ['trading.pattern-research', 'trading.deal-indicators', 'trading.float-comparison'] },
])

const COLLECTING_UPGRADES = defineBranch('collecting', [
  { id: 'collecting.missing-filter', group: 'Collection research', name: 'Missing-Skin Filter', description: 'Unlocks focused missing-item research summaries.', consumer: 'Collector research report', effectKey: 'collecting.missingFilter', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' missing filter', baseCash: 400, rankMultiplier: 1, requiredLevel: 1, maxLevel: 1 },
  { id: 'collecting.wear-analysis', group: 'Collection research', name: 'Wear Completion Analysis', description: 'Adds valid-wear completion detail without inventing impossible conditions.', consumer: 'Collector research report', effectKey: 'collecting.wearAnalysis', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' wear analysis tier', baseCash: 1_200, rankMultiplier: 1.05, requiredLevel: 6, maxLevel: 3 },
  { id: 'collecting.pattern-classification', group: 'Collection research', name: 'Pattern Classification', description: 'Unlocks increasingly detailed supported Pattern-family research.', consumer: 'Collector research report', effectKey: 'collecting.patternClassification', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' Pattern research tier', baseCash: 2_500, rankMultiplier: 1.15, requiredLevel: 12, maxLevel: 3 },
  { id: 'collecting.discovery-journal', group: 'Collection research', name: 'Discovery Journal', description: 'Adds first-seen and best-item history summaries.', consumer: 'Collector research report', effectKey: 'collecting.discoveryJournal', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' discovery journal', baseCash: 1_800, rankMultiplier: 1.1, requiredLevel: 10, maxLevel: 1 },
  { id: 'collecting.duplicate-guard', group: 'Inventory management', name: 'Duplicate Guard', description: 'Adds protected duplicate-rule profile slots; item protections remain authoritative.', consumer: 'Collector organization capacity', effectKey: 'collecting.duplicateProfiles', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' duplicate profiles', baseCash: 2_000, rankMultiplier: 1.1, requiredLevel: 10, maxLevel: 4 },
  { id: 'collecting.folders', group: 'Inventory management', name: 'Collection Folders', description: 'Adds organization folder capacity for collection planning.', consumer: 'Collector organization capacity', effectKey: 'collecting.folders', effectKind: 'capacity', effectPerLevel: 2, effectUnit: ' collection folders', baseCash: 2_800, rankMultiplier: 1.15, requiredLevel: 15, maxLevel: 5 },
  { id: 'collecting.labels', group: 'Inventory management', name: 'Collection Labels', description: 'Adds reusable item-label capacity.', consumer: 'Collector organization capacity', effectKey: 'collecting.labels', effectKind: 'capacity', effectPerLevel: 3, effectUnit: ' collection labels', baseCash: 3_200, rankMultiplier: 1.2, requiredLevel: 18, maxLevel: 4 },
  { id: 'collecting.reservation-tools', group: 'Inventory management', name: 'Reservation Tools', description: 'Adds explicit collection reservation policy slots alongside lock and favorite protection.', consumer: 'Collector organization capacity', effectKey: 'collecting.reservations', effectKind: 'capacity', effectPerLevel: 2, effectUnit: ' reservation policies', baseCash: 4_000, rankMultiplier: 1.25, requiredLevel: 22, maxLevel: 4 },
  { id: 'collecting.priority-lists', group: 'Inventory management', name: 'Priority Lists', description: 'Adds ordered collection target lists.', consumer: 'Collector organization capacity', effectKey: 'collecting.priorityLists', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' priority lists', baseCash: 5_000, rankMultiplier: 1.3, requiredLevel: 25, maxLevel: 4 },
  { id: 'collecting.storage-cases', group: 'Inventory management', name: 'Storage Cases', description: 'Adds legitimate inventory storage capacity without deleting over-cap items.', consumer: 'Inventory capacity calculation', effectKey: 'inventory.capacity', effectKind: 'capacity', effectPerLevel: 50, effectUnit: ' inventory slots', baseCash: 6_000, rankMultiplier: 1.35, requiredLevel: 30, maxLevel: 5 },
  { id: 'collecting.trophy-expansion', group: 'Showcase', name: 'Trophy Expansion', description: 'Adds additional display capacity for the Trophy Room.', consumer: 'Trophy Room slot calculation', effectKey: 'collecting.trophySlots', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' trophy slots', baseCash: 7_500, rankMultiplier: 1.4, requiredLevel: 35, maxLevel: 5 },
  { id: 'collecting.display-templates', group: 'Showcase', name: 'Display Templates', description: 'Adds reusable showcase layout templates.', consumer: 'Collector showcase capacity', effectKey: 'collecting.displayTemplates', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' display templates', baseCash: 9_000, rankMultiplier: 1.45, requiredLevel: 40, maxLevel: 4 },
  { id: 'collecting.exhibitions', group: 'Showcase', name: 'Collection Exhibitions', description: 'Adds curated exhibition slots for themed collections.', consumer: 'Collector showcase capacity', effectKey: 'collecting.exhibitions', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' exhibitions', baseCash: 14_000, rankMultiplier: 1.55, requiredLevel: 50, maxLevel: 4 },
  { id: 'collecting.achievement-display', group: 'Showcase', name: 'Achievement Display', description: 'Adds achievement-display capacity to collector summaries.', consumer: 'Collector showcase capacity', effectKey: 'collecting.achievementDisplays', effectKind: 'capacity', effectPerLevel: 2, effectUnit: ' achievement displays', baseCash: 10_000, rankMultiplier: 1.5, requiredLevel: 45, maxLevel: 4 },
  { id: 'collecting.reputation', group: 'Collection milestones', name: 'Collector Reputation', description: 'Adds visible milestone tiers driven by genuine discovery activity.', consumer: 'Collector research report', effectKey: 'collecting.reputationTier', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' collector tier', baseCash: 20_000, rankMultiplier: 1.65, requiredLevel: 55, maxLevel: 5, requiredSpecializationXp: 1_000 },
  { id: 'collecting.legacy-catalog', group: 'Collection milestones', name: 'Legacy Catalog Preparation', description: 'Prepares exportable collection records for the future Legacy Vault without promising protection.', consumer: 'Collector research report', effectKey: 'collecting.legacyCatalog', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' legacy-ready catalog', baseCash: 60_000, rankMultiplier: 2.1, requiredLevel: 75, maxLevel: 1, prerequisites: ['collecting.discovery-journal', 'collecting.reputation'] },
])

const TRADE_UP_UPGRADES = defineBranch('tradeUps', [
  { id: 'trade-ups.expected-value', group: 'Analysis', name: 'Expected Output Value', description: 'Shows honest expected output value from the real outcome distribution.', consumer: 'Trade-up research report', effectKey: 'tradeUps.expectedValue', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' EV report', baseCash: 600, rankMultiplier: 1, requiredLevel: 1, maxLevel: 1 },
  { id: 'trade-ups.opportunity-cost', group: 'Analysis', name: 'Opportunity Cost', description: 'Shows the actual consumed item value rather than an artificial discount.', consumer: 'Trade-up research report', effectKey: 'tradeUps.opportunityCost', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' cost report', baseCash: 1_000, rankMultiplier: 1, requiredLevel: 5, maxLevel: 1 },
  { id: 'trade-ups.outcome-distribution', group: 'Analysis', name: 'Outcome Distribution', description: 'Shows weighted output ranges for eligible collections.', consumer: 'Trade-up research report', effectKey: 'tradeUps.outcomeDistribution', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' distribution tier', baseCash: 1_800, rankMultiplier: 1.1, requiredLevel: 10, maxLevel: 3, prerequisites: ['trade-ups.expected-value'] },
  { id: 'trade-ups.probability-breakdown', group: 'Analysis', name: 'Probability Breakdown', description: 'Adds per-outcome probability detail.', consumer: 'Trade-up research report', effectKey: 'tradeUps.probabilityBreakdown', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' probability tier', baseCash: 2_400, rankMultiplier: 1.15, requiredLevel: 14, maxLevel: 3, prerequisites: ['trade-ups.outcome-distribution'] },
  { id: 'trade-ups.float-mapping', group: 'Analysis', name: 'Float Mapping', description: 'Visualizes normalized input float mapped into each valid output range.', consumer: 'Trade-up research report', effectKey: 'tradeUps.floatMapping', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' float analysis tier', baseCash: 3_000, rankMultiplier: 1.2, requiredLevel: 16, maxLevel: 3 },
  { id: 'trade-ups.roi-analysis', group: 'Analysis', name: 'ROI Analysis', description: 'Shows expected return relative to actual opportunity cost.', consumer: 'Trade-up research report', effectKey: 'tradeUps.roiAnalysis', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' ROI report', baseCash: 3_500, rankMultiplier: 1.2, requiredLevel: 18, maxLevel: 1, prerequisites: ['trade-ups.opportunity-cost'] },
  { id: 'trade-ups.worst-case', group: 'Analysis', name: 'Worst-Case Loss', description: 'Shows the lowest-valued valid outcome and downside exposure.', consumer: 'Trade-up research report', effectKey: 'tradeUps.worstCase', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' downside report', baseCash: 5_000, rankMultiplier: 1.3, requiredLevel: 25, maxLevel: 1, prerequisites: ['trade-ups.probability-breakdown'] },
  { id: 'trade-ups.saved-templates', group: 'Planning', name: 'Saved Contracts', description: 'Adds saved contract template slots.', consumer: 'Trade-up planning capacity', effectKey: 'tradeUps.savedTemplates', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' contract templates', baseCash: 2_000, rankMultiplier: 1.1, requiredLevel: 12, maxLevel: 5 },
  { id: 'trade-ups.collection-search', group: 'Planning', name: 'Collection Search', description: 'Adds collection-specific candidate-search tiers.', consumer: 'Trade-up research report', effectKey: 'tradeUps.collectionSearch', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' collection search tier', baseCash: 2_800, rankMultiplier: 1.15, requiredLevel: 15, maxLevel: 3 },
  { id: 'trade-ups.inventory-filters', group: 'Planning', name: 'Input Filters', description: 'Adds saved eligible-input filter slots.', consumer: 'Trade-up planning capacity', effectKey: 'tradeUps.inputFilters', effectKind: 'capacity', effectPerLevel: 2, effectUnit: ' input filters', baseCash: 3_200, rankMultiplier: 1.2, requiredLevel: 18, maxLevel: 4 },
  { id: 'trade-ups.contract-comparison', group: 'Planning', name: 'Contract Comparison', description: 'Adds side-by-side contract comparison capacity.', consumer: 'Trade-up planning capacity', effectKey: 'tradeUps.comparisonSlots', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' comparison slots', baseCash: 5_000, rankMultiplier: 1.3, requiredLevel: 25, maxLevel: 4 },
  { id: 'trade-ups.input-optimizer', group: 'Planning', name: 'Input Optimizer', description: 'Ranks owned eligible inputs by honest cost and float fit; it never creates items.', consumer: 'Trade-up research report', effectKey: 'tradeUps.inputOptimizer', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' optimizer tier', baseCash: 8_000, rankMultiplier: 1.4, requiredLevel: 35, maxLevel: 3, prerequisites: ['trade-ups.float-mapping', 'trade-ups.collection-search'] },
  { id: 'trade-ups.risk-presets', group: 'Planning', name: 'Risk Presets', description: 'Adds reusable manual risk-profile slots.', consumer: 'Trade-up planning capacity', effectKey: 'tradeUps.riskPresets', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' risk presets', baseCash: 7_000, rankMultiplier: 1.35, requiredLevel: 32, maxLevel: 4 },
  { id: 'trade-ups.specialist-throughput', group: 'Specialist', name: 'Specialist Throughput', description: 'Raises the Trade-Up Specialist ordinary-contract shift ceiling.', consumer: 'Trade-Up Specialist scheduler', effectKey: 'business.tradeUpContracts', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' ordinary contract per shift', baseCash: 9_000, rankMultiplier: 1.45, requiredLevel: 40, maxLevel: 4 },
  { id: 'trade-ups.candidate-scanning', group: 'Specialist', name: 'Candidate Scanning', description: 'Raises the bounded inventory candidates reviewed per operation.', consumer: 'Trade-Up Specialist scheduler', effectKey: 'business.tradeUpCandidates', effectKind: 'capacity', effectPerLevel: 10, effectUnit: ' candidate inputs', baseCash: 10_000, rankMultiplier: 1.45, requiredLevel: 42, maxLevel: 4 },
  { id: 'trade-ups.budget-controls', group: 'Specialist', name: 'Contract Budget Controls', description: 'Adds Specialist budget-policy tiers without bypassing allocated funds.', consumer: 'Business employee policy summary', effectKey: 'business.tradeUpBudgetPolicies', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' budget policy tier', baseCash: 12_000, rankMultiplier: 1.5, requiredLevel: 45, maxLevel: 3 },
  { id: 'trade-ups.safe-execution', group: 'Specialist', name: 'Safe Auto-Execution', description: 'Raises the confirmed ordinary-contract value threshold; high-value contracts still pause.', consumer: 'Trade-Up Specialist approval threshold', effectKey: 'business.tradeUpApprovalThreshold', effectKind: 'capacity', effectPerLevel: 100, effectUnit: ' automatic value ceiling', baseCash: 20_000, rankMultiplier: 1.65, requiredLevel: 55, maxLevel: 3, prerequisites: ['trade-ups.worst-case', 'trade-ups.input-optimizer'] },
  { id: 'trade-ups.five-covert-research', group: 'Research', name: 'Five-Covert Research', description: 'Unlocks advanced analysis for special five-Covert contracts; execution remains manual.', consumer: 'Trade-up research report', effectKey: 'tradeUps.fiveCovertResearch', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' five-Covert report', baseCash: 80_000, rankMultiplier: 2.2, requiredLevel: 75, maxLevel: 1, prerequisites: ['trade-ups.roi-analysis', 'trade-ups.worst-case'] },
])

const BUSINESS_UPGRADES = defineBranch('business', [
  { id: 'business.operating-desk', group: 'Management', name: 'Operating Desk', description: 'Adds one active employee capacity per level.', consumer: 'Business operating-capacity validation', effectKey: 'business.operatingCapacity', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' active employee', baseCash: 5_000, rankMultiplier: 1.3, requiredLevel: 15, maxLevel: 3 },
  { id: 'business.training-plans', group: 'Management', name: 'Training Plans', description: 'Reduces employee training costs within a strict cap.', consumer: 'Employee training price', effectKey: 'business.trainingDiscount', effectKind: 'discount', effectPerLevel: 0.03, effectUnit: ' lower training cost', baseCash: 6_000, rankMultiplier: 1.35, requiredLevel: 20, maxLevel: 5 },
  { id: 'business.schedule-profiles', group: 'Management', name: 'Schedule Profiles', description: 'Adds reusable employee schedule profile capacity.', consumer: 'Business policy summary', effectKey: 'business.scheduleProfiles', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' schedule profiles', baseCash: 4_000, rankMultiplier: 1.25, requiredLevel: 15, maxLevel: 4 },
  { id: 'business.budget-policies', group: 'Management', name: 'Budget Policies', description: 'Adds reusable operating-budget policy capacity.', consumer: 'Business policy summary', effectKey: 'business.budgetPolicies', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' budget policies', baseCash: 4_500, rankMultiplier: 1.25, requiredLevel: 18, maxLevel: 4 },
  { id: 'business.shift-planning', group: 'Management', name: 'Shift Planning', description: 'Adds shift-plan tiers shown beside employee operations.', consumer: 'Business policy summary', effectKey: 'business.shiftPlanning', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' shift-planning tier', baseCash: 7_000, rankMultiplier: 1.35, requiredLevel: 25, maxLevel: 3 },
  { id: 'business.scheduler', group: 'Operations', name: 'Operations Scheduler', description: 'Reduces employee operation intervals with a bounded efficiency curve.', consumer: 'Online and offline Business scheduler', effectKey: 'business.intervalReduction', effectKind: 'speed', effectPerLevel: 0.03, effectUnit: ' faster operations', baseCash: 10_000, rankMultiplier: 1.45, requiredLevel: 35, maxLevel: 5 },
  { id: 'business.operation-batching', group: 'Operations', name: 'Operation Batching', description: 'Raises the bounded number of due operations processed per scheduler pass.', consumer: 'Business scheduler operation cap', effectKey: 'business.schedulerOperations', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' operation per pass', baseCash: 12_000, rankMultiplier: 1.5, requiredLevel: 40, maxLevel: 4 },
  { id: 'business.pause-policies', group: 'Operations', name: 'Pause Policies', description: 'Adds visible automatic pause-policy tiers for budget, capacity and risk.', consumer: 'Business policy summary', effectKey: 'business.pausePolicies', effectKind: 'capacity', effectPerLevel: 1, effectUnit: ' pause policy tier', baseCash: 8_000, rankMultiplier: 1.4, requiredLevel: 30, maxLevel: 3 },
  { id: 'business.warehouse-racks', group: 'Infrastructure', name: 'Warehouse Racks', description: 'Adds inventory capacity without removing existing items.', consumer: 'Inventory capacity calculation', effectKey: 'inventory.capacity', effectKind: 'capacity', effectPerLevel: 100, effectUnit: ' inventory slots', baseCash: 8_000, rankMultiplier: 1.4, requiredLevel: 25, maxLevel: 5 },
  { id: 'business.listing-infrastructure', group: 'Infrastructure', name: 'Listing Infrastructure', description: 'Raises routine active-listing capacity for the Sales Assistant.', consumer: 'Sales Assistant listing validation', effectKey: 'business.salesListingCapacity', effectKind: 'capacity', effectPerLevel: 2, effectUnit: ' active listings', baseCash: 9_000, rankMultiplier: 1.45, requiredLevel: 35, maxLevel: 5 },
  { id: 'business.operations-reporting', group: 'Infrastructure', name: 'Operations Reporting', description: 'Adds increasingly detailed operation and failure summaries.', consumer: 'Business research report', effectKey: 'business.reportingTier', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' reporting tier', baseCash: 5_000, rankMultiplier: 1.3, requiredLevel: 20, maxLevel: 3 },
  { id: 'business.expense-analysis', group: 'Finance', name: 'Expense Analysis', description: 'Adds payroll and operating-expense breakdown tiers.', consumer: 'Business research report', effectKey: 'business.expenseAnalysis', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' expense-analysis tier', baseCash: 7_500, rankMultiplier: 1.4, requiredLevel: 30, maxLevel: 3 },
  { id: 'business.roi-reporting', group: 'Finance', name: 'Employee ROI', description: 'Adds realized employee ROI reporting based on ledger-backed results.', consumer: 'Business research report', effectKey: 'business.roiReporting', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' ROI-report tier', baseCash: 11_000, rankMultiplier: 1.5, requiredLevel: 40, maxLevel: 3, prerequisites: ['business.operations-reporting'] },
  { id: 'business.cashflow-projection', group: 'Finance', name: 'Cash-Flow Projection', description: 'Adds conservative reserved-capital and wage-runway projections.', consumer: 'Business research report', effectKey: 'business.cashflowProjection', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' projection tier', baseCash: 15_000, rankMultiplier: 1.55, requiredLevel: 50, maxLevel: 3, prerequisites: ['business.expense-analysis'] },
  { id: 'business.overhead-controls', group: 'Finance', name: 'Overhead Controls', description: 'Reduces payroll overhead modestly without eliminating wages.', consumer: 'Employee payroll settlement', effectKey: 'business.payrollDiscount', effectKind: 'discount', effectPerLevel: 0.02, effectUnit: ' lower payroll', baseCash: 20_000, rankMultiplier: 1.65, requiredLevel: 55, maxLevel: 5 },
  { id: 'business.case-operator-desk', group: 'Role infrastructure', name: 'Case Operator Desk', description: 'Adds Case Operator policy capacity and monitored controls.', consumer: 'Business employee policy summary', effectKey: 'business.caseOperatorDesk', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' operator desk tier', baseCash: 10_000, rankMultiplier: 1.45, requiredLevel: 35, maxLevel: 3 },
  { id: 'business.sales-workflow', group: 'Role infrastructure', name: 'Sales Workflow', description: 'Adds routine Sales Assistant workflow tiers without touching protected items.', consumer: 'Sales Assistant scheduler', effectKey: 'business.salesWorkflow', effectKind: 'precision', effectPerLevel: 1, effectUnit: ' sales workflow tier', baseCash: 12_000, rankMultiplier: 1.5, requiredLevel: 40, maxLevel: 3 },
  { id: 'business.scout-network', group: 'Role infrastructure', name: 'Scout Network', description: 'Adds bounded Market Scout candidate coverage.', consumer: 'Market Scout scheduler', effectKey: 'business.scoutCandidates', effectKind: 'capacity', effectPerLevel: 8, effectUnit: ' candidates per scan', baseCash: 14_000, rankMultiplier: 1.55, requiredLevel: 45, maxLevel: 4 },
  { id: 'business.contract-lab', group: 'Role infrastructure', name: 'Contract Lab', description: 'Adds Trade-Up Specialist candidate analysis capacity.', consumer: 'Trade-Up Specialist scheduler', effectKey: 'business.tradeUpCandidates', effectKind: 'capacity', effectPerLevel: 8, effectUnit: ' candidate inputs', baseCash: 16_000, rankMultiplier: 1.6, requiredLevel: 50, maxLevel: 4 },
  { id: 'business.junior-desk', group: 'Role infrastructure', name: 'Junior Trader Desk', description: 'Raises bounded ordinary-offer research per operation; high-value items remain blocked.', consumer: 'Junior Trader scheduler', effectKey: 'business.juniorCandidates', effectKind: 'capacity', effectPerLevel: 6, effectUnit: ' candidate offers', baseCash: 18_000, rankMultiplier: 1.65, requiredLevel: 55, maxLevel: 4 },
  { id: 'business.executive-suite', group: 'Management', name: 'Executive Suite', description: 'Unlocks the unified high-level business report after mastering core infrastructure.', consumer: 'Business research report', effectKey: 'business.executiveReport', effectKind: 'unlock', effectPerLevel: 1, effectUnit: ' executive report', baseCash: 100_000, rankMultiplier: 2.3, requiredLevel: 75, maxLevel: 1, prerequisites: ['business.roi-reporting', 'business.cashflow-projection', 'business.operating-desk'] },
])

export const CAREER_UPGRADE_DEFINITIONS: CareerUpgradeDefinition[] = [
  ...CASE_OPENING_UPGRADES,
  ...TRADING_UPGRADES,
  ...COLLECTING_UPGRADES,
  ...TRADE_UP_UPGRADES,
  ...BUSINESS_UPGRADES,
]

export const careerUpgradesById = new Map(CAREER_UPGRADE_DEFINITIONS.map((definition) => [definition.id, definition]))

export const CAREER_UPGRADE_COUNTS = Object.freeze({
  caseOpening: CASE_OPENING_UPGRADES.length,
  trading: TRADING_UPGRADES.length,
  collecting: COLLECTING_UPGRADES.length,
  tradeUps: TRADE_UP_UPGRADES.length,
  business: BUSINESS_UPGRADES.length,
  total: CAREER_UPGRADE_DEFINITIONS.length,
})

export function createDefaultCareerUpgradeState(now = 0): CareerUpgradeState {
  return {
    schemaVersion: 1,
    levels: {},
    purchasedAt: {},
    migration: {
      applied: false,
      appliedAt: now,
      legacySkillPoints: 0,
      legacyUpgradePoints: 0,
      legacyLearnedSkills: 0,
      legacyUpgradeLevels: 0,
      initialTransitionCredit: 0,
      transitionCredit: 0,
      note: '',
    },
  }
}

function finiteInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(maximum, Math.floor(value)))
    : 0
}

export function normalizeCareerUpgradeState(value: unknown, now = Date.now()): CareerUpgradeState {
  const defaults = createDefaultCareerUpgradeState(now)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults
  const source = value as Record<string, unknown>
  const rawLevels = source.levels && typeof source.levels === 'object' && !Array.isArray(source.levels)
    ? source.levels as Record<string, unknown>
    : {}
  const levels = Object.fromEntries(CAREER_UPGRADE_DEFINITIONS.flatMap((definition) => {
    const level = finiteInteger(rawLevels[definition.id], definition.maxLevel)
    return level > 0 ? [[definition.id, level]] : []
  }))
  const rawPurchasedAt = source.purchasedAt && typeof source.purchasedAt === 'object' && !Array.isArray(source.purchasedAt)
    ? source.purchasedAt as Record<string, unknown>
    : {}
  const purchasedAt = Object.fromEntries(Object.keys(levels).map((id) => [id, Math.max(0, Number(rawPurchasedAt[id]) || now)]))
  const rawMigration = source.migration && typeof source.migration === 'object' && !Array.isArray(source.migration)
    ? source.migration as Record<string, unknown>
    : {}
  const initialTransitionCredit = Math.min(75_000, Math.max(0, Number(rawMigration.initialTransitionCredit) || 0))
  return {
    schemaVersion: 1,
    levels,
    purchasedAt,
    migration: {
      applied: Boolean(rawMigration.applied),
      appliedAt: Number.isFinite(Number(rawMigration.appliedAt)) ? Math.max(0, Number(rawMigration.appliedAt)) : now,
      legacySkillPoints: finiteInteger(rawMigration.legacySkillPoints),
      legacyUpgradePoints: finiteInteger(rawMigration.legacyUpgradePoints),
      legacyLearnedSkills: finiteInteger(rawMigration.legacyLearnedSkills),
      legacyUpgradeLevels: finiteInteger(rawMigration.legacyUpgradeLevels),
      initialTransitionCredit,
      transitionCredit: Math.min(initialTransitionCredit, Math.max(0, Number(rawMigration.transitionCredit) || 0)),
      note: typeof rawMigration.note === 'string' ? rawMigration.note.slice(0, 500) : '',
    },
  }
}

export function createLegacyCareerUpgradeState(input: {
  now: number
  skillPoints: number
  upgradePoints: number
  learnedSkillCount: number
  legacyUpgradeLevels: number
}): CareerUpgradeState {
  const skillPoints = finiteInteger(input.skillPoints)
  const upgradePoints = finiteInteger(input.upgradePoints)
  const learnedSkillCount = finiteInteger(input.learnedSkillCount)
  const legacyUpgradeLevels = finiteInteger(input.legacyUpgradeLevels)
  const transitionCredit = Math.min(75_000, Math.round(
    skillPoints * 500 +
    upgradePoints * 1_000 +
    learnedSkillCount * 250 +
    legacyUpgradeLevels * 750,
  ))
  const state = createDefaultCareerUpgradeState(input.now)
  return {
    ...state,
    migration: {
      applied: true,
      appliedAt: input.now,
      legacySkillPoints: skillPoints,
      legacyUpgradePoints: upgradePoints,
      legacyLearnedSkills: learnedSkillCount,
      legacyUpgradeLevels,
      initialTransitionCredit: transitionCredit,
      transitionCredit,
      note: transitionCredit > 0
        ? `Legacy Skill Tree and run-upgrade investments became ${transitionCredit.toLocaleString()} noncash Career Upgrade credit. Automation investments already converted into Business were excluded.`
        : 'Legacy progression was archived. No safe noncash transition credit was available.',
    },
  }
}

export function getCareerUpgradeLevel(state: CareerUpgradeState | CareerUpgradeLevels, id: string) {
  const levels = typeof (state as CareerUpgradeState).levels === 'object'
    ? (state as CareerUpgradeState).levels
    : state as CareerUpgradeLevels
  const definition = careerUpgradesById.get(id)
  return finiteInteger(levels[id], definition?.maxLevel ?? 0)
}

export function getCareerUpgradeEffect(state: CareerUpgradeState | CareerUpgradeLevels, effectKey: string) {
  return CAREER_UPGRADE_DEFINITIONS.reduce((total, definition) => (
    definition.effectKey === effectKey
      ? total + getCareerUpgradeLevel(state, definition.id) * definition.effectPerLevel
      : total
  ), 0)
}

export function hasCareerUpgradeEffect(state: CareerUpgradeState | CareerUpgradeLevels, effectKey: string) {
  return getCareerUpgradeEffect(state, effectKey) > 0
}

export function getCareerUpgradeCost(definition: CareerUpgradeDefinition, currentLevel: number) {
  return Number((definition.baseCash * 1.72 ** Math.max(0, currentLevel) * definition.rankMultiplier).toFixed(2))
}

export function getCareerUpgradeStatus(definition: CareerUpgradeDefinition, input: {
  career: CareerState
  money: number
  upgrades: CareerUpgradeState
}) {
  const level = getCareerUpgradeLevel(input.upgrades, definition.id)
  const specializationXp = input.career.specializations[definition.specialization]?.currentRunXp ?? 0
  const prerequisiteStatuses = definition.prerequisites.map((id) => ({
    id,
    name: careerUpgradesById.get(id)?.name ?? id,
    met: getCareerUpgradeLevel(input.upgrades, id) > 0,
  }))
  const cost = getCareerUpgradeCost(definition, level)
  const transitionCredit = input.upgrades.migration.transitionCredit
  return {
    level,
    cost,
    cashCost: Math.max(0, Number((cost - transitionCredit).toFixed(2))),
    creditUsed: Math.min(cost, transitionCredit),
    isMaxLevel: level >= definition.maxLevel,
    levelMet: getCareerSnapshot(input.career).level >= definition.requiredLevel,
    activityMet: specializationXp >= definition.requiredSpecializationXp,
    prerequisitesMet: prerequisiteStatuses.every((entry) => entry.met),
    prerequisiteStatuses,
    canAfford: input.money + transitionCredit >= cost,
  }
}

function formatMagnitude(definition: CareerUpgradeDefinition, level: number) {
  const value = definition.effectPerLevel * Math.max(0, level)
  if (definition.effectKind === 'discount' || definition.effectKind === 'speed') {
    return `${Number((value * 100).toFixed(1))}%${definition.effectUnit}`
  }
  return `${Number(value.toFixed(2)).toLocaleString()}${definition.effectUnit}`
}

export function getCareerUpgradeCurrentEffect(definition: CareerUpgradeDefinition, level: number) {
  return level <= 0 ? 'Not active' : formatMagnitude(definition, level)
}

export function getCareerUpgradeNextEffect(definition: CareerUpgradeDefinition, level: number) {
  return level >= definition.maxLevel ? 'Maximum level reached' : formatMagnitude(definition, level + 1)
}

export function resetCareerUpgradesForPrestige(state: CareerUpgradeState, retentionRate = 0): CareerUpgradeState {
  const boundedRate = Math.min(.25, Math.max(0, retentionRate))
  const levels = Object.fromEntries(Object.entries(state.levels).flatMap(([id, level]) => {
    const retained = Math.floor(Math.max(0, level) * boundedRate)
    return retained > 0 ? [[id, retained]] : []
  }))
  return {
    ...state,
    levels,
    purchasedAt: Object.fromEntries(Object.entries(state.purchasedAt).filter(([id]) => levels[id] > 0)),
  }
}

export function getSpecializationUpgradeProgress(state: CareerUpgradeState, specialization: UpgradeSpecialization) {
  const definitions = CAREER_UPGRADE_DEFINITIONS.filter((definition) => definition.specialization === specialization)
  const purchased = definitions.filter((definition) => getCareerUpgradeLevel(state, definition.id) > 0).length
  const completedLevels = definitions.reduce((sum, definition) => sum + getCareerUpgradeLevel(state, definition.id), 0)
  const maximumLevels = definitions.reduce((sum, definition) => sum + definition.maxLevel, 0)
  return { nodes: definitions.length, purchased, completedLevels, maximumLevels }
}

export function getActiveCareerUpgradeCapabilities(
  state: CareerUpgradeState,
  specialization: UpgradeSpecialization,
) {
  return CAREER_UPGRADE_DEFINITIONS
    .filter((definition) => definition.specialization === specialization)
    .flatMap((definition) => {
      const level = getCareerUpgradeLevel(state, definition.id)
      return level > 0 ? [{
        id: definition.id,
        name: definition.name,
        group: definition.group,
        consumer: definition.consumer,
        effectKey: definition.effectKey,
        level,
        effect: getCareerUpgradeCurrentEffect(definition, level),
      }] : []
    })
}

export function getCareerMultiOpenBatch(state: CareerUpgradeState) {
  return Math.min(100, 10 + getCareerUpgradeEffect(state, 'opening.batchCapacity'))
}

export function getCareerOpeningAnimationSpeedBonus(state: CareerUpgradeState) {
  return Math.min(0.3, getCareerUpgradeEffect(state, 'opening.animationSpeed'))
}

export function getCareerInventoryCapacityBonus(state: CareerUpgradeState) {
  return Math.max(0, Math.floor(getCareerUpgradeEffect(state, 'inventory.capacity')))
}

export function getCareerOperatingCapacityBonus(state: CareerUpgradeState) {
  return Math.max(0, Math.floor(getCareerUpgradeEffect(state, 'business.operatingCapacity')))
}

export function getCareerTrainingDiscount(state: CareerUpgradeState) {
  return Math.min(0.15, getCareerUpgradeEffect(state, 'business.trainingDiscount'))
}

export function getCareerPayrollDiscount(state: CareerUpgradeState) {
  return Math.min(0.1, getCareerUpgradeEffect(state, 'business.payrollDiscount'))
}

export function getCareerBusinessIntervalMultiplier(state: CareerUpgradeState) {
  return 1 - Math.min(0.15, getCareerUpgradeEffect(state, 'business.intervalReduction'))
}

export function getCareerCaseOperatorBatchBonus(state: CareerUpgradeState) {
  return Math.max(0, Math.floor(getCareerUpgradeEffect(state, 'business.caseOperatorBatch')))
}

export function getCareerScoutWatchlistBonus(state: CareerUpgradeState) {
  return Math.max(0, Math.floor(getCareerUpgradeEffect(state, 'business.scoutWatchlists')))
}

export function getCareerScoutCandidateBonus(state: CareerUpgradeState) {
  return Math.max(0, Math.floor(getCareerUpgradeEffect(state, 'business.scoutCandidates')))
}

export function getCareerListingCapacityBonus(state: CareerUpgradeState) {
  return Math.max(0, Math.floor(getCareerUpgradeEffect(state, 'business.salesListingCapacity')))
}

export function getCareerTradeUpContractBonus(state: CareerUpgradeState) {
  return Math.max(0, Math.floor(getCareerUpgradeEffect(state, 'business.tradeUpContracts')))
}

export function getCareerTradeUpApprovalBonus(state: CareerUpgradeState) {
  return Math.max(0, getCareerUpgradeEffect(state, 'business.tradeUpApprovalThreshold'))
}

export function getCareerSellerFeeDiscount(state: CareerUpgradeState) {
  return Math.min(0.025, getCareerUpgradeEffect(state, 'trading.sellerFeeDiscount'))
}
