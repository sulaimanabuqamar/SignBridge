import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera } from '../hooks/useCamera'
import { detectHands } from '../utils/handLandmarker'
import { clearOverlay, drawHandOverlay } from '../utils/handOverlay'
import { recognizeHandCapture } from '../utils/handRecognition'
import { SIGN_LANGUAGE_OPTIONS, SPOKEN_LANGUAGE_OPTIONS } from '../utils/signTextTranslate'
import TypingText from './TypingText'

const LIVE_TRANSCRIPTION_INTERVAL_MS = 800
const MIN_HISTORY_FRAMES = 5
const REQUIRED_CONSISTENT_MATCHES = 2

/**
 * @param {{
 *   recognizedText: string
 *   typingKey: number
 *   demoEnabled: boolean
 *   demoSignBusy: boolean
 *   recognitionMeta: { confidence: number; source: string } | null
 *   onSignResult: (result: { text: string; confidence: number; source: string; timestamp: number }) => void
 *   ttsEnabled: boolean
 *   onTtsChange: (v: boolean) => void
 *   signSourceLanguage: string
 *   onSignSourceLanguageChange: (v: string) => void
 *   signOutputLanguage: string
 *   onSignOutputLanguageChange: (v: string) => void
 * }} props
 */
export default function SignToText({
  recognizedText,
  typingKey,
  demoEnabled,
  demoSignBusy,
  recognitionMeta,
  onSignResult,
  ttsEnabled,
  onTtsChange,
  signSourceLanguage,
  onSignSourceLanguageChange,
  signOutputLanguage,
  onSignOutputLanguageChange,
}) {
  const [captureActive, setCaptureActive] = useState(false)
  const { videoRef, status: cameraStatus, error: cameraError, isLive, retry } = useCamera({
    enabled: captureActive && !demoEnabled,
  })

  const overlayRef = useRef(null)
  const historyRef = useRef([])
  const lastTranscriptRef = useRef('')
  const lastEmitTimeRef = useRef(0)
  const liveAttemptRef = useRef(0)
  const pendingResultRef = useRef({ text: '', count: 0 })

  const [trackingReady, setTrackingReady] = useState(false)
  const [trackingError, setTrackingError] = useState('')
  const [transcriptStatus, setTranscriptStatus] = useState('Idle')
  const [handCount, setHandCount] = useState(0)

  const cameraBroken = cameraStatus === 'error' || cameraStatus === 'unsupported'

  const resetSessionState = useCallback(() => {
    historyRef.current = []
    lastTranscriptRef.current = ''
    lastEmitTimeRef.current = 0
    liveAttemptRef.current = 0
    pendingResultRef.current = { text: '', count: 0 }
    setTrackingReady(false)
    setTrackingError('')
    setHandCount(0)
  }, [])

  const startCapture = useCallback(() => {
    if (demoSignBusy) return
    resetSessionState()
    setTranscriptStatus('Opening camera...')
    setCaptureActive(true)
  }, [demoSignBusy, resetSessionState])

  const stopCapture = useCallback(() => {
    setCaptureActive(false)
    resetSessionState()
    setTranscriptStatus('Idle')
    clearOverlay(overlayRef.current)
  }, [resetSessionState])

  useEffect(() => {
    if (!demoEnabled) return undefined

    setCaptureActive(false)
    resetSessionState()
    setTranscriptStatus('Demo mode')
    clearOverlay(overlayRef.current)

    return undefined
  }, [demoEnabled, resetSessionState])

  useEffect(() => {
    if (!captureActive) return undefined

    if (cameraStatus === 'requesting') {
      setTranscriptStatus('Opening camera...')
    } else if (cameraStatus === 'live' && !trackingReady) {
      setTranscriptStatus('Camera live, starting hand tracking...')
    } else if (cameraStatus === 'error' || cameraStatus === 'unsupported') {
      setTranscriptStatus('Camera unavailable')
    }

    return undefined
  }, [cameraStatus, captureActive, trackingReady])

  useEffect(() => {
    const video = videoRef.current
    const overlay = overlayRef.current

    if (!captureActive || demoEnabled || !video || !overlay || !isLive) {
      clearOverlay(overlay)
      return undefined
    }

    let disposed = false
    let rafId = 0

    const syncCanvasSize = () => {
      const width = video.videoWidth || 640
      const height = video.videoHeight || 480
      if (overlay.width !== width) overlay.width = width
      if (overlay.height !== height) overlay.height = height
    }

    const tick = async () => {
      if (disposed) return

      syncCanvasSize()

      try {
        const detection = await detectHands(video, performance.now())
        if (disposed) return

        const timestamp = detection?.timestamp ?? performance.now()
        const handsDetected = detection?.landmarks?.length || 0
        setHandCount(handsDetected)
        setTrackingReady(handsDetected > 0)
        setTrackingError('')

        if (handsDetected > 0) {
          historyRef.current = [
            ...historyRef.current.filter((entry) => timestamp - entry.timestamp <= 1800),
            { ...detection, timestamp },
          ].slice(-18)
          setTranscriptStatus('Hands detected, transcribing live...')
        } else {
          historyRef.current = historyRef.current.filter((entry) => timestamp - entry.timestamp <= 1000)
          setTranscriptStatus('Show your hands to the camera...')
        }

        drawHandOverlay(overlay, detection)

        if (
          handsDetected > 0 &&
          historyRef.current.length >= MIN_HISTORY_FRAMES &&
          timestamp - lastEmitTimeRef.current >= LIVE_TRANSCRIPTION_INTERVAL_MS
        ) {
          liveAttemptRef.current += 1
          const result = recognizeHandCapture({
            detection,
            history: historyRef.current,
            demoMode: false,
          })

          lastEmitTimeRef.current = timestamp

          if (result?.text) {
            if (pendingResultRef.current.text === result.text) {
              pendingResultRef.current.count += 1
            } else {
              pendingResultRef.current = { text: result.text, count: 1 }
            }

            if (
              pendingResultRef.current.count >= REQUIRED_CONSISTENT_MATCHES &&
              result.text !== lastTranscriptRef.current
            ) {
              lastTranscriptRef.current = result.text
              setTranscriptStatus('Live transcription active')
              onSignResult(result)
            } else {
              setTranscriptStatus('Matching sign, verifying...')
            }
          } else {
            pendingResultRef.current = { text: '', count: 0 }
            if (handsDetected > 0) {
              setTranscriptStatus('Hands detected, waiting for a clearer sign...')
            }
          }
        }
      } catch (error) {
        if (!disposed) {
          setTrackingReady(false)
          setTrackingError(error?.message || 'Hand tracking unavailable')
          setTranscriptStatus('Tracking unavailable')
          clearOverlay(overlay)
        }
      }

      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)

    return () => {
      disposed = true
      window.cancelAnimationFrame(rafId)
      historyRef.current = []
      clearOverlay(overlay)
    }
  }, [captureActive, demoEnabled, isLive, onSignResult, videoRef])

  const cameraLabel =
    !captureActive
      ? 'Camera off until capture starts'
      : cameraStatus === 'requesting'
        ? 'Starting camera...'
        : cameraStatus === 'live'
          ? 'Realtime capture active'
          : cameraBroken
            ? 'Camera unavailable'
            : 'Camera'

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
      <header className="flex flex-shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Deaf / hard-of-hearing participant
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Sign -&gt; Text</h2>
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

      <div className="grid flex-shrink-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2">
          {SIGN_LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSignSourceLanguageChange(option.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                signSourceLanguage === option.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center text-zinc-400" aria-hidden>
          ↔
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2">
          {SPOKEN_LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSignOutputLanguageChange(option.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                signOutputLanguage === option.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,220px)_1fr]">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 shadow-inner ring-1 ring-zinc-800/20 md:aspect-auto md:min-h-[180px]">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: captureActive && isLive ? 1 : 0 }}
            autoPlay
            playsInline
            muted
          />

          <canvas
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            aria-hidden
          />

          {!captureActive ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-zinc-800 to-zinc-950 p-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/90 ring-1 ring-white/15">
                Cam
              </div>
              <p className="text-sm font-semibold text-zinc-200">Camera stays off until you start capture</p>
              <p className="max-w-[220px] text-[11px] leading-relaxed text-zinc-400">
                Start capture when you are ready to sign. We will open the camera and keep transcribing while your hands stay in frame.
              </p>
            </div>
          ) : null}

          {captureActive && cameraStatus === 'requesting' ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-zinc-800 to-zinc-950">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-indigo-400" />
              <p className="text-xs font-medium text-zinc-300">Connecting to camera...</p>
            </div>
          ) : null}

          {captureActive && cameraBroken ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-zinc-800 to-zinc-950 p-4 text-center">
              <span className="text-2xl opacity-90" aria-hidden>
                Camera
              </span>
              <p className="text-sm font-semibold text-zinc-200">
                {cameraStatus === 'unsupported' ? 'Camera not supported' : 'Camera unavailable'}
              </p>
              <p className="max-w-[200px] text-[11px] leading-relaxed text-zinc-400">{cameraError?.message}</p>
              {cameraStatus === 'error' ? (
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
                >
                  Retry camera
                </button>
              ) : null}
            </div>
          ) : null}

          {captureActive && isLive ? (
            <div className="pointer-events-none absolute left-2 top-2 z-30 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm ring-1 ring-white/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Live
            </div>
          ) : null}

          {captureActive && isLive && !demoEnabled ? (
            <div className="pointer-events-none absolute right-2 top-2 z-30 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/10">
              {trackingReady ? 'Hands live' : trackingError ? 'Tracking error' : 'Starting tracking'}
            </div>
          ) : null}

          {demoSignBusy && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px]">
              <div className="mb-3 h-12 w-12 animate-spin rounded-full border-2 border-indigo-300/40 border-t-indigo-400" />
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow">
                Demo recognition...
              </span>
            </div>
          )}
        </div>

        <div className="flex min-h-[120px] flex-col rounded-xl bg-zinc-50/90 p-4 ring-1 ring-zinc-100">
          <p className="text-xs font-medium text-zinc-500">Recognized text</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            {SPOKEN_LANGUAGE_OPTIONS.find((option) => option.value === signOutputLanguage)?.label || 'English'}
          </p>
          <p className="mt-2 text-[11px] font-medium text-indigo-600">{transcriptStatus}</p>
          <div className="mt-2 min-h-[3rem] text-lg leading-relaxed text-zinc-900">
            {recognizedText ? (
              <TypingText key={typingKey} text={recognizedText} className="animate-fade-in" />
            ) : (
              <span className="text-zinc-400">
                Start capture to open the camera only when needed, then keep signing while we update the transcript in realtime.
              </span>
            )}
          </div>
          {recognitionMeta ? (
            <p className="mt-2 text-[11px] text-zinc-500">
              {Math.round(recognitionMeta.confidence * 100)}% confidence ·{' '}
              <span className="font-medium text-zinc-600">{formatSource(recognitionMeta.source)}</span>
            </p>
          ) : null}
          {captureActive ? (
            <p className="mt-1 text-[11px] text-zinc-500">Hands in frame: {handCount}</p>
          ) : null}
          {trackingError ? <p className="mt-1 text-[11px] text-amber-600">{trackingError}</p> : null}
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          {captureActive ? (
            <button
              type="button"
              onClick={stopCapture}
              className="rounded-xl border border-red-200 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-red-500"
            >
              Stop Capture
            </button>
          ) : (
            <button
              type="button"
              disabled={demoSignBusy}
              onClick={startCapture}
              className="rounded-xl border border-zinc-200 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start Capture
            </button>
          )}
        </div>
        <p className="max-w-sm text-right text-[10px] text-zinc-400">{cameraLabel}</p>
      </div>
    </section>
  )
}

function formatSource(source) {
  if (source === 'demo_inference') return 'Demo inference'
  if (source === 'camera_inference') return 'Camera inference'
  if (source.startsWith('hand_landmarker_sequence_')) return 'Live hand landmark sequence'
  if (source.startsWith('hand_landmarker_')) return 'MediaPipe hand landmarks'
  if (source.startsWith('holistic_')) return 'MediaPipe holistic landmarks'
  return source
}
