const SIGN_LANGUAGE_OPTIONS = [
  { value: 'ase', label: 'America' },
  { value: 'bfi', label: 'United Kingdom' },
  { value: 'asf', label: 'Australia' },
]

const SPOKEN_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', ttsLang: 'en-US' },
  { value: 'fr', label: 'French', ttsLang: 'fr-FR' },
  { value: 'es', label: 'Spanish', ttsLang: 'es-ES' },
]

const TRANSLATIONS = {
  Hello: {
    en: 'Hello',
    fr: 'Bonjour',
    es: 'Hola',
  },
  Yes: {
    en: 'Yes',
    fr: 'Oui',
    es: 'Si',
  },
  No: {
    en: 'No',
    fr: 'Non',
    es: 'No',
  },
  'Please repeat': {
    en: 'Please repeat',
    fr: 'Veuillez repeter',
    es: 'Por favor, repita',
  },
  'I need help': {
    en: 'I need help',
    fr: "J'ai besoin d'aide",
    es: 'Necesito ayuda',
  },
  'One moment please.': {
    en: 'One moment please.',
    fr: "Un instant, s'il vous plait.",
    es: 'Un momento, por favor.',
  },
  'Thank you': {
    en: 'Thank you',
    fr: 'Merci',
    es: 'Gracias',
  },
  'Can you help me?': {
    en: 'Can you help me?',
    fr: "Pouvez-vous m'aider ?",
    es: 'Puede ayudarme?',
  },
  'Could you repeat that?': {
    en: 'Could you repeat that?',
    fr: 'Pouvez-vous repeter cela ?',
    es: 'Puede repetir eso?',
  },
  'I understand.': {
    en: 'I understand.',
    fr: 'Je comprends.',
    es: 'Entiendo.',
  },
  'That works for me.': {
    en: 'That works for me.',
    fr: 'Cela me convient.',
    es: 'Eso me funciona.',
  },
  'Yes — I will send the report tomorrow.': {
    en: 'Yes — I will send the report tomorrow.',
    fr: "Oui — j'enverrai le rapport demain.",
    es: 'Si — enviare el informe manana.',
  },
  'I need help — please assist me when you can.': {
    en: 'I need help — please assist me when you can.',
    fr: "J'ai besoin d'aide — aidez-moi quand vous pouvez.",
    es: 'Necesito ayuda — ayudeme cuando pueda.',
  },
  'Please repeat that. I want to be sure I understood.': {
    en: 'Please repeat that. I want to be sure I understood.',
    fr: 'Veuillez repeter cela. Je veux etre sur d avoir compris.',
    es: 'Por favor, repita eso. Quiero asegurarme de haber entendido.',
  },
  'Thank you — I appreciate it.': {
    en: 'Thank you — I appreciate it.',
    fr: "Merci — je l'apprecie.",
    es: 'Gracias — lo agradezco.',
  },
  'Yes — I will send the report tomorrow morning.': {
    en: 'Yes — I will send the report tomorrow morning.',
    fr: "Oui — j'enverrai le rapport demain matin.",
    es: 'Si — enviare el informe manana por la manana.',
  },
}

export function translateRecognizedSign(text, language = 'en') {
  const entry = TRANSLATIONS[text]
  if (!entry) return text
  return entry[language] || entry.en || text
}

export function getSpokenLanguageMeta(language = 'en') {
  return SPOKEN_LANGUAGE_OPTIONS.find((option) => option.value === language) || SPOKEN_LANGUAGE_OPTIONS[0]
}

export { SIGN_LANGUAGE_OPTIONS, SPOKEN_LANGUAGE_OPTIONS }
