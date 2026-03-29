import { useEffect, useRef, useState } from 'react'
import { SIGN_LANGUAGE_OPTIONS } from '../data/signLanguages'
import { simplifyText } from '../utils/mockTranslate'
import PoseSigner from './PoseSigner'

function getRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition
}

const POPULAR_ENGLISH_SIGN_LANGUAGES = new Set(['ase', 'bfi', 'asf'])

export default function SpeechToSign({
  transcript,
  gloss,
  poseUrl,
  listening,
  processing,
  avatarPhase = 'idle',
  playbackKey = 0,
  demoEnabled,
  onStartSpeaking,
  onSpeechPreview,
  onSpeechText,
  onSpeechError,
  onSubmitTypedText,
  speechError = '',
  signedLanguage = 'ase',
  onSignedLanguageChange,
}) {
  const recRef = useRef(null)
  const [draft, setDraft] = useState('')
  const [supportsRecognition, setSupportsRecognition] = useState(true)
  const signLanguageChoices = SIGN_LANGUAGE_OPTIONS
    .filter((option) => POPULAR_ENGLISH_SIGN_LANGUAGES.has(option.signed))
    .filter((option, index, all) => all.findIndex((entry) => entry.signed === option.signed) === index)
    .map((option) => ({
      value: option.signed,
      label: option.abbreviation
        ? `${option.name} (${option.abbreviation})`
        : option.name,
    }))
    .sort((a, b) => {
      if (a.value === 'ase') return -1
      if (b.value === 'ase') return 1
      return a.label.localeCompare(b.label)
    })

  useEffect(() => {
    setSupportsRecognition(Boolean(getRecognition()))
  }, [])

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop()
      } catch {
        /* noop */
      }
    }
  }, [])

  useEffect(() => {
    if (!demoEnabled) return
    try {
      recRef.current?.stop()
    } catch {
      /* noop */
    }
    recRef.current = null
    setDraft('')
  }, [demoEnabled])

  function handleTypedSubmit(event) {
    event.preventDefault()
    const text = simplifyText(draft)
    if (!text || demoEnabled || processing) return
    onSubmitTypedText?.(text)
  }

  function handleStart() {
    if (demoEnabled || processing) return

    if (listening) {
      try {
        recRef.current?.stop()
      } catch {
        /* noop */
      }
      return
    }

    const Recognition = getRecognition()
    if (!Recognition) {
      setSupportsRecognition(false)
      onSpeechError?.(
        'Voice transcription is not available in this browser. Please use Chrome or Edge, or type your text below.',
      )
      return
    }

    setSupportsRecognition(true)
    onStartSpeaking?.()

    const rec = new Recognition()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    recRef.current = rec

    let finalTranscript = ''

    rec.onresult = (event) => {
      let interimTranscript = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const chunk = result[0]?.transcript ?? ''
        if (result.isFinal) {
          finalTranscript = `${finalTranscript} ${chunk}`.trim()
        } else {
          interimTranscript = `${interimTranscript} ${chunk}`.trim()
        }
      }

      const preview = simplifyText(`${finalTranscript} ${interimTranscript}`.trim())
      if (preview) onSpeechPreview?.(preview)
    }

    rec.onerror = (event) => {
      recRef.current = null
      const errorCode = event?.error
      if (errorCode === 'no-speech') {
        onSpeechError?.('I did not hear anything. Please try again and speak a little closer to the microphone.')
        return
      }
      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        onSpeechError?.('Microphone permission is blocked. Please allow microphone access and try again.')
        return
      }
      if (errorCode === 'audio-capture') {
        onSpeechError?.('No working microphone was found. Please check your input device and try again.')
        return
      }
      onSpeechError?.('Voice transcription failed before text could be created. Please try again or type your sentence below.')
    }

    rec.onend = () => {
      recRef.current = null
      const text = simplifyText(finalTranscript)
      if (text) {
        onSpeechText?.(text)
      } else {
        onSpeechError?.('No transcript was captured. Please try again or type your sentence below.')
      }
    }

    try {
      rec.start()
    } catch {
      recRef.current = null
      onSpeechError?.('Voice transcription could not start. Please wait a moment and try again.')
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
      <header className="flex flex-shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Hearing participant
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Speech -&gt; Sign
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              supportsRecognition ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {supportsRecognition ? 'Mic Ready' : 'Typing Fallback'}
          </span>
          <button
            type="button"
            disabled={demoEnabled || processing}
            onClick={handleStart}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {listening ? 'Stop Listening' : processing ? 'Building Sign...' : 'Start Speaking'}
          </button>
        </div>
      </header>

      {speechError ? (
        <div className="flex flex-shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {speechError}
        </div>
      ) : null}

      <form onSubmit={handleTypedSubmit} className="flex flex-shrink-0 flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Type to sign</p>
            <p className="text-sm text-zinc-500">Manual input still works if microphone transcription is unavailable.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={signedLanguage}
              onChange={(event) => onSignedLanguageChange?.(event.target.value)}
              disabled={demoEnabled || processing}
              className="max-w-[18rem] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm outline-none focus:border-indigo-400"
              aria-label="Select sign language"
            >
              {signLanguageChoices.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={demoEnabled || processing || !simplifyText(draft)}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sign text
            </button>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="Type a sentence like: Can you send me the report tomorrow?"
          disabled={demoEnabled || processing}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-indigo-400"
        />
      </form>

      <div className="grid min-h-0 flex-shrink-0 gap-4 md:grid-cols-2">
        <div className="flex min-h-[120px] flex-col rounded-xl bg-zinc-50/90 p-4 ring-1 ring-zinc-100">
          <p className="text-xs font-medium text-zinc-500">Transcript</p>
          <p className="mt-2 flex-1 text-lg leading-relaxed text-zinc-900">
            {transcript || (
              <span className="text-zinc-400">
                {listening ? 'Listening for speech...' : 'Press "Start Speaking" or use quick phrases.'}
              </span>
            )}
          </p>
        </div>

        <div className="flex min-h-[120px] flex-col overflow-hidden rounded-xl bg-indigo-50/60 p-4 ring-1 ring-indigo-100">
          <p className="text-xs font-medium text-indigo-800/80">Signed text</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-indigo-500">
            {signLanguageChoices.find((option) => option.value === signedLanguage)?.label || 'American Sign Language (ASL)'}
          </p>
          <p className="mt-2 font-mono text-xl font-semibold leading-snug tracking-wide text-indigo-950">
            {gloss || <span className="font-sans text-base font-normal text-indigo-400">-</span>}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <PoseSigner
          key={`${playbackKey}-${poseUrl}`}
          src={poseUrl}
          phrase={transcript}
          loading={avatarPhase === 'preparing' || (avatarPhase === 'signing' && !poseUrl)}
          demoMode={demoEnabled}
        />
      </div>
    </section>
  )
}
