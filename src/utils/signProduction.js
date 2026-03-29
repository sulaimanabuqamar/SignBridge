import { simplifyText, toSignGloss } from './mockTranslate'

const PHRASE_PATTERNS = [
  {
    test: /can\s+you\s+send\s+me\s+the\s+report\s+tomorrow/,
    gloss: 'TOMORROW REPORT SEND ME',
    sequence: ['tomorrow', 'report', 'send', 'me'],
  },
  {
    test: /send\s+me\s+the\s+report/,
    gloss: 'REPORT SEND ME',
    sequence: ['report', 'send', 'me'],
  },
  {
    test: /i\s+need\s+help|help\s+me/,
    gloss: 'HELP ME',
    sequence: ['help', 'me'],
  },
  {
    test: /please\s+repeat|repeat\s+that|say\s+that\s+again/,
    gloss: 'PLEASE REPEAT',
    sequence: ['please', 'repeat'],
  },
  {
    test: /thank\s+you/,
    gloss: 'THANK-YOU',
    sequence: ['thank-you'],
  },
  {
    test: /where\s+is\s+the\s+bathroom|bathroom/,
    gloss: 'BATHROOM WHERE',
    sequence: ['bathroom', 'where'],
  },
  {
    test: /hello|hi/,
    gloss: 'HELLO',
    sequence: ['hello'],
  },
]

const WORD_TO_SIGN = {
  tomorrow: 'tomorrow',
  today: 'today',
  later: 'later',
  report: 'report',
  file: 'report',
  message: 'report',
  task: 'report',
  send: 'send',
  give: 'send',
  bring: 'send',
  help: 'help',
  me: 'me',
  you: 'you',
  please: 'please',
  repeat: 'repeat',
  thank: 'thank-you',
  hello: 'hello',
  hi: 'hello',
  bathroom: 'bathroom',
  where: 'where',
  yes: 'yes',
  no: 'no',
  wait: 'wait',
}

const SIGN_POSES = {
  hello: {
    label: 'HELLO',
    motion: 'wave',
    twist: 0.42,
    lift: 0.16,
    thumb: { spread: 0.46, curl: 0.04, fan: -0.44, rise: 0.05 },
    fingers: [
      { spread: -0.16, curl: [0.02, 0.01, 0], lean: -0.18 },
      { spread: -0.05, curl: [0.02, 0.01, 0], lean: -0.06 },
      { spread: 0.06, curl: [0.03, 0.01, 0], lean: 0.08 },
      { spread: 0.16, curl: [0.05, 0.02, 0.01], lean: 0.18 },
    ],
  },
  'thank-you': {
    label: 'THANK-YOU',
    motion: 'sweep',
    twist: 0.18,
    lift: 0.08,
    thumb: { spread: 0.36, curl: 0.06, fan: -0.24, rise: 0.02 },
    fingers: [
      { spread: -0.12, curl: [0.04, 0.02, 0.01], lean: -0.08 },
      { spread: -0.03, curl: [0.03, 0.01, 0], lean: -0.02 },
      { spread: 0.05, curl: [0.04, 0.02, 0.01], lean: 0.03 },
      { spread: 0.12, curl: [0.06, 0.03, 0.01], lean: 0.07 },
    ],
  },
  please: {
    label: 'PLEASE',
    motion: 'sweep',
    twist: 0.3,
    lift: 0.04,
    thumb: { spread: 0.34, curl: 0.08, fan: -0.22, rise: 0.02 },
    fingers: [
      { spread: -0.13, curl: [0.06, 0.03, 0.01], lean: -0.08 },
      { spread: -0.04, curl: [0.05, 0.03, 0.01], lean: -0.02 },
      { spread: 0.05, curl: [0.05, 0.03, 0.01], lean: 0.03 },
      { spread: 0.13, curl: [0.08, 0.04, 0.02], lean: 0.08 },
    ],
  },
  repeat: {
    label: 'REPEAT',
    motion: 'tap',
    twist: -0.06,
    lift: 0,
    thumb: { spread: 0.26, curl: 0.16, fan: -0.1, rise: 0 },
    fingers: [
      { spread: -0.04, curl: [0.02, 0.01, 0], lean: -0.16 },
      { spread: 0, curl: [0.08, 0.04, 0.02], lean: 0 },
      { spread: 0.03, curl: [0.48, 0.34, 0.2], lean: 0.03 },
      { spread: 0.08, curl: [0.54, 0.39, 0.24], lean: 0.1 },
    ],
  },
  help: {
    label: 'HELP',
    motion: 'push',
    twist: 0.12,
    lift: 0.02,
    thumb: { spread: 0.28, curl: 0.18, fan: -0.16, rise: 0.01 },
    fingers: [
      { spread: -0.06, curl: [0.16, 0.1, 0.06], lean: -0.04 },
      { spread: -0.01, curl: [0.18, 0.12, 0.08], lean: 0 },
      { spread: 0.04, curl: [0.22, 0.14, 0.08], lean: 0.04 },
      { spread: 0.09, curl: [0.26, 0.18, 0.1], lean: 0.09 },
    ],
  },
  me: {
    label: 'ME',
    motion: 'tap',
    twist: -0.02,
    lift: -0.01,
    thumb: { spread: 0.22, curl: 0.22, fan: -0.08, rise: -0.01 },
    fingers: [
      { spread: -0.03, curl: [0.01, 0, 0], lean: -0.18 },
      { spread: 0, curl: [0.52, 0.36, 0.22], lean: 0 },
      { spread: 0.03, curl: [0.58, 0.42, 0.26], lean: 0.04 },
      { spread: 0.07, curl: [0.64, 0.48, 0.32], lean: 0.1 },
    ],
  },
  you: {
    label: 'YOU',
    motion: 'push',
    twist: 0.08,
    lift: 0.03,
    thumb: { spread: 0.24, curl: 0.22, fan: -0.12, rise: 0.01 },
    fingers: [
      { spread: -0.03, curl: [0.02, 0, 0], lean: -0.12 },
      { spread: 0, curl: [0.04, 0.02, 0.01], lean: 0 },
      { spread: 0.04, curl: [0.5, 0.36, 0.22], lean: 0.04 },
      { spread: 0.08, curl: [0.58, 0.42, 0.26], lean: 0.1 },
    ],
  },
  report: {
    label: 'REPORT',
    motion: 'tap',
    twist: 0.02,
    lift: 0,
    thumb: { spread: 0.2, curl: 0.18, fan: -0.08, rise: 0 },
    fingers: [
      { spread: -0.02, curl: [0.03, 0.01, 0], lean: -0.1 },
      { spread: 0, curl: [0.06, 0.03, 0.01], lean: -0.02 },
      { spread: 0.03, curl: [0.56, 0.4, 0.24], lean: 0.03 },
      { spread: 0.08, curl: [0.64, 0.46, 0.28], lean: 0.1 },
    ],
  },
  send: {
    label: 'SEND',
    motion: 'push',
    twist: 0.18,
    lift: 0.02,
    thumb: { spread: 0.31, curl: 0.12, fan: -0.16, rise: 0.01 },
    fingers: [
      { spread: -0.1, curl: [0.1, 0.05, 0.02], lean: -0.08 },
      { spread: -0.03, curl: [0.08, 0.04, 0.02], lean: -0.02 },
      { spread: 0.04, curl: [0.1, 0.05, 0.02], lean: 0.03 },
      { spread: 0.11, curl: [0.14, 0.08, 0.03], lean: 0.09 },
    ],
  },
  tomorrow: {
    label: 'TOMORROW',
    motion: 'up',
    twist: -0.18,
    lift: 0.14,
    thumb: { spread: 0.38, curl: 0.06, fan: -0.34, rise: 0.04 },
    fingers: [
      { spread: -0.14, curl: [0.06, 0.03, 0.01], lean: -0.08 },
      { spread: -0.04, curl: [0.04, 0.02, 0], lean: -0.02 },
      { spread: 0.05, curl: [0.05, 0.03, 0.01], lean: 0.02 },
      { spread: 0.14, curl: [0.08, 0.04, 0.02], lean: 0.06 },
    ],
  },
  bathroom: {
    label: 'BATHROOM',
    motion: 'tap',
    twist: 0.06,
    lift: -0.02,
    thumb: { spread: 0.18, curl: 0.24, fan: -0.08, rise: -0.02 },
    fingers: [
      { spread: -0.02, curl: [0.44, 0.3, 0.2], lean: -0.05 },
      { spread: 0, curl: [0.1, 0.04, 0.01], lean: 0 },
      { spread: 0.02, curl: [0.1, 0.04, 0.01], lean: 0.02 },
      { spread: 0.06, curl: [0.46, 0.32, 0.2], lean: 0.08 },
    ],
  },
  where: {
    label: 'WHERE',
    motion: 'wave',
    twist: 0.24,
    lift: 0.06,
    thumb: { spread: 0.36, curl: 0.08, fan: -0.28, rise: 0.03 },
    fingers: [
      { spread: -0.14, curl: [0.12, 0.06, 0.03], lean: -0.16 },
      { spread: -0.05, curl: [0.1, 0.05, 0.02], lean: -0.05 },
      { spread: 0.07, curl: [0.12, 0.06, 0.03], lean: 0.08 },
      { spread: 0.16, curl: [0.15, 0.08, 0.04], lean: 0.17 },
    ],
  },
  yes: {
    label: 'YES',
    motion: 'push',
    twist: 0.05,
    lift: 0,
    thumb: { spread: 0.12, curl: 0.44, fan: -0.03, rise: -0.01 },
    fingers: [
      { spread: -0.02, curl: [0.68, 0.5, 0.34], lean: -0.03 },
      { spread: 0, curl: [0.7, 0.52, 0.36], lean: 0 },
      { spread: 0.02, curl: [0.72, 0.54, 0.38], lean: 0.02 },
      { spread: 0.05, curl: [0.75, 0.57, 0.4], lean: 0.05 },
    ],
  },
  no: {
    label: 'NO',
    motion: 'tap',
    twist: 0,
    lift: 0.02,
    thumb: { spread: 0.22, curl: 0.12, fan: -0.08, rise: 0.02 },
    fingers: [
      { spread: -0.04, curl: [0.02, 0.01, 0], lean: -0.08 },
      { spread: 0, curl: [0.02, 0.01, 0], lean: 0 },
      { spread: 0.03, curl: [0.56, 0.4, 0.24], lean: 0.03 },
      { spread: 0.08, curl: [0.62, 0.46, 0.28], lean: 0.08 },
    ],
  },
  wait: {
    label: 'WAIT',
    motion: 'wave',
    twist: 0.12,
    lift: 0.02,
    thumb: { spread: 0.28, curl: 0.14, fan: -0.14, rise: 0.01 },
    fingers: [
      { spread: -0.09, curl: [0.12, 0.06, 0.03], lean: -0.05 },
      { spread: -0.02, curl: [0.14, 0.08, 0.04], lean: 0 },
      { spread: 0.04, curl: [0.16, 0.09, 0.05], lean: 0.04 },
      { spread: 0.1, curl: [0.18, 0.1, 0.06], lean: 0.08 },
    ],
  },
}

function unique(sequence) {
  return sequence.filter((value, index) => sequence.indexOf(value) === index)
}

export function buildSignPlan(input) {
  const normalized = simplifyText(input).toLowerCase()
  const phraseMatch = PHRASE_PATTERNS.find((rule) => rule.test.test(normalized))

  if (phraseMatch) {
    return {
      normalizedText: normalized,
      gloss: phraseMatch.gloss,
      sequence: phraseMatch.sequence.map((token) => SIGN_POSES[token]).filter(Boolean),
    }
  }

  const gloss = toSignGloss(normalized)
  const sequence = unique(
    gloss
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => WORD_TO_SIGN[token] || token),
  )
    .map((token) => SIGN_POSES[token])
    .filter(Boolean)

  return {
    normalizedText: normalized,
    gloss,
    sequence,
  }
}
