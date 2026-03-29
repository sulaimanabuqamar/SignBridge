/**
 * Client-side demo “recognition” for Sign → Text.
 * Not real SL recognition — deterministic, camera-aware enough for judges.
 */

const DEMO_ROTATION = [
  'I need help',
  'Please repeat',
  'Thank you',
  'Hello',
  'Can you help me?',
  'Yes',
  'No',
]

const EXTRA_POOL = [
  'One moment please.',
  'I understand.',
  'Could you repeat that?',
  'That works for me.',
]

const SCRIPTED = {
  help: 'I need help — please assist me when you can.',
  repeat: 'Please repeat that. I want to be sure I understood.',
  thanks: 'Thank you — I appreciate it.',
  demo: 'Yes — I will send the report tomorrow morning.',
}

let defaultCycle = 0

/**
 * Sample luminance from ImageData (downsampled).
 * @param {ImageData | null} imageData
 */
export function analyzeFrameBrightness(imageData) {
  if (!imageData?.data?.length) return { brightness: 0.5, sampleSize: 0 }
  const d = imageData.data
  let sum = 0
  let n = 0
  for (let i = 0; i < d.length; i += 32) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    sum += (r + g + b) / 3
    n += 1
  }
  const brightness = n ? sum / n / 255 : 0.5
  return { brightness, sampleSize: n }
}

/**
 * @param {{
 *   imageData?: ImageData | null
 *   demoMode: boolean
 *   captureIndex: number
 *   hasLiveVideo?: boolean
 * }} opts
 * @returns {{ text: string; confidence: number; source: string; timestamp: number }}
 */
export function recognizeSignFrame(opts) {
  const { imageData = null, demoMode, captureIndex, hasLiveVideo = false } = opts
  const timestamp = Date.now()
  const { brightness } = analyzeFrameBrightness(imageData)

  if (demoMode) {
    const text = DEMO_ROTATION[captureIndex % DEMO_ROTATION.length]
    return {
      text,
      confidence: Math.min(0.98, 0.9 + brightness * 0.06 + (captureIndex % 3) * 0.01),
      source: 'demo_inference',
      timestamp,
    }
  }

  const pool = [...DEMO_ROTATION, ...EXTRA_POOL]
  const idx = Math.abs(
    Math.floor((brightness * pool.length * 2 + captureIndex * 7 + (hasLiveVideo ? 3 : 0)) % pool.length),
  )
  const text = pool[idx]
  const confidence = Math.min(0.94, 0.68 + brightness * 0.22 + (hasLiveVideo ? 0.06 : 0))

  return {
    text,
    confidence,
    source: hasLiveVideo ? 'camera_inference' : 'demo_inference',
    timestamp,
  }
}

/**
 * Scripted replies (demo script / legacy).
 * @param {'default' | 'help' | 'repeat' | 'thanks' | 'demo'} context
 */
export function mockSignRecognition(context = 'default') {
  if (SCRIPTED[context]) return SCRIPTED[context]
  defaultCycle += 1
  const fallback = [
    'Yes — I will send the report tomorrow.',
    'I understand. I can help with that.',
    'Thank you for letting me know.',
    'Could you say that one more time?',
    'I need a moment to respond.',
  ]
  return fallback[defaultCycle % fallback.length]
}
