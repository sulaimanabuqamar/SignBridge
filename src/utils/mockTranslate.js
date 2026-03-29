const STOP = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'am',
  'can',
  'you',
  'me',
  'my',
  'i',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'to',
  'for',
  'of',
  'in',
  'on',
  'at',
  'that',
  'this',
  'it',
  'and',
  'or',
  'but',
  'please',
  'what',
  'when',
  'where',
  'how',
])

const TIME_WORDS = ['tomorrow', 'today', 'yesterday', 'now', 'later', 'tonight']

/**
 * Normalize whitespace for mock translation.
 */
export function simplifyText(input) {
  return String(input || '')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Deterministic ASL-style gloss: time-first, then content words, uppercase.
 */
export function toSignGloss(text) {
  const cleaned = simplifyText(text)
    .toLowerCase()
    .replace(/[?!.,;:]/g, '')
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  const content = tokens.filter((t) => !STOP.has(t))
  const time = content.filter((t) => TIME_WORDS.includes(t))
  const rest = content.filter((t) => !TIME_WORDS.includes(t))
  const ordered = [...time, ...rest]
  if (ordered.length === 0) {
    return tokens
      .filter((t) => !STOP.has(t))
      .map((w) => w.toUpperCase())
      .join(' ')
      .trim() || cleaned.toUpperCase()
  }
  return ordered.map((w) => w.toUpperCase()).join(' ')
}

