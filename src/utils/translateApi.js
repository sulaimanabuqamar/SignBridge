const SIGNBRIDGE_PROXY = 'https://signbridge-proxy.helicalhayyan.workers.dev'

export function buildSignedPoseUrl(text, spokenLanguage = 'en', signedLanguage = 'ase') {
  const api = `${SIGNBRIDGE_PROXY}/api/signed-pose`
  return `${api}?text=${encodeURIComponent(text)}&spoken=${spokenLanguage}&signed=${signedLanguage}`
}
