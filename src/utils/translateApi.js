const SIGNBRIDGE_PROXY = 'https://signbridge-proxy.helicalhayyan.workers.dev'
const DIRECT_SIGN_MT_API = 'https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose'

export function buildSignedPoseUrl(text, spokenLanguage = 'en', signedLanguage = 'ase') {
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  const api = isLocalhost ? DIRECT_SIGN_MT_API : `${SIGNBRIDGE_PROXY}/api/signed-pose`
  return `${api}?text=${encodeURIComponent(text)}&spoken=${spokenLanguage}&signed=${signedLanguage}`
}
