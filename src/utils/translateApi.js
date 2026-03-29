export function buildSignedPoseUrl(text, spokenLanguage = 'en', signedLanguage = 'ase') {
  const api = 'https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose'
  return `${api}?text=${encodeURIComponent(text)}&spoken=${spokenLanguage}&signed=${signedLanguage}`
}
