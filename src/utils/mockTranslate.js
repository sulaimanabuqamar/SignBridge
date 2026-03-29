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

const MOCK_SIGN_RESPONSES = [
  'Yes — I will send the report tomorrow.',
  'I understand. I can help with that.',
  'Thank you for letting me know.',
  'Could you say that one more time?',
  'I need a moment to respond.',
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

let mockCounter = 0

/**
 * Mock camera “recognition” — fast, deterministic enough for demo.
 * @param {'default' | 'help' | 'repeat' | 'thanks' | 'demo'} context
 */
export function mockSignRecognition(context = 'default') {
  const scripted = {
    help: 'I need help — please assist me when you can.',
    repeat: 'Please repeat that. I want to be sure I understood.',
    thanks: 'Thank you — I appreciate it.',
    demo: 'Yes — I will send the report tomorrow morning.',
  }
  if (scripted[context]) return scripted[context]
  mockCounter += 1
  return MOCK_SIGN_RESPONSES[mockCounter % MOCK_SIGN_RESPONSES.length]
}
