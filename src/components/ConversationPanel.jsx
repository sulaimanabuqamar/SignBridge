import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEMO_HEARING_LINE, DEMO_SCRIPT } from '../utils/demoScript'
import { estimateSequenceDurationMs } from '../utils/avatarMotion'
import { mockSignRecognition } from '../utils/mockSignRecognition'
import { simplifyText } from '../utils/mockTranslate'
import { buildSignedPoseUrl } from '../utils/translateApi'
import { playSoftChime } from '../utils/sound'
import DemoMode from './DemoMode'
import PhraseButtons from './PhraseButtons'
import SignToText from './SignToText'
import SpeechToSign from './SpeechToSign'

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function randomLatency() {
  const ms = 520 + Math.random() * (780 - 520)
  return delay(ms)
}

function speak(text) {
  if (!text || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1
  window.speechSynthesis.speak(u)
}

export default function ConversationPanel() {
  const [demoEnabled, setDemoEnabled] = useState(false)
  const [speechTranscript, setSpeechTranscript] = useState('')
  const [speechGloss, setSpeechGloss] = useState('')
  const [speechPoseUrl, setSpeechPoseUrl] = useState('')
  const [speechListening, setSpeechListening] = useState(false)
  const [speechBusy, setSpeechBusy] = useState(false)
  const [signingKey, setSigningKey] = useState(0)
  const [signingActive, setSigningActive] = useState(false)
  const [signText, setSignText] = useState('')
  const [signMeta, setSignMeta] = useState(/** @type {{ confidence: number; source: string } | null} */ (null))
  const [signWorking, setSignWorking] = useState(false)
  const [typingKey, setTypingKey] = useState(0)
  const [ttsEnabled, setTtsEnabled] = useState(true)

  const ttsRef = useRef(ttsEnabled)

  useEffect(() => {
    ttsRef.current = ttsEnabled
  }, [ttsEnabled])

  const resetOutputs = useCallback(() => {
    setSpeechTranscript('')
    setSpeechGloss('')
    setSpeechPoseUrl('')
    setSpeechListening(false)
    setSpeechBusy(false)
    setSigningKey(0)
    setSigningActive(false)
    setSignText('')
    setSignMeta(null)
    setSignWorking(false)
    setTypingKey((k) => k + 1)
  }, [])

  const processSpeechInput = useCallback(async (raw) => {
    const text = simplifyText(raw)
    if (!text) return
    setSpeechListening(false)
    setSpeechBusy(true)
    await randomLatency()
    setSpeechTranscript(text)
    await delay(340)
    await randomLatency()
    setSpeechGloss(simplifyText(text))
    setSpeechPoseUrl(buildSignedPoseUrl(text))
    setSigningKey((k) => k + 1)
    setSigningActive(true)
    setSpeechBusy(false)
    playSoftChime()
  }, [])

  const handleStartSpeaking = useCallback(() => {
    if (demoEnabled) return
    setSpeechTranscript('')
    setSpeechGloss('')
    setSpeechListening(true)
  }, [demoEnabled])

  const handleSpeechText = useCallback(
    async (text) => {
      if (demoEnabled) return
      await processSpeechInput(text)
    },
    [demoEnabled, processSpeechInput],
  )

  const handleTypedText = useCallback(
    async (text) => {
      if (demoEnabled) return
      await processSpeechInput(text)
    },
    [demoEnabled, processSpeechInput],
  )

  const runPhraseShortcut = useCallback(
    async (phrase) => {
      if (demoEnabled) return
      setSpeechListening(true)
      await delay(560)
      await processSpeechInput(phrase)
    },
    [demoEnabled, processSpeechInput],
  )

  const handleSignResult = useCallback((result) => {
    setSignText(result.text)
    setSignMeta({ confidence: result.confidence, source: result.source })
    setTypingKey((k) => k + 1)
    playSoftChime()
    if (ttsRef.current) speak(result.text)
  }, [])

  useEffect(() => {
    if (signingKey === 0) return undefined
    const t = window.setTimeout(() => setSigningActive(false), estimateSequenceDurationMs(speechGloss))
    return () => window.clearTimeout(t)
  }, [signingKey, speechGloss])

  const avatarPhase = useMemo(() => {
    if (speechListening || (speechBusy && !speechGloss)) return 'preparing'
    if (signingActive && speechGloss) return 'signing'
    return 'idle'
  }, [speechListening, speechBusy, speechGloss, signingActive])

  const handleDemoChange = useCallback(
    (next) => {
      setDemoEnabled(next)
      if (!next) resetOutputs()
    },
    [resetOutputs],
  )

  useEffect(() => {
    if (!demoEnabled) return undefined
    let cancelled = false

    async function runDemo() {
      resetOutputs()
      await delay(420)
      for (const step of DEMO_SCRIPT) {
        if (cancelled) return
        if (step.kind === 'speech_listen') {
          setSpeechListening(true)
          await delay(step.ms)
          setSpeechListening(false)
          setSpeechBusy(true)
          await randomLatency()
          continue
        }
        if (step.kind === 'speech_text') {
          setSpeechTranscript(step.text)
          continue
        }
        if (step.kind === 'pauseMs') {
          await delay(step.ms)
          continue
        }
        if (step.kind === 'speech_gloss') {
          setSpeechGloss(simplifyText(DEMO_HEARING_LINE))
          setSpeechPoseUrl(buildSignedPoseUrl(DEMO_HEARING_LINE))
          setSigningKey((k) => k + 1)
          setSigningActive(true)
          setSpeechBusy(false)
          playSoftChime()
          continue
        }
        if (step.kind === 'sign_capture') {
          setSignWorking(true)
          await randomLatency()
          continue
        }
        if (step.kind === 'sign_reply') {
          const reply = mockSignRecognition(step.context)
          setTypingKey((k) => k + 1)
          setSignText(reply)
          setSignMeta({ confidence: 0.95, source: 'demo_inference' })
          setSignWorking(false)
          if (ttsRef.current) speak(reply)
        }
      }
    }

    runDemo()
    return () => {
      cancelled = true
    }
  }, [demoEnabled, resetOutputs])

  const busy = demoEnabled || speechBusy || speechListening

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            SignBridge
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Real-time speech & sign
          </h1>
          <p className="mt-2 max-w-xl text-base text-zinc-500">
            A split conversation for hearing and deaf participants — demo uses simulated recognition
            so judges see the full loop instantly.
          </p>
        </div>
        <DemoMode enabled={demoEnabled} onChange={handleDemoChange} />
      </header>

      <PhraseButtons onPhrase={runPhraseShortcut} disabled={busy || demoEnabled} />

      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <div className="min-h-[560px] flex-1">
          <SpeechToSign
            transcript={speechTranscript}
            gloss={speechGloss}
            poseUrl={speechPoseUrl}
            listening={speechListening}
            processing={speechBusy}
            avatarPhase={avatarPhase}
            playbackKey={signingKey}
            demoEnabled={demoEnabled}
            onStartSpeaking={handleStartSpeaking}
            onSpeechText={handleSpeechText}
            onSubmitTypedText={handleTypedText}
          />
        </div>

        <div className="relative flex items-center justify-center py-1">
          <div className="h-px w-full max-w-md bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
          <span className="absolute rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-400">
            Bridge
          </span>
        </div>

        <div className="min-h-[360px] flex-1">
          <SignToText
            recognizedText={signText}
            typingKey={typingKey}
            demoEnabled={demoEnabled}
            demoSignBusy={signWorking}
            recognitionMeta={signMeta}
            onSignResult={handleSignResult}
            ttsEnabled={ttsEnabled}
            onTtsChange={setTtsEnabled}
          />
        </div>
      </div>
    </div>
  )
}
