const STOP = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'am',
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
])

const TIME_WORDS = ['tomorrow', 'today', 'yesterday', 'now', 'later', 'tonight', 'morning', 'evening']
const QUESTION_WORDS = ['what', 'when', 'where', 'how', 'why']
const ACTION_WORDS = new Set([
  'help',
  'send',
  'give',
  'call',
  'tell',
  'show',
  'go',
  'bring',
  'need',
  'repeat',
  'wait',
  'start',
  'stop',
  'understand',
  'meet',
])
const OBJECT_WORDS = new Set([
  'report',
  'message',
  'task',
  'file',
  'document',
  'project',
  'water',
  'bathroom',
  'doctor',
  'meeting',
  'work',
])
const PRONOUN_MAP = {
  i: 'I',
  me: 'ME',
  my: 'MY',
  you: 'YOU',
  we: 'WE',
  us: 'US',
}

const PHRASE_RULES = [
  { test: /thank\s+you/, gloss: 'THANK-YOU' },
  { test: /please\s+repeat|repeat\s+that|say\s+that\s+again/, gloss: 'PLEASE REPEAT' },
  { test: /i\s+need\s+help|help\s+me/, gloss: 'HELP ME' },
  { test: /can\s+you\s+help\s+me/, gloss: 'YOU HELP ME' },
  { test: /one\s+moment|wait\s+a\s+moment/, gloss: 'WAIT ONE-MOMENT' },
  { test: /i\s+understand/, gloss: 'I UNDERSTAND' },
  { test: /where\s+is\s+the\s+bathroom|bathroom/, gloss: 'BATHROOM WHERE' },
  { test: /can\s+you\s+send\s+me\s+the\s+report\s+tomorrow/, gloss: 'TOMORROW REPORT SEND ME' },
  { test: /send\s+me\s+the\s+report/, gloss: 'REPORT SEND ME' },
  { test: /hello|hi/, gloss: 'HELLO' },
  { test: /^yes$/, gloss: 'YES' },
  { test: /^no$/, gloss: 'NO' },
]

/**
 * Normalize whitespace for mock translation.
 */
export function simplifyText(input) {
  return String(input || '')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Phrase-first ASL-style gloss: use curated mappings first, then a structured fallback.
 */
export function toSignGloss(text) {
  const cleaned = simplifyText(text)
    .toLowerCase()
    .replace(/[?!.,;:]/g, '')

  const direct = PHRASE_RULES.find((rule) => rule.test.test(cleaned))
  if (direct) return direct.gloss

  const tokens = cleaned.split(/\s+/).filter(Boolean)
  const time = tokens.filter((t) => TIME_WORDS.includes(t)).map((t) => t.toUpperCase())
  const questions = tokens.filter((t) => QUESTION_WORDS.includes(t)).map((t) => t.toUpperCase())
  const actions = tokens.filter((t) => ACTION_WORDS.has(t)).map((t) => t.toUpperCase())
  const objects = tokens.filter((t) => OBJECT_WORDS.has(t)).map((t) => t.toUpperCase())
  const pronouns = tokens
    .filter((t) => PRONOUN_MAP[t])
    .map((t) => PRONOUN_MAP[t])
  const courtesy = tokens.filter((t) => t === 'please').map(() => 'PLEASE')
  const fallbackContent = tokens
    .filter((t) => !STOP.has(t) && !TIME_WORDS.includes(t))
    .map((t) => t.toUpperCase())

  const ordered = dedupe([
    ...questions,
    ...time,
    ...objects,
    ...actions,
    ...pronouns,
    ...courtesy,
    ...fallbackContent,
  ])

  if (ordered.length === 0) {
    return cleaned.toUpperCase()
  }
  return ordered.join(' ')
}

function dedupe(values) {
  return values.filter((value, index) => values.indexOf(value) === index)
}

