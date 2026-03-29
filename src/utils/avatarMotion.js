/**
 * avatarMotion.js
 * Gloss → motion mapping for the 3D hand rig.
 *
 * resolveMotionForWord  — maps a gloss token to one of six motion types
 * MOTION_POSES_3D       — euler rotation + position targets for each motion type,
 *                         consumed by GeneratedAvatar to drive Hand_Left_30 in
 *                         the Three.js scene
 */

// ─── Timing constants ─────────────────────────────────────────────────────────
/** Base delay between word beats (ms); small jitter added at runtime. */
export const WORD_BEAT_MS       = 420
export const WORD_BEAT_JITTER_MS = 140
export const SEQUENCE_TAIL_MS   = 520

/** @typedef {'idle' | 'up' | 'push' | 'tap' | 'sweep' | 'wave'} MotionKind */

// ─── Vocabulary maps ─────────────────────────────────────────────────────────
// "up"    → time / location words — hand raised, palm faces out
const TIME_WORDS = new Set([
  'TOMORROW', 'TODAY', 'NOW', 'LATER', 'YESTERDAY', 'TONIGHT',
  'MORNING', 'AFTERNOON', 'EVENING', 'NEXT', 'WHEN', 'TIME',
])

// "push"  → action / transfer verbs — arm extends forward or sideways
const PUSH_WORDS = new Set([
  'SEND', 'GIVE', 'GO', 'HELP', 'CALL', 'TELL', 'SHOW',
  'BRING', 'PUT', 'TAKE', 'MOVE', 'PASS', 'GET', 'MEET',
])

// "tap"   → object / noun references — index points at a specific thing
const TAP_WORDS = new Set([
  'REPORT', 'THING', 'WORK', 'MESSAGE', 'TASK', 'NEED',
  'DOCUMENT', 'FILE', 'PROJECT', 'JOB', 'ITEM', 'PERSON',
  'BATHROOM', 'WATER', 'DOCTOR', 'MEETING',
])

// "sweep" → social / courtesy expressions — broad open-hand sweep
const SWEEP_WORDS = new Set([
  'THANK', 'PLEASE', 'SORRY', 'HELLO', 'REPEAT', 'WELCOME',
  'UNDERSTAND', 'FINE', 'GOOD', 'GREAT', 'AGREE', 'THANKYOU',
])

// "wave"  → greetings / affirmations — open waving hand
const WAVE_WORDS = new Set([
  'HI', 'BYE', 'YES', 'SURE', 'OK', 'OKAY', 'RIGHT',
  'WAIT', 'READY', 'DONE', 'FINISH', 'STOP', 'START', 'ONEMOMENT',
])

// ─── Deterministic hash fallback ──────────────────────────────────────────────
function hashMotion(word) {
  const s  = String(word || '')
  let h    = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const kinds = /** @type {MotionKind[]} */ (['up', 'push', 'tap', 'sweep', 'wave'])
  return kinds[h % kinds.length]
}

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Map a single gloss token to a MotionKind.
 * @param {string} word  — one uppercase gloss word (e.g. "TOMORROW")
 * @returns {MotionKind}
 */
export function resolveMotionForWord(word) {
  const w = String(word || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (!w) return 'wave'
  if (TIME_WORDS.has(w))  return 'up'
  if (PUSH_WORDS.has(w))  return 'push'
  if (TAP_WORDS.has(w))   return 'tap'
  if (SWEEP_WORDS.has(w)) return 'sweep'
  if (WAVE_WORDS.has(w))  return 'wave'
  return hashMotion(w)
}

/**
 * Split a gloss string into individual tokens, filtering empties.
 * @param {string} gloss
 * @returns {string[]}
 */
export function splitGlossWords(gloss) {
  return String(gloss || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Return a randomised inter-beat delay for a more natural signing rhythm.
 * @returns {number} milliseconds
 */
export function beatDelay() {
  return WORD_BEAT_MS + Math.random() * WORD_BEAT_JITTER_MS
}

export function estimateSequenceDurationMs(gloss) {
  const words = splitGlossWords(gloss)
  if (words.length === 0) return SEQUENCE_TAIL_MS
  return words.length * WORD_BEAT_MS + Math.max(0, words.length - 1) * 80 + SEQUENCE_TAIL_MS + 600
}

export const MOTION_POSES_3D = {
  //          rx      ry      rz      py
  idle:  { rx:  0.06, ry:  0.00, rz:  0.00, py:  0.00 },
  up:    { rx: -0.55, ry:  0.00, rz:  0.18, py:  0.13 },
  push:  { rx:  0.18, ry:  0.28, rz:  0.00, py:  0.00 },
  tap:   { rx:  0.75, ry:  0.06, rz: -0.18, py: -0.09 },
  sweep: { rx:  0.10, ry:  0.60, rz:  0.00, py:  0.02 },
  wave:  { rx: -0.18, ry:  0.38, rz:  0.38, py:  0.09 },
}
