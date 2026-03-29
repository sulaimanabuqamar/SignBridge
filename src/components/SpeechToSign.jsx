import { useEffect, useRef } from 'react'
import { simplifyText } from '../utils/mockTranslate'

function getRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition
}

export default function SpeechToSign({
  transcript,
  gloss,
  listening,
  processing,
  avatarActive,
  demoEnabled,
  onStartSpeaking,
  onSpeechText,
}) {
  const recRef = useRef(null)

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
  }, [demoEnabled])

  function handleStart() {
    if (demoEnabled || processing) return
    const Recognition = getRecognition()
    onStartSpeaking()

    if (!Recognition) {
      window.setTimeout(() => {
        onSpeechText(
          'Can you send me the report tomorrow?',
        )
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

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
        <div className="flex min-h-[140px] flex-col rounded-xl bg-zinc-50/90 p-4 ring-1 ring-zinc-100">
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

        <div className="flex min-h-[140px] flex-col overflow-hidden rounded-xl bg-indigo-50/60 p-4 ring-1 ring-indigo-100">
          <p className="text-xs font-medium text-indigo-800/80">Sign gloss</p>
          <p className="mt-2 font-mono text-xl font-semibold leading-snug tracking-wide text-indigo-950">
            {gloss || <span className="font-sans text-base font-normal text-indigo-400">—</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-4">
        <div
          className={`relative flex h-28 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-100 to-zinc-50 ${
            avatarActive ? 'animate-sign-avatar' : ''
          }`}
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(79,70,229,0.15),transparent_55%)]" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600/90 text-2xl text-white shadow-inner">
            ✋
          </div>
        </div>
        <p className="text-sm leading-relaxed text-zinc-500">
          Avatar preview — your sign engine would drive a 3D or video avatar here. Gloss updates
          sync to the beat of the demo.
        </p>
      </div>
    </section>
  )
}
