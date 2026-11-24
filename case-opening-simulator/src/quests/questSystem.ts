import { getCareerLevelFromXp } from '../career/careerProgress'
import type { GameAction, GameState } from '../data/gameState'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'

export const QUEST_SCHEMA_VERSION = 1 as const
export const QUEST_HISTORY_LIMIT = 120
export const QUEST_REQUEST_LIMIT = 600
export const QUEST_SESSION_ID_LIMIT = 320
export const MAX_TRACKED_QUESTS = 3
const WEEK_MS = 7 * 24 * 60 * 60_000

export type QuestCategory = 'story' | 'collection' | 'opening' | 'contract' | 'repeatable'
export type QuestScope = 'lifetime' | 'currentRun'

export interface QuestReward {
  careerXp?: number
  decoration?: string
  money?: number
  openingCredits?: number
  reputation?: number
  title?: string
}

export type QuestRequirement =
  | { type: 'manual_cases'; target: number; caseIds?: string[] }
  | { type: 'manual_sessions'; target: number }
  | { type: 'discoveries'; target: number }
  | { type: 'discover_weapon'; target: number; weapon: string }
  | { type: 'discover_rarity'; target: number; rarity: Rarity }
  | { type: 'wear_discoveries'; target: number; wear?: WearCondition }
  | { type: 'own_items'; target: number; weapon?: string; rarity?: Rarity; wear?: WearCondition; minimumValue?: number }
  | { type: 'trade_ups'; target: number }
  | { type: 'market_sales'; target: number }
  | { type: 'work_jobs'; target: number }
  | { type: 'career_level'; target: number }
  | { type: 'journal_entries'; target: number; rarity?: Rarity; exceptionalPattern?: boolean }
  | { type: 'deliver_item'; target: 1; weapon?: string; rarity?: Rarity; wear?: WearCondition; minimumValue?: number }
  | { type: 'npc_reputation'; target: number; npcId: string }
  | { type: 'rival_discoveries'; target: number }
  | { type: 'distinct_cases'; target: number }
  | { type: 'weekly_manual_cases'; target: number }
  | { type: 'weekly_work_jobs'; target: number }
  | { type: 'weekly_market_sales'; target: number }
  | { type: 'weekly_discoveries'; target: number }

export interface QuestStageDefinition {
  description: string
  dialogue: string
  id: string
  requirements: QuestRequirement[]
  reward: QuestReward
  title: string
}

export interface QuestDefinition {
  category: QuestCategory
  description: string
  id: string
  issuerId: string
  minimumLevel?: number
  name: string
  optional?: boolean
  prerequisiteQuestIds?: string[]
  relatedCaseIds?: string[]
  repeatable?: 'weekly'
  scope: QuestScope
  stages: QuestStageDefinition[]
}

export interface QuestNpcDefinition {
  accent: string
  description: string
  id: string
  interests: string[]
  name: string
  personality: string
  portrait: string
  role: string
}

export interface QuestProgressState {
  claimedStageIds: string[]
  completedAt?: number
  deliveredStageIds: string[]
  instancePeriod?: number
  stageIndex: number
}

export interface QuestNpcState {
  history: { id: string; message: string; timestamp: number }[]
  reputation: number
  rivalScore: number
  seenDialogueIds: string[]
}

export interface QuestActivityState {
  caseOpenCounts: Record<string, number>
  manualCases: number
  manualSessions: number
  recentSessionIds: string[]
  runCaseOpenCounts: Record<string, number>
  runManualCases: number
  runManualSessions: number
  weeklyDiscoveries: number
  weeklyManualCases: number
  weeklyMarketSales: number
  weeklyWorkJobs: number
}

export interface QuestSystemState {
  activity: QuestActivityState
  cosmetics: { decorations: string[]; titles: string[] }
  currentPeriod: number
  npc: Record<string, QuestNpcState>
  processedRequestIds: string[]
  progress: Record<string, QuestProgressState>
  schemaVersion: typeof QUEST_SCHEMA_VERSION
  trackedQuestIds: string[]
}

export interface QuestRequirementProgress {
  current: number
  label: string
  target: number
}

export interface QuestStageStatus {
  complete: boolean
  requirements: QuestRequirementProgress[]
}

const skinsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))

export const QUEST_NPCS: QuestNpcDefinition[] = [
  { id: 'mara-voss', name: 'Mara Voss', role: 'Neighborhood collector', personality: 'Warm, practical, and delighted by overlooked finishes.', description: 'Mara helps new collectors turn ordinary drops into a collection with a story.', portrait: '/assets/npcs/mara-voss.svg', accent: '#54d6a1', interests: ['Pistols', 'beginner collections', 'wear variety'] },
  { id: 'eli-mercer', name: 'Eli Mercer', role: 'Veteran collector', personality: 'Patient, methodical, and obsessed with complete display cases.', description: 'Eli values breadth, careful records, and finishing a set properly.', portrait: '/assets/npcs/eli-mercer.svg', accent: '#70a7ff', interests: ['Rifles', 'complete sets', 'high-grade finishes'] },
  { id: 'iris-vale', name: 'Iris Vale', role: 'Pattern specialist', personality: 'Precise, skeptical, and unwilling to call an estimate a fact.', description: 'Iris studies genuine Pattern classifications without promising a jackpot.', portrait: '/assets/npcs/iris-vale.svg', accent: '#d784ff', interests: ['Patterns', 'paint indexes', 'float research'] },
  { id: 'rook-vega', name: 'Rook Vega', role: 'Rival trader', personality: 'Competitive and theatrical, but transparent about the rules.', description: 'Rook runs bounded collection contests; no fake multiplayer or manipulated drops.', portrait: '/assets/npcs/rook-vega.svg', accent: '#ff6b6b', interests: ['Rival contests', 'unique finishes', 'trading records'] },
  { id: 'dr-kade', name: 'Dr. Kade', role: 'Trade-up researcher', personality: 'Analytical, terse, and focused on honest opportunity cost.', description: 'Kade turns ordinary contract results into useful research milestones.', portrait: '/assets/npcs/dr-kade.svg', accent: '#62d5ff', interests: ['Trade-ups', 'wear inputs', 'outcome research'] },
  { id: 'finn-blaze', name: 'Finn Blaze', role: 'Case enthusiast', personality: 'Energetic, superstitious about presentation, never about odds.', description: 'Finn celebrates case history while accepting that every result is predetermined fairly.', portrait: '/assets/npcs/finn-blaze.svg', accent: '#ffad42', interests: ['Case variety', 'manual sessions', 'drop records'] },
  { id: 'sana-bell', name: 'Sana Bell', role: 'Market broker', personality: 'Direct, calm, and suspicious of easy-profit claims.', description: 'Sana teaches secondary-market discipline and credible realized outcomes.', portrait: '/assets/npcs/sana-bell.svg', accent: '#51c7c7', interests: ['CSWEAR', 'sales', 'credible pricing'] },
  { id: 'anton-gild', name: 'Anton Gild', role: 'High-end collector', personality: 'Reserved, demanding, and impressed by records rather than luck stories.', description: 'Anton offers optional long-form collection recognition, never guaranteed rare items.', portrait: '/assets/npcs/anton-gild.svg', accent: '#ffd75e', interests: ['Covert records', 'special items', 'lifetime collections'] },
]

const reward = (careerXp: number, openingCredits = 0, money = 0, reputation = 1): QuestReward => ({ careerXp, openingCredits, money, reputation })
const stage = (id: string, title: string, description: string, dialogue: string, requirements: QuestRequirement[], stageReward: QuestReward): QuestStageDefinition => ({ id, title, description, dialogue, requirements, reward: stageReward })

const legacyQuestDefinitions: QuestDefinition[] = [
  { id: 'story-first-crack', name: 'The First Crack', description: 'Mara introduces cases, discoveries, and keeping a collection record.', issuerId: 'mara-voss', category: 'story', scope: 'lifetime', relatedCaseIds: ['crate-4904'], stages: [stage('open-one', 'Open the first case', 'Open one case manually.', 'One honest roll. No promises—just see what the case holds.', [{ type: 'manual_cases', target: 1 }], reward(45, 1.5)), stage('find-three', 'Start a shelf', 'Discover three unique finishes.', 'Sold or kept, a genuine discovery still belongs in your record.', [{ type: 'discoveries', target: 3 }], reward(70, 1.5)), stage('wear-study', 'Notice the wear', 'Record three wear discoveries.', 'Finish names repeat. Wear tells you which copy you actually found.', [{ type: 'wear_discoveries', target: 3 }], { ...reward(90, 2), title: 'Mara’s First Shelf' })] },
  { id: 'story-curators-path', name: 'The Curator’s Path', description: 'Eli asks for breadth across weapon families and quality tiers.', issuerId: 'eli-mercer', category: 'story', scope: 'lifetime', minimumLevel: 3, prerequisiteQuestIds: ['story-first-crack'], stages: [stage('rifles', 'Rifle beginnings', 'Discover three rifle finishes.', 'A collection needs an anchor. Rifles will do.', [{ type: 'discover_weapon', weapon: 'AK-47', target: 1 }, { type: 'discover_weapon', weapon: 'M4', target: 1 }], reward(100, 1)), stage('pink', 'A classified page', 'Discover a Classified finish.', 'Pink is uncommon enough to remember, common enough to pursue honestly.', [{ type: 'discover_rarity', rarity: Rarity.Classified, target: 1 }], reward(130, 1.5)), stage('ten', 'Ten distinct records', 'Reach ten unique finish discoveries.', 'Ten entries: the beginning of a real catalog.', [{ type: 'discoveries', target: 10 }], { ...reward(160, 2), decoration: 'Curator Shelf' })] },
  { id: 'story-rooks-race', name: 'Rook’s Opening Race', description: 'A bounded collection contest against a simulated rival.', issuerId: 'rook-vega', category: 'story', scope: 'currentRun', minimumLevel: 5, stages: [stage('meet-rook', 'Answer the challenge', 'Complete three manual opening sessions.', 'I log my progress too. The rules are visible, and neither of us gets better odds.', [{ type: 'manual_sessions', target: 3 }], reward(90, 1)), stage('race-five', 'Five discoveries ahead', 'Reach five Current Run discoveries and stay ahead of Rook.', 'No timers. Your five records against my bounded score.', [{ type: 'rival_discoveries', target: 5 }], reward(125, 1.5)), stage('race-twelve', 'Win the shelf', 'Reach twelve Current Run discoveries and stay ahead of Rook.', 'A proper win is a record, not a rigged roll.', [{ type: 'rival_discoveries', target: 12 }], { ...reward(180, 2), title: 'Rook’s Rival' })] },
  { id: 'story-pattern-language', name: 'Pattern Language', description: 'Iris introduces numeric Patterns and verified classifications.', issuerId: 'iris-vale', category: 'story', scope: 'lifetime', minimumLevel: 8, stages: [stage('journal', 'Open the journal', 'Record one notable opening.', 'A generic thumbnail is not seed-specific. The metadata is the evidence.', [{ type: 'journal_entries', target: 1 }], reward(100, 1)), stage('classified', 'A better sample', 'Record a Classified-or-better opening.', 'Now we have an item worth inspecting more carefully.', [{ type: 'journal_entries', rarity: Rarity.Classified, target: 1 }], reward(150, 1.5)), stage('pattern', 'Pattern evidence', 'Record an exceptional Pattern discovery.', 'Rare labels come from finish-specific rules, not a universal lucky seed.', [{ type: 'journal_entries', target: 1, exceptionalPattern: true }], { ...reward(220, 2), decoration: 'Pattern Research Board' })] },
  { id: 'story-contract-science', name: 'Contract Science', description: 'Dr. Kade teaches honest trade-up progress.', issuerId: 'dr-kade', category: 'story', scope: 'currentRun', minimumLevel: 7, stages: [stage('one-contract', 'First contract', 'Complete one trade-up.', 'Count the actual inputs. Discounts on paper do not change what you consumed.', [{ type: 'trade_ups', target: 1 }], reward(100, .5)), stage('three-contracts', 'Repeat the method', 'Complete three trade-ups.', 'A method needs repetition, not a lucky screenshot.', [{ type: 'trade_ups', target: 3 }], reward(150, 1)), stage('five-contracts', 'Research set', 'Complete five trade-ups.', 'Five outcomes are still a small sample—but an honest one.', [{ type: 'trade_ups', target: 5 }], { ...reward(200, 1.5), title: 'Contract Researcher' })] },
  { id: 'story-broker-code', name: 'The Broker’s Code', description: 'Sana introduces listings and realized secondary-market results.', issuerId: 'sana-bell', category: 'story', scope: 'currentRun', minimumLevel: 6, stages: [stage('first-sale', 'Complete a sale', 'Complete one CSWEAR player sale.', 'An asking price is not profit. A completed sale is evidence.', [{ type: 'market_sales', target: 1 }], reward(90, 0, 3)), stage('three-sales', 'Build a record', 'Complete three CSWEAR player sales.', 'Three settled transactions tell us more than thirty listings.', [{ type: 'market_sales', target: 3 }], reward(130, .5, 4)), stage('five-sales', 'Trusted counterparty', 'Complete five CSWEAR player sales.', 'You have a record now. Keep the risk visible.', [{ type: 'market_sales', target: 5 }], { ...reward(180, 1, 5), title: 'Sana’s Trusted Broker' })] },
  { id: 'story-case-chronicle', name: 'Case Chronicle', description: 'Finn builds a tour across different official weapon cases.', issuerId: 'finn-blaze', category: 'story', scope: 'lifetime', minimumLevel: 2, relatedCaseIds: ['crate-4001', 'crate-4904', 'crate-7007'], stages: [stage('classic', 'Open a classic', 'Open a CS:GO Weapon Case.', 'Old case, same disclosed rarity ladder.', [{ type: 'manual_cases', caseIds: ['crate-4001'], target: 1 }], reward(90, 1)), stage('modern', 'Open a modern case', 'Open a Kilowatt, Revolution, Gallery, or Fever Case.', 'Different contents; the standard weapon-case rarity profile remains the same.', [{ type: 'manual_cases', caseIds: ['crate-4880', 'crate-4904', 'crate-7003', 'crate-7007'], target: 1 }], reward(110, 1.5)), stage('variety', 'Complete the tour', 'Open five different eligible cases.', 'Variety makes the hunt interesting without changing a single roll.', [{ type: 'manual_cases', target: 5 }], { ...reward(160, 2), decoration: 'Case Chronicle Display' })] },
  { id: 'story-gilded-circle', name: 'The Gilded Circle', description: 'Anton recognizes difficult lifetime opening records.', issuerId: 'anton-gild', category: 'story', scope: 'lifetime', minimumLevel: 20, optional: true, prerequisiteQuestIds: ['story-curators-path'], stages: [stage('twenty-five', 'A serious archive', 'Reach 25 unique finish discoveries.', 'Breadth first. Price tags can wait.', [{ type: 'discoveries', target: 25 }], reward(240, 1)), stage('covert-record', 'A red journal entry', 'Record a genuine Covert opening.', 'A market purchase is not an opening record. Bring me the real entry.', [{ type: 'journal_entries', rarity: Rarity.Covert, target: 1 }], reward(320, 1.5)), stage('gold-record', 'A golden record', 'Record a genuine Rare Special opening.', 'Optional, difficult, and never guaranteed.', [{ type: 'journal_entries', rarity: Rarity.SpecialItem, target: 1 }], { ...reward(500, 2), title: 'Gilded Circle', decoration: 'Golden Journal Stand' })] },

  { id: 'hunt-sidearm-sampler', name: 'Sidearm Sampler', description: 'Discover a spread of pistol finishes.', issuerId: 'mara-voss', category: 'collection', scope: 'lifetime', stages: [stage('pistols', 'Five sidearms', 'Discover five pistol-family finishes.', 'Small weapons, big variety.', [{ type: 'discover_weapon', weapon: 'Pistol', target: 5 }], reward(100, 1))] },
  { id: 'hunt-rifle-rack', name: 'Rifle Rack', description: 'Build a recognizable rifle display.', issuerId: 'eli-mercer', category: 'collection', scope: 'lifetime', minimumLevel: 4, stages: [stage('rifles', 'Six rifles', 'Discover six rifle finishes.', 'A rack should show more than one platform.', [{ type: 'discover_weapon', weapon: 'Rifle', target: 6 }], reward(130, 1.5))] },
  { id: 'hunt-smg-circuit', name: 'SMG Circuit', description: 'Collect compact weapons from across the catalog.', issuerId: 'finn-blaze', category: 'collection', scope: 'lifetime', stages: [stage('smgs', 'Six SMGs', 'Discover six SMG finishes.', 'Fast cases, compact collection.', [{ type: 'discover_weapon', weapon: 'SMG', target: 6 }], reward(120, 1))] },
  { id: 'hunt-shotgun-row', name: 'Shotgun Row', description: 'Find four shotgun finishes.', issuerId: 'mara-voss', category: 'collection', scope: 'lifetime', stages: [stage('shotguns', 'Four shotguns', 'Discover four shotgun finishes.', 'The overlooked shelf has character.', [{ type: 'discover_weapon', weapon: 'Shotgun', target: 4 }], reward(100, 1))] },
  { id: 'hunt-sniper-ledger', name: 'Sniper Ledger', description: 'Record four sniper finishes.', issuerId: 'eli-mercer', category: 'collection', scope: 'lifetime', minimumLevel: 5, stages: [stage('snipers', 'Four snipers', 'Discover four sniper finishes.', 'Precision deserves its own ledger.', [{ type: 'discover_weapon', weapon: 'Sniper', target: 4 }], reward(125, 1))] },
  { id: 'hunt-factory-file', name: 'Factory File', description: 'Find distinct Factory New variants.', issuerId: 'iris-vale', category: 'collection', scope: 'lifetime', minimumLevel: 6, stages: [stage('factory', 'Factory New records', 'Record five Factory New wear discoveries.', 'Only skins whose float ranges allow Factory New can count.', [{ type: 'wear_discoveries', wear: WearCondition.FactoryNew, target: 5 }], reward(150, 1.5))] },
  { id: 'hunt-field-tested', name: 'Field-Tested Stories', description: 'Record useful mid-wear variants.', issuerId: 'mara-voss', category: 'collection', scope: 'lifetime', stages: [stage('field', 'Field-Tested records', 'Record seven Field-Tested wear discoveries.', 'Wear is identity, not failure.', [{ type: 'wear_discoveries', wear: WearCondition.FieldTested, target: 7 }], reward(125, 1))] },
  { id: 'hunt-wear-spectrum', name: 'Wear Spectrum', description: 'Find a broad range of valid condition variants.', issuerId: 'iris-vale', category: 'collection', scope: 'lifetime', minimumLevel: 10, stages: [stage('spectrum', 'Twenty wear records', 'Record twenty valid wear discoveries.', 'Impossible condition intersections are never included.', [{ type: 'wear_discoveries', target: 20 }], reward(220, 2))] },
  { id: 'hunt-pink-dossier', name: 'Pink Dossier', description: 'Discover three Classified finishes.', issuerId: 'eli-mercer', category: 'collection', scope: 'lifetime', minimumLevel: 8, stages: [stage('pink', 'Three Classifieds', 'Discover three unique Classified finishes.', 'Distinct finishes only—duplicates do not pad the dossier.', [{ type: 'discover_rarity', rarity: Rarity.Classified, target: 3 }], reward(210, 1.5))] },
  { id: 'hunt-red-archive', name: 'Red Archive', description: 'Record two genuine Covert discoveries.', issuerId: 'anton-gild', category: 'collection', scope: 'lifetime', minimumLevel: 15, optional: true, stages: [stage('reds', 'Two Coverts', 'Discover two unique Covert finishes.', 'Difficult, optional, and based on real discoveries.', [{ type: 'discover_rarity', rarity: Rarity.Covert, target: 2 }], reward(320, 2))] },
  { id: 'hunt-pattern-echoes', name: 'Pattern Echoes', description: 'Preserve three notable Pattern journal entries.', issuerId: 'iris-vale', category: 'collection', scope: 'lifetime', minimumLevel: 14, optional: true, stages: [stage('patterns', 'Three notable Patterns', 'Record three notable opening entries.', 'Classification remains finish-specific and evidence-labeled.', [{ type: 'journal_entries', target: 3 }], reward(280, 2))] },
  { id: 'hunt-run-mosaic', name: 'Current Run Mosaic', description: 'Build a ten-finish collection after the latest Prestige.', issuerId: 'rook-vega', category: 'collection', scope: 'currentRun', minimumLevel: 10, stages: [stage('mosaic', 'Ten this run', 'Reach ten Current Run discoveries.', 'All Time remains permanent; this board measures the current chapter.', [{ type: 'discoveries', target: 10 }], reward(200, 1.5))] },

  { id: 'opening-three-case-tour', name: 'Three-Case Tour', description: 'Open three different case types.', issuerId: 'finn-blaze', category: 'opening', scope: 'lifetime', stages: [stage('tour', 'Three case types', 'Open three different cases manually.', 'Different contents, same fair selection contract.', [{ type: 'manual_cases', target: 3 }], reward(110, 1.5))] },
  { id: 'opening-session-rhythm', name: 'Session Rhythm', description: 'Finish five distinct manual opening sessions.', issuerId: 'finn-blaze', category: 'opening', scope: 'currentRun', stages: [stage('sessions', 'Five sessions', 'Finish five distinct manual opening sessions.', 'One callback cannot count twice.', [{ type: 'manual_sessions', target: 5 }], reward(120, 1.5))] },
  { id: 'opening-kilowatt-study', name: 'Kilowatt Study', description: 'Inspect rewards from the Kilowatt Case.', issuerId: 'iris-vale', category: 'opening', scope: 'lifetime', relatedCaseIds: ['crate-4904'], stages: [stage('kilowatt', 'Open five Kilowatt Cases', 'Open five Kilowatt Cases manually.', 'We are studying contents, not improving odds.', [{ type: 'manual_cases', caseIds: ['crate-4904'], target: 5 }], reward(160, 2))] },
  { id: 'opening-revolution-record', name: 'Revolution Record', description: 'Build a small Revolution Case sample.', issuerId: 'dr-kade', category: 'opening', scope: 'lifetime', relatedCaseIds: ['crate-4880'], stages: [stage('revolution', 'Open five Revolution Cases', 'Open five Revolution Cases manually.', 'Five results are records, not proof of a different probability.', [{ type: 'manual_cases', caseIds: ['crate-4880'], target: 5 }], reward(160, 2))] },
  { id: 'opening-value-record', name: 'Personal Value Record', description: 'Create five notable entries and inspect the best.', issuerId: 'eli-mercer', category: 'opening', scope: 'lifetime', minimumLevel: 8, stages: [stage('entries', 'Five journal entries', 'Record five notable openings.', 'The journal stores value at discovery without rewriting history later.', [{ type: 'journal_entries', target: 5 }], reward(180, 1.5))] },
  { id: 'opening-covert-watch', name: 'Covert Watch', description: 'Record one genuine Covert opening.', issuerId: 'anton-gild', category: 'opening', scope: 'lifetime', minimumLevel: 12, optional: true, stages: [stage('covert', 'A genuine red', 'Record one Covert opening.', 'Market acquisitions do not count.', [{ type: 'journal_entries', rarity: Rarity.Covert, target: 1 }], reward(260, 2))] },
  { id: 'opening-gold-watch', name: 'Gold Watch', description: 'An optional lifetime hunt for a Rare Special opening.', issuerId: 'anton-gild', category: 'opening', scope: 'lifetime', minimumLevel: 20, optional: true, stages: [stage('gold', 'A genuine Gold', 'Record one Rare Special opening.', 'There is no pity mechanic and no deadline.', [{ type: 'journal_entries', rarity: Rarity.SpecialItem, target: 1 }], { ...reward(450, 2), title: 'Gold Witness' })] },
  { id: 'opening-batch-discipline', name: 'Batch Discipline', description: 'Use several manual sessions rather than one giant click.', issuerId: 'dr-kade', category: 'opening', scope: 'currentRun', minimumLevel: 5, stages: [stage('discipline', 'Ten cases, three sessions', 'Open ten cases across at least three sessions.', 'The session identity is exact-once, even if the UI rerenders.', [{ type: 'manual_cases', target: 10 }, { type: 'manual_sessions', target: 3 }], reward(150, 1.5))] },

  { id: 'contract-maras-sidearm', name: 'Mara’s Sidearm Request', description: 'Deliver one eligible common sidearm from inventory.', issuerId: 'mara-voss', category: 'contract', scope: 'lifetime', prerequisiteQuestIds: ['story-first-crack'], stages: [stage('deliver', 'Deliver a sidearm', 'Transfer one unlocked Mil-Spec or lower sidearm.', 'This is ownership-based: the exact item leaves your inventory once.', [{ type: 'deliver_item', target: 1, weapon: 'Pistol' }], reward(100, 1.5, 2, 2))] },
  { id: 'contract-mercers-rifle', name: 'Mercer’s Rifle Request', description: 'Deliver a rifle for Eli’s study shelf.', issuerId: 'eli-mercer', category: 'contract', scope: 'lifetime', minimumLevel: 6, stages: [stage('deliver', 'Deliver a rifle', 'Transfer one unlocked rifle worth at least $0.10.', 'Favorites, locked items, and Trophy Room items are protected.', [{ type: 'deliver_item', target: 1, weapon: 'Rifle', minimumValue: .1 }], reward(140, 1.5, 3, 2))] },
  { id: 'contract-iris-sample', name: 'Iris’s Pattern Sample', description: 'Deliver an eligible item for non-destructive metadata study.', issuerId: 'iris-vale', category: 'contract', scope: 'lifetime', minimumLevel: 12, stages: [stage('own', 'Find a sample', 'Own one Classified-or-better item.', 'Ownership is checked live; a prior discovery alone is not enough.', [{ type: 'own_items', target: 1, rarity: Rarity.Classified }], reward(90, .5)), stage('deliver', 'Transfer the sample', 'Deliver the exact unlocked sample.', 'The delivered instance cannot satisfy another NPC request.', [{ type: 'deliver_item', target: 1, rarity: Rarity.Classified }], reward(220, 2, 4, 3))] },
  { id: 'contract-kades-results', name: 'Kade’s Result Set', description: 'Complete contracts and report the outcomes.', issuerId: 'dr-kade', category: 'contract', scope: 'currentRun', minimumLevel: 9, stages: [stage('contracts', 'Three outcomes', 'Complete three trade-ups.', 'Only completed contracts count.', [{ type: 'trade_ups', target: 3 }], reward(160, 1)), stage('reputation', 'Research standing', 'Reach five reputation with Dr. Kade.', 'Reputation comes from his actual stages, not timer ticks.', [{ type: 'npc_reputation', npcId: 'dr-kade', target: 5 }], reward(180, 1.5))] },
  { id: 'contract-sanas-ledger', name: 'Sana’s Settled Ledger', description: 'Settle three legitimate player listings.', issuerId: 'sana-bell', category: 'contract', scope: 'currentRun', minimumLevel: 8, stages: [stage('sales', 'Three settled sales', 'Complete three CSWEAR player sales.', 'Cancellation and relisting never count.', [{ type: 'market_sales', target: 3 }], reward(180, .5, 5, 3))] },

  { id: 'weekly-case-rotation', name: 'Weekly Case Rotation', description: 'A modest weekly opening side quest.', issuerId: 'finn-blaze', category: 'repeatable', scope: 'lifetime', repeatable: 'weekly', stages: [stage('weekly', 'Open six cases this week', 'Open six cases manually during the current quest week.', 'The period is monotonic; changing the clock backward cannot restore a claim.', [{ type: 'weekly_manual_cases', target: 6 }], reward(80, 1.5, 0, 1))] },
  { id: 'weekly-active-shift', name: 'Weekly Active Shift', description: 'Mix Work and opening instead of waiting passively.', issuerId: 'mara-voss', category: 'repeatable', scope: 'lifetime', repeatable: 'weekly', stages: [stage('weekly', 'Work and open', 'Complete two Work jobs and open three cases this week.', 'Both activities use their authoritative completion records.', [{ type: 'weekly_work_jobs', target: 2 }, { type: 'weekly_manual_cases', target: 3 }], reward(90, 1, 2, 1))] },
  { id: 'weekly-broker-notes', name: 'Weekly Broker Notes', description: 'Settle a sale or make new discoveries this week.', issuerId: 'sana-bell', category: 'repeatable', scope: 'lifetime', repeatable: 'weekly', minimumLevel: 6, stages: [stage('weekly', 'Market and collection', 'Complete one market sale and record two new discoveries this week.', 'Only settled sales and new collection entries count.', [{ type: 'weekly_market_sales', target: 1 }, { type: 'weekly_discoveries', target: 2 }], reward(110, .5, 3, 1))] },
]

// Keep IDs, stage IDs and rewards stable so older saves retain claims and completion.
// The issuer field is historical metadata only; no new character progression uses it.
const standaloneQuestCopy: Record<string, { name?: string; description?: string }> = {
  'story-first-crack': { description: 'Open cases and start a permanent discovery record.' },
  'story-curators-path': { description: 'Discover skins across weapon families and rarity tiers.' },
  'story-rooks-race': { name: 'Current Run Discovery Challenge', description: 'Open in separate sessions and build your Current Run collection.' },
  'story-pattern-language': { description: 'Record real openings and discover how Patterns are classified.' },
  'story-contract-science': { description: 'Complete genuine Trade-Ups and study the results.' },
  'story-broker-code': { description: 'Complete settled CSWEAR sales and build a trading record.' },
  'story-case-chronicle': { description: 'Open different official weapon cases.' },
  'story-gilded-circle': { description: 'Build difficult lifetime opening records at your own pace.' },
  'contract-maras-sidearm': { name: 'Sidearm Delivery', description: 'Deliver one eligible sidearm from Inventory.' },
  'contract-mercers-rifle': { name: 'Rifle Delivery', description: 'Deliver one eligible rifle from Inventory.' },
  'contract-iris-sample': { name: 'Classified Sample', description: 'Own, then deliver an eligible Classified-or-better item.' },
  'contract-kades-results': { name: 'Trade-Up Result Set', description: 'Complete and record five genuine Trade-Ups.' },
  'contract-sanas-ledger': { name: 'Settled Sales Ledger', description: 'Complete three genuine CSWEAR player sales.' },
}

export const QUEST_DEFINITIONS: QuestDefinition[] = legacyQuestDefinitions.map((quest) => ({
  ...quest,
  ...standaloneQuestCopy[quest.id],
  stages: quest.stages.map((entry) => {
    if (quest.id === 'story-curators-path' && entry.id === 'rifles') return { ...entry, description: 'Discover one AK-47 skin and one M4 skin.' }
    if (quest.id === 'story-case-chronicle' && entry.id === 'variety') return { ...entry, requirements: [{ type: 'distinct_cases', target: 5 }] }
    if (quest.id === 'story-rooks-race' && entry.id === 'meet-rook') return { ...entry, title: 'Open in three sessions' }
    if (quest.id === 'story-rooks-race' && entry.id === 'race-five') return { ...entry, title: 'Five discoveries this run', description: 'Record five different Current Run skins.', requirements: [{ type: 'discoveries', target: 5 }] }
    if (quest.id === 'story-rooks-race' && entry.id === 'race-twelve') return { ...entry, title: 'Twelve discoveries this run', description: 'Record twelve different Current Run skins.', requirements: [{ type: 'discoveries', target: 12 }], reward: { ...entry.reward, title: 'Run Collector' } }
    if (quest.id === 'contract-maras-sidearm' && entry.id === 'deliver') return { ...entry, description: 'Deliver one eligible unlocked sidearm from Inventory.' }
    if (quest.id === 'contract-kades-results' && entry.id === 'reputation') return { ...entry, title: 'Five completed contracts', description: 'Complete five Trade-Ups in total.', requirements: [{ type: 'trade_ups', target: 5 }] }
    if (quest.id === 'contract-iris-sample' && entry.id === 'deliver') return { ...entry, description: 'Deliver one eligible unlocked item; it leaves Inventory once.' }
    if (quest.id === 'story-first-crack' && entry.id === 'wear-study') return { ...entry, reward: { ...entry.reward, title: 'First Shelf' } }
    if (quest.id === 'story-broker-code' && entry.id === 'five-sales') return { ...entry, reward: { ...entry.reward, title: 'Trusted Broker' } }
    return entry
  }),
}))

export const questsById = new Map(QUEST_DEFINITIONS.map((quest) => [quest.id, quest]))
export const questNpcsById = new Map(QUEST_NPCS.map((npc) => [npc.id, npc]))

function createNpcState(): QuestNpcState {
  return { history: [], reputation: 0, rivalScore: 0, seenDialogueIds: [] }
}

function getPeriod(now: number) {
  return Math.max(0, Math.floor(now / WEEK_MS))
}

export function createDefaultQuestSystem(now = Date.now()): QuestSystemState {
  return {
    schemaVersion: QUEST_SCHEMA_VERSION,
    activity: { caseOpenCounts: {}, manualCases: 0, manualSessions: 0, recentSessionIds: [], runCaseOpenCounts: {}, runManualCases: 0, runManualSessions: 0, weeklyDiscoveries: 0, weeklyManualCases: 0, weeklyMarketSales: 0, weeklyWorkJobs: 0 },
    cosmetics: { decorations: [], titles: [] },
    currentPeriod: getPeriod(now),
    npc: Object.fromEntries(QUEST_NPCS.map((npc) => [npc.id, createNpcState()])),
    processedRequestIds: [],
    progress: {},
    trackedQuestIds: ['story-first-crack'],
  }
}

function safeInt(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function strings(value: unknown, limit = 600) {
  return Array.isArray(value) ? Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string'))).slice(-limit) : []
}

export function normalizeQuestSystem(value: unknown, now = Date.now()): QuestSystemState {
  const fallback = createDefaultQuestSystem(now)
  if (!value || typeof value !== 'object') return fallback
  const source = value as Partial<QuestSystemState>
  const activity = source.activity && typeof source.activity === 'object' ? source.activity : fallback.activity
  const progressSource = source.progress && typeof source.progress === 'object' ? source.progress : {}
  const progress = Object.fromEntries(Object.entries(progressSource).flatMap(([id, entry]) => {
    if (!questsById.has(id) || !entry || typeof entry !== 'object') return []
    const candidate = entry as Partial<QuestProgressState>
    return [[id, { stageIndex: safeInt(candidate.stageIndex), claimedStageIds: strings(candidate.claimedStageIds, 64), deliveredStageIds: strings(candidate.deliveredStageIds, 64), completedAt: typeof candidate.completedAt === 'number' && Number.isFinite(candidate.completedAt) ? candidate.completedAt : undefined, instancePeriod: typeof candidate.instancePeriod === 'number' && Number.isFinite(candidate.instancePeriod) ? Math.floor(candidate.instancePeriod) : undefined }]]
  }))
  const npcSource = source.npc && typeof source.npc === 'object' ? source.npc : {}
  const npc = Object.fromEntries(QUEST_NPCS.map((definition) => {
    const entry = npcSource[definition.id]
    const record = entry && typeof entry === 'object' ? entry as Partial<QuestNpcState> : createNpcState()
    return [definition.id, { reputation: safeInt(record.reputation), rivalScore: safeInt(record.rivalScore), seenDialogueIds: strings(record.seenDialogueIds, 160), history: Array.isArray(record.history) ? record.history.filter((item): item is QuestNpcState['history'][number] => Boolean(item && typeof item.id === 'string' && typeof item.message === 'string' && typeof item.timestamp === 'number')).slice(-QUEST_HISTORY_LIMIT) : [] }]
  }))
  const normalized: QuestSystemState = {
    schemaVersion: QUEST_SCHEMA_VERSION,
    activity: {
      caseOpenCounts: activity.caseOpenCounts && typeof activity.caseOpenCounts === 'object' ? Object.fromEntries(Object.entries(activity.caseOpenCounts).map(([id, count]) => [id, safeInt(count)])) : {},
      manualCases: safeInt(activity.manualCases), manualSessions: safeInt(activity.manualSessions), recentSessionIds: strings(activity.recentSessionIds, QUEST_SESSION_ID_LIMIT),
      runCaseOpenCounts: activity.runCaseOpenCounts && typeof activity.runCaseOpenCounts === 'object' ? Object.fromEntries(Object.entries(activity.runCaseOpenCounts).map(([id, count]) => [id, safeInt(count)])) : {},
      runManualCases: safeInt(activity.runManualCases), runManualSessions: safeInt(activity.runManualSessions), weeklyDiscoveries: safeInt(activity.weeklyDiscoveries), weeklyManualCases: safeInt(activity.weeklyManualCases), weeklyMarketSales: safeInt(activity.weeklyMarketSales), weeklyWorkJobs: safeInt(activity.weeklyWorkJobs),
    },
    cosmetics: { decorations: strings(source.cosmetics?.decorations, 80), titles: strings(source.cosmetics?.titles, 80) },
    currentPeriod: safeInt(source.currentPeriod),
    npc,
    processedRequestIds: strings(source.processedRequestIds, QUEST_REQUEST_LIMIT),
    progress,
    trackedQuestIds: strings(source.trackedQuestIds, MAX_TRACKED_QUESTS).filter((id) => questsById.has(id)),
  }
  return syncQuestSystemTime(normalized, now)
}

export function syncQuestSystemTime(state: QuestSystemState, now: number) {
  const period = getPeriod(now)
  if (period <= state.currentPeriod) return state
  const progress = { ...state.progress }
  for (const quest of QUEST_DEFINITIONS) if (quest.repeatable) delete progress[quest.id]
  return { ...state, currentPeriod: period, progress, activity: { ...state.activity, weeklyDiscoveries: 0, weeklyManualCases: 0, weeklyMarketSales: 0, weeklyWorkJobs: 0 } }
}

function questProgress(state: GameState, definition: QuestDefinition) {
  const stored = state.quests.progress[definition.id]
  if (definition.repeatable && stored?.instancePeriod !== state.quests.currentPeriod) return { stageIndex: 0, claimedStageIds: [], deliveredStageIds: [], instancePeriod: state.quests.currentPeriod } satisfies QuestProgressState
  return stored ?? { stageIndex: 0, claimedStageIds: [], deliveredStageIds: [], instancePeriod: definition.repeatable ? state.quests.currentPeriod : undefined }
}

function collectionFor(state: GameState, scope: QuestScope) {
  return scope === 'currentRun' ? state.currentRunCollectionBook : state.collectionBook
}

function weaponMatches(actual: string, requested: string) {
  const value = actual.toLowerCase()
  const query = requested.toLowerCase()
  if (query === 'pistol') return ['glock', 'usp', 'p2000', 'p250', 'five-seven', 'tec-9', 'cz75', 'dual berettas', 'desert eagle', 'r8'].some((part) => value.includes(part))
  if (query === 'rifle') return ['ak-47', 'm4a', 'famas', 'galil', 'aug', 'sg 553'].some((part) => value.includes(part))
  if (query === 'smg') return ['mp9', 'mac-10', 'mp7', 'mp5', 'ump', 'p90', 'pp-bizon'].some((part) => value.includes(part))
  if (query === 'shotgun') return ['nova', 'xm1014', 'mag-7', 'sawed-off'].some((part) => value.includes(part))
  if (query === 'sniper') return ['awp', 'ssg 08', 'scar-20', 'g3sg1'].some((part) => value.includes(part))
  if (query === 'm4') return value.includes('m4a')
  return value.includes(query)
}

function rarityAtLeast(actual: Rarity, requested: Rarity) {
  const order = [Rarity.Consumer, Rarity.Industrial, Rarity.MilSpec, Rarity.Restricted, Rarity.Classified, Rarity.Covert, Rarity.SpecialItem, Rarity.Contraband]
  return order.indexOf(actual) >= order.indexOf(requested)
}

export function isQuestItemEligible(item: SkinInstance, requirement: Extract<QuestRequirement, { type: 'deliver_item' | 'own_items' }>) {
  return (!requirement.weapon || weaponMatches(item.weapon, requirement.weapon)) && (!requirement.rarity || rarityAtLeast(item.rarity, requirement.rarity)) && (!requirement.wear || item.wear === requirement.wear) && item.marketValue >= (requirement.minimumValue ?? 0)
}

function requirementProgress(state: GameState, definition: QuestDefinition, requirement: QuestRequirement, stageId: string): QuestRequirementProgress {
  const activity = state.quests.activity
  const scopedCases = definition.scope === 'currentRun' ? activity.runCaseOpenCounts : activity.caseOpenCounts
  const scopedManualCases = definition.scope === 'currentRun' ? activity.runManualCases : activity.manualCases
  const scopedSessions = definition.scope === 'currentRun' ? activity.runManualSessions : activity.manualSessions
  const collection = collectionFor(state, definition.scope)
  const progress = questProgress(state, definition)
  const target = requirement.target
  switch (requirement.type) {
    case 'manual_cases': {
      const current = requirement.caseIds ? requirement.caseIds.reduce((sum, id) => sum + (scopedCases[id] ?? 0), 0) : requirement.target <= 5 && definition.id.includes('tour') ? Object.values(scopedCases).filter((count) => count > 0).length : scopedManualCases
      return { current, target, label: requirement.caseIds ? 'Eligible cases opened' : definition.id.includes('tour') ? 'Different cases opened' : 'Manual cases opened' }
    }
    case 'manual_sessions': return { current: scopedSessions, target, label: 'Distinct opening sessions' }
    case 'distinct_cases': return { current: Object.values(scopedCases).filter((count) => count > 0).length, target, label: 'Different case types opened' }
    case 'discoveries': return { current: collection.length, target, label: definition.scope === 'currentRun' ? 'Current Run discoveries' : 'Unique discoveries' }
    case 'discover_weapon': return { current: collection.filter((entry) => { const skin = skinsById.get(entry.skinId); return skin ? weaponMatches(skin.weapon, requirement.weapon) : false }).length, target, label: `${requirement.weapon} discoveries` }
    case 'discover_rarity': return { current: collection.filter((entry) => skinsById.get(entry.skinId)?.rarity === requirement.rarity).length, target, label: `${requirement.rarity} discoveries` }
    case 'wear_discoveries': return { current: collection.reduce((sum, entry) => sum + (requirement.wear ? Number(entry.foundWearConditions.includes(requirement.wear)) : entry.foundWearConditions.length), 0), target, label: requirement.wear ? `${requirement.wear} discoveries` : 'Wear discoveries' }
    case 'own_items': return { current: state.inventory.filter((item) => isQuestItemEligible(item, requirement)).length, target, label: 'Eligible items owned' }
    case 'trade_ups': return { current: state.statistics.tradeUpsCompleted, target, label: 'Trade-ups completed' }
    case 'market_sales': return { current: state.statistics.marketSales, target, label: 'Settled player sales' }
    case 'work_jobs': return { current: state.statistics.workJobsCompleted, target, label: 'Work jobs completed' }
    case 'career_level': return { current: getCareerLevelFromXp(state.career.currentRunXp), target, label: 'Career level' }
    case 'journal_entries': return { current: state.dropJournal.entries.filter((entry) => (!requirement.rarity || rarityAtLeast(entry.rarity, requirement.rarity)) && (!requirement.exceptionalPattern || entry.pattern?.tier === 'exceptional' || entry.pattern?.tier === 'iconic')).length, target, label: requirement.exceptionalPattern ? 'Exceptional Pattern entries' : requirement.rarity ? `${requirement.rarity}-or-better journal entries` : 'Notable journal entries' }
    case 'deliver_item': return { current: progress.deliveredStageIds.includes(stageId) ? 1 : 0, target: 1, label: 'Exact item delivered' }
    case 'npc_reputation': return { current: state.quests.npc[requirement.npcId]?.reputation ?? 0, target, label: 'NPC reputation' }
    case 'rival_discoveries': { const discoveries = state.currentRunCollectionBook.length; return { current: discoveries > (state.quests.npc['rook-vega']?.rivalScore ?? 0) ? discoveries : 0, target, label: `Discoveries ahead of Rook (${state.quests.npc['rook-vega']?.rivalScore ?? 0})` } }
    case 'weekly_manual_cases': return { current: activity.weeklyManualCases, target, label: 'Cases opened this week' }
    case 'weekly_work_jobs': return { current: activity.weeklyWorkJobs, target, label: 'Work jobs this week' }
    case 'weekly_market_sales': return { current: activity.weeklyMarketSales, target, label: 'Settled sales this week' }
    case 'weekly_discoveries': return { current: activity.weeklyDiscoveries, target, label: 'New discoveries this week' }
  }
}

export function getQuestStageStatus(state: GameState, definition: QuestDefinition): QuestStageStatus {
  const progress = questProgress(state, definition)
  const stageDefinition = definition.stages[Math.min(progress.stageIndex, definition.stages.length - 1)]
  if (!stageDefinition || progress.completedAt) return { complete: Boolean(progress.completedAt), requirements: [] }
  const requirements = stageDefinition.requirements.map((requirement) => requirementProgress(state, definition, requirement, stageDefinition.id))
  return { complete: requirements.every((entry) => entry.current >= entry.target), requirements }
}

export function getQuestProgressState(state: GameState, definition: QuestDefinition) {
  return questProgress(state, definition)
}

export function isQuestUnlocked(state: GameState, definition: QuestDefinition) {
  if (getCareerLevelFromXp(state.career.currentRunXp) < (definition.minimumLevel ?? 1)) return false
  return (definition.prerequisiteQuestIds ?? []).every((id) => state.quests.progress[id]?.completedAt)
}

export function recordQuestActivity(before: GameState, after: GameState, action: GameAction, now: number): QuestSystemState {
  const opened = Math.max(0, after.statistics.casesOpened - before.statistics.casesOpened)
  const discoveries = Math.max(0, after.collectionBook.length - before.collectionBook.length)
  const work = Math.max(0, after.statistics.workJobsCompleted - before.statistics.workJobsCompleted)
  const sales = Math.max(0, after.statistics.marketSales - before.statistics.marketSales)
  if (opened === 0 && discoveries === 0 && work === 0 && sales === 0) return after.quests
  const quests = syncQuestSystemTime(after.quests, now)
  const activity = { ...quests.activity, caseOpenCounts: { ...quests.activity.caseOpenCounts }, runCaseOpenCounts: { ...quests.activity.runCaseOpenCounts } }
  if (action.type === 'OPEN_CASE' && opened > 0) {
    activity.manualCases += opened; activity.runManualCases += opened; activity.weeklyManualCases += opened
    activity.caseOpenCounts[action.payload.caseId] = (activity.caseOpenCounts[action.payload.caseId] ?? 0) + opened
    activity.runCaseOpenCounts[action.payload.caseId] = (activity.runCaseOpenCounts[action.payload.caseId] ?? 0) + opened
    const sessionId = action.payload.openingEventId
    if (sessionId && !activity.recentSessionIds.includes(sessionId)) {
      activity.manualSessions += 1; activity.runManualSessions += 1
      activity.recentSessionIds = [...activity.recentSessionIds, sessionId].slice(-QUEST_SESSION_ID_LIMIT)
    }
  }
  activity.weeklyDiscoveries += discoveries
  activity.weeklyWorkJobs += work
  activity.weeklyMarketSales += sales
  return { ...quests, activity }
}

export function resetQuestsForPrestige(state: QuestSystemState, now: number): QuestSystemState {
  const progress = Object.fromEntries(Object.entries(state.progress).filter(([id]) => questsById.get(id)?.scope === 'lifetime'))
  return { ...syncQuestSystemTime(state, now), progress, trackedQuestIds: state.trackedQuestIds.filter((id) => questsById.get(id)?.scope === 'lifetime'), activity: { ...state.activity, runCaseOpenCounts: {}, runManualCases: 0, runManualSessions: 0 } }
}

export function getEligibleDeliveryItems(state: GameState, definition: QuestDefinition) {
  const progress = questProgress(state, definition)
  const activeStage = definition.stages[progress.stageIndex]
  const requirement = activeStage?.requirements.find((entry): entry is Extract<QuestRequirement, { type: 'deliver_item' }> => entry.type === 'deliver_item')
  if (!requirement) return []
  const trophyIds = new Set(Object.values(state.trophyAssignments).flatMap((assignment) => assignment ? [assignment.itemId] : []))
  return state.inventory.filter((item) => !item.isLocked && !item.isFavorited && !trophyIds.has(item.instanceId) && isQuestItemEligible(item, requirement))
}

export function getQuestCatalogCounts() {
  return Object.fromEntries(['story', 'collection', 'opening', 'contract', 'repeatable'].map((category) => [category, QUEST_DEFINITIONS.filter((quest) => quest.category === category).length])) as Record<QuestCategory, number>
}
