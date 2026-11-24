export interface GlossaryEntry {
  label: string
  short: string
  detail: string
}

export const GLOSSARY = {
  float: { label: 'Float', short: 'How worn a skin is. Usually, lower means cleaner.', detail: 'Each skin has a valid float range. Float determines its wear condition and can affect its estimated value.' },
  pattern: { label: 'Pattern / Paint Seed', short: 'A number that changes how a skin’s finish is arranged.', detail: 'A few finishes have desirable, verified patterns. Most paint seeds do not add a premium.' },
  stattrak: { label: 'StatTrak', short: 'A special skin edition that tracks kills in Counter-Strike.', detail: 'Items in this simulator do not connect to your real CS2 statistics. StatTrak and ordinary skins have different trade-up compatibility.' },
  rarity: { label: 'Rarity', short: 'The color tier that shows how uncommon a skin is.', detail: 'Rarity affects case odds and which items can enter the same trade-up contract.' },
  tradeup: { label: 'Trade-Up', short: 'Exchange eligible skins for one random higher-rarity skin.', detail: 'Most contracts consume 10 compatible inputs. Eligible Covert contracts use 5. The result and its value are not guaranteed.' },
  ev: { label: 'Expected Value (EV)', short: 'The average value across many similar openings or contracts.', detail: 'Multiply each possible outcome value by its probability, then add the results. One opening can differ greatly from the average.' },
  roi: { label: 'ROI', short: 'Expected value back compared with what you put in.', detail: 'Expected ROI = (expected output value − input cost) ÷ input cost × 100%. A positive estimate does not guarantee profit.' },
  escrow: { label: 'Escrow', short: 'A skin temporarily held while listed for sale.', detail: 'You cannot use the listed item until the listing sells, expires, or is cancelled.' },
  prestige: { label: 'Prestige', short: 'Reset your current Career chapter to earn limited permanent advantages.', detail: 'Review the eligibility, reset list, and Legacy Vault before confirming. Lifetime records and selected exact Vault items are preserved.' },
  openingFunds: { label: 'Case Opening Funds', short: 'Extra money that helps pay for case openings. It cannot buy skins or other items.', detail: 'Only cases costing at most $5 qualify. Funds cover at most 35% of each opening, capped at $1.25 per case. The balance is not wallet cash.' },
  milspec: { label: 'Mil-Spec', short: 'A blue rarity tier of weapon skin.', detail: 'It sits above Industrial Grade and below Restricted in the ordinary rarity order.' },
  restricted: { label: 'Restricted', short: 'A purple rarity tier of weapon skin.', detail: 'It sits above Mil-Spec and below Classified.' },
  classified: { label: 'Classified', short: 'A pink rarity tier of weapon skin.', detail: 'It sits above Restricted and below Covert.' },
  covert: { label: 'Covert', short: 'A red rarity tier of weapon skin.', detail: 'It is rarer than Classified. Eligible Covert trade-ups follow their own five-input rules.' },
  specialItem: { label: 'Special Item', short: 'An exceptionally rare case reward, such as a knife or gloves.', detail: 'Its odds and possible results depend on the case. A gold reveal is never guaranteed.' },
  wear: { label: 'Wear condition', short: 'A label for how worn a skin looks.', detail: 'Factory New is generally cleanest, followed by Minimal Wear, Field-Tested, Well-Worn, and Battle-Scarred. A skin may support only part of this range.' },
  marketValue: { label: 'Market value', short: 'An estimate of what a skin may be worth.', detail: 'This is not cash received. Actual sale proceeds can differ after prices, fees, and buyer acceptance.' },
  realizedProfit: { label: 'Realized profit', short: 'Money gained from a completed sale after its known acquisition cost.', detail: 'It uses actual settled proceeds and known cost basis. Unsold inventory gains are not realized profit.' },
  unrealizedValue: { label: 'Unrealized value', short: 'The estimated value of skins you still hold.', detail: 'Market estimates can change. This value is not spendable cash until an item is sold.' },
  costBasis: { label: 'Cost basis', short: 'The recorded amount spent to acquire an item.', detail: 'It helps calculate realized profit when the item is sold or an input is consumed.' },
  patternPremium: { label: 'Pattern premium', short: 'Extra estimated value for a verified desirable finish pattern.', detail: 'Most paint seeds have no special premium. Pattern classification depends on the weapon and finish.' },
  payroll: { label: 'Employee payroll', short: 'The wages paid to hired employees.', detail: 'Wages are an operating expense even when an employee does not make a profitable sale.' },
  operatingBudget: { label: 'Operating budget', short: 'Cash set aside for employee actions.', detail: 'Moving cash into a budget is a transfer, not income or profit. Employees still follow their level and safety limits.' },
  discovery: { label: 'Collection discovery', short: 'A skin you have found at least once.', detail: 'Discovery stays in your Collection Book after the item is sold. An ownership goal instead checks what you hold now.' },
  caseOdds: { label: 'Case odds', short: 'The chances of each rarity when opening a case.', detail: 'Each opening is independent. Earlier results do not improve the odds of the next case.' },
} satisfies Record<string, GlossaryEntry>

export type GlossaryKey = keyof typeof GLOSSARY
