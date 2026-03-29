/**
 * Demo-only gloss → motion mapping. Not linguistic ASL — believable motion variety.
 */

/** Base delay between word beats (ms); small jitter added at runtime. */
export const WORD_BEAT_MS = 420
export const WORD_BEAT_JITTER_MS = 140
export const SEQUENCE_TAIL_MS = 520

/** @typedef {'idle' | 'up' | 'push' | 'tap' | 'sweep' | 'wave'} MotionKind */

const TIME_WORDS = new Set([
  'TOMORROW',
  'TODAY',
  'NOW',
  'LATER',
  'YESTERDAY',
  'TONIGHT',
])
const PUSH_WORDS = new Set(['SEND', 'GIVE', 'GO', 'HELP', 'CALL', 'TELL'])
const TAP_WORDS = new Set(['REPORT', 'THING', 'WORK', 'MESSAGE', 'TASK', 'NEED'])
const SWEEP_WORDS = new Set(['THANK', 'PLEASE', 'SORRY', 'HELLO', 'REPEAT'])

function hashMotion(word) {
  const s = String(word || '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const kinds = /** @type {MotionKind[]} */ (['up', 'push', 'tap', 'sweep', 'wave'])
  return kinds[h % kinds.length]
}

/**
 * @param {string} word
 * @returns {MotionKind}
 */
export function resolveMotionForWord(word) {
  const w = String(word || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (!w) return 'wave'
  if (TIME_WORDS.has(w)) return 'up'
  if (PUSH_WORDS.has(w)) return 'push'
  if (TAP_WORDS.has(w)) return 'tap'
  if (SWEEP_WORDS.has(w)) return 'sweep'
  return hashMotion(w)
}

/**
 * @param {string} gloss
 * @returns {string[]}
 */
export function splitGlossWords(gloss) {
  return String(gloss || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function beatDelay() {
  return WORD_BEAT_MS + Math.random() * WORD_BEAT_JITTER_MS
}
