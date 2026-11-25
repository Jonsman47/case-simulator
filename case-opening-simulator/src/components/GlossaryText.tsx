import { Fragment } from 'react'
import type { GlossaryKey } from '../data/glossary'
import { GlossaryTerm } from './GlossaryTerm'

export type GlossaryTextPart = string | { term: GlossaryKey; label?: string }

/** Explicitly marks only the concepts a screen is teaching; ordinary prose stays plain. */
export function GlossaryText({ parts }: { parts: GlossaryTextPart[] }) {
  return <>{parts.map((part, index) => typeof part === 'string' ? <Fragment key={index}>{part}</Fragment> : <GlossaryTerm key={`${part.term}:${index}`} label={part.label} term={part.term} />)}</>
}
