import { useEffect, useRef, useState } from 'react'
import TypingText from './TypingText'

export default function SignToText({
  recognizedText,
  working,
  typingKey,
  demoEnabled,
  onCapture,
  ttsEnabled,
  onTtsChange,
}) {
  const videoRef = useRef(null)
  const [videoOn, setVideoOn] = useState(false)

  useEffect(() => {
    let stream
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      return undefined
    }
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        setVideoOn(true)
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => setVideoOn(false))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
      <header className="flex flex-shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Deaf / hard-of-hearing participant
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Sign → Text</h2>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
            checked={ttsEnabled}
            onChange={(e) => onTtsChange(e.target.checked)}
          />
          Read aloud (TTS)
        </label>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,220px)_1fr]">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 shadow-inner ring-1 ring-zinc-800/20 md:aspect-auto md:min-h-[160px]">
          {videoOn ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              autoPlay
              playsInline
              muted
            />
          ) : (
            <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-800 to-zinc-950 p-4 text-center">
              <span className="text-3xl opacity-80" aria-hidden>
                📷
              </span>
              <p className="text-xs font-medium text-zinc-300">Camera preview</p>
              <p className="text-[11px] text-zinc-500">Allow camera for a live feed, or use the placeholder.</p>
            </div>
          )}
          {working && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
              <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-zinc-800 shadow">
                Recognizing…
              </span>
            </div>
          )}
        </div>

        <div className="flex min-h-[120px] flex-col rounded-xl bg-zinc-50/90 p-4 ring-1 ring-zinc-100">
          <p className="text-xs font-medium text-zinc-500">Recognized text</p>
          <div className="mt-2 min-h-[3rem] text-lg leading-relaxed text-zinc-900">
            {recognizedText ? (
              <TypingText key={typingKey} text={recognizedText} className="animate-fade-in" />
            ) : (
              <span className="text-zinc-400">
                Capture a sign gesture — recognition runs locally in this demo.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 justify-end">
        <button
          type="button"
          disabled={demoEnabled || working}
          onClick={onCapture}
          className="rounded-xl border border-zinc-200 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {working ? 'Capturing…' : 'Capture Sign'}
        </button>
      </div>
    </section>
  )
}
