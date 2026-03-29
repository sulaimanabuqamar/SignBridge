import { useEffect, useRef, useState } from 'react'
import { simplifyText } from '../utils/mockTranslate'
import PoseSigner from './PoseSigner'

function getRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition
}

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
  onSpeechText,
  onSubmitTypedText,
}) {
  const recRef = useRef(null)
  const [draft, setDraft] = useState('')

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
    const Recognition = getRecognition()
    onStartSpeaking()

    if (!Recognition) {
      window.setTimeout(() => {
        onSpeechText('Can you send me the report tomorrow?')
      }, 1400)
      return
    }

    const rec = new Recognition()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    recRef.current = rec

    rec.onresult = (event) => {
      const text = event.results[0][0].transcript
      onSpeechText(simplifyText(text))
    }

    rec.onerror = () => {
      onSpeechText('I need help with this task.')
    }

    rec.onend = () => {
      recRef.current = null
    }

    try {
      rec.start()
    } catch {
      onSpeechText('Please repeat what you said.')
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
            Speech → Sign
          </h2>
        </div>
        <button
          type="button"
          disabled={demoEnabled || processing}
          onClick={handleStart}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {listening ? 'Listening…' : processing ? 'Working…' : 'Start Speaking'}
        </button>
      </header>

      <form onSubmit={handleTypedSubmit} className="flex flex-shrink-0 flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Type to sign</p>
            <p className="text-sm text-zinc-500">Start here while we improve transcription.</p>
          </div>
          <button
            type="submit"
            disabled={demoEnabled || processing || !simplifyText(draft)}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sign text
          </button>
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
                {listening
                  ? 'Listening for speech…'
                  : 'Press “Start Speaking” or use quick phrases.'}
              </span>
            )}
          </p>
        </div>

        <div className="flex min-h-[120px] flex-col overflow-hidden rounded-xl bg-indigo-50/60 p-4 ring-1 ring-indigo-100">
          <p className="text-xs font-medium text-indigo-800/80">Signed text</p>
          <p className="mt-2 font-mono text-xl font-semibold leading-snug tracking-wide text-indigo-950">
            {gloss || <span className="font-sans text-base font-normal text-indigo-400">—</span>}
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
