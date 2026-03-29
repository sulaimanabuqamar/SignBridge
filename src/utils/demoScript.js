/** Scripted lines for Demo Mode (hearing → sign response). */
export const DEMO_HEARING_LINE = 'Can you send me the report tomorrow?'

/**
 * Ordered steps for the judge demo — keeps the narrative in one place.
 */
export const DEMO_SCRIPT = [
  { kind: 'speech_listen', ms: 780 },
  { kind: 'speech_text', text: DEMO_HEARING_LINE },
  { kind: 'pauseMs', ms: 360 },
  { kind: 'speech_gloss' },
  { kind: 'pauseMs', ms: 1150 },
  { kind: 'sign_capture' },
  { kind: 'sign_reply', context: 'demo' },
]
