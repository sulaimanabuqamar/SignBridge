import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera } from '../hooks/useCamera'
import { detectHands } from '../utils/handLandmarker'
import { clearOverlay, drawHandOverlay } from '../utils/handOverlay'
import { recognizeHandCapture } from '../utils/handRecognition'
import TypingText from './TypingText'

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function processingDelay() {
  return 600 + Math.random() * 500
}

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
}) {
  const { videoRef, status: cameraStatus, error: cameraError, isLive, retry } = useCamera()
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const captureIndexRef = useRef(0)
  const detectionRef = useRef(null)

  const [capturePhase, setCapturePhase] = useState(/** @type {'idle' | 'capturing' | 'processing'} */ ('idle'))
  const [previewUrl, setPreviewUrl] = useState(/** @type {string | null} */ (null))
  const [trackingReady, setTrackingReady] = useState(false)
  const [trackingError, setTrackingError] = useState('')

  const busy = capturePhase !== 'idle' || demoSignBusy
  const cameraBroken = cameraStatus === 'error' || cameraStatus === 'unsupported'

  const runCapture = useCallback(async () => {
    if (busy) return

    const video = videoRef.current
    const hasFrame = isLive && video && video.readyState >= 2 && video.videoWidth > 0

    setCapturePhase('capturing')
    setPreviewUrl(null)

    let imageData = null
    const canvas = canvasRef.current
    if (hasFrame && canvas) {
      const vw = video.videoWidth
      const vh = video.videoHeight
      canvas.width = vw
      canvas.height = vh
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(video, 0, 0, vw, vh)
        try {
          imageData = ctx.getImageData(0, 0, vw, vh)
        } catch {
          imageData = null
        }
        try {
          setPreviewUrl(canvas.toDataURL('image/jpeg', 0.72))
        } catch {
          setPreviewUrl(null)
        }
      }
    }

    await delay(220)
    setCapturePhase('processing')

    await delay(processingDelay())

    const idx = captureIndexRef.current
    captureIndexRef.current += 1

    const result = recognizeHandCapture({
      detection: detectionRef.current,
      imageData,
      demoMode: demoEnabled,
      captureIndex: idx,
      hasLiveVideo: Boolean(hasFrame),
    })

    onSignResult(result)

    setCapturePhase('idle')
    window.setTimeout(() => setPreviewUrl(null), 1600)
  }, [busy, demoEnabled, isLive, onSignResult, videoRef])

  useEffect(() => {
    return () => setPreviewUrl(null)
  }, [])

  useEffect(() => {
    if (demoEnabled) {
      detectionRef.current = null
      setTrackingReady(false)
      setTrackingError('')
      clearOverlay(overlayRef.current)
      return undefined
    }

    const video = videoRef.current
    const overlay = overlayRef.current
    if (!video || !overlay || !isLive) return undefined

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
        detectionRef.current = detection
        drawHandOverlay(overlay, detection)
        setTrackingReady(Boolean(detection))
        setTrackingError('')
      } catch (error) {
        if (!disposed) {
          setTrackingReady(false)
          setTrackingError(error?.message || 'Hand tracking unavailable')
          clearOverlay(overlay)
        }
      }

      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)

    return () => {
      disposed = true
      window.cancelAnimationFrame(rafId)
      clearOverlay(overlay)
    }
  }, [demoEnabled, isLive, videoRef])

  const cameraLabel =
    cameraStatus === 'requesting'
      ? 'Starting camera…'
      : cameraStatus === 'live'
        ? 'Live camera'
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
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 shadow-inner ring-1 ring-zinc-800/20 md:aspect-auto md:min-h-[180px]">
          <canvas ref={canvasRef} className="hidden" aria-hidden />

          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: isLive ? 1 : 0 }}
            autoPlay
            playsInline
            muted
          />

          <canvas
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            aria-hidden
          />

          {cameraStatus === 'requesting' ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-zinc-800 to-zinc-950">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-indigo-400" />
              <p className="text-xs font-medium text-zinc-300">Connecting to camera…</p>
            </div>
          ) : null}

          {cameraBroken ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-zinc-800 to-zinc-950 p-4 text-center">
              <span className="text-2xl opacity-90" aria-hidden>
                📷
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
              <p className="text-[10px] text-zinc-500">Capture Sign still runs using demo inference.</p>
            </div>
          ) : null}

          {isLive ? (
            <div className="pointer-events-none absolute left-2 top-2 z-30 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm ring-1 ring-white/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Live
            </div>
          ) : null}

          {isLive && !demoEnabled ? (
            <div className="pointer-events-none absolute right-2 top-2 z-30 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/10">
              {trackingReady ? 'Hand tracking live' : trackingError ? 'Tracking error' : 'Starting tracking'}
            </div>
          ) : null}

          {previewUrl ? (
            <div className="pointer-events-none absolute bottom-2 right-2 z-30 overflow-hidden rounded-lg shadow-lg ring-2 ring-indigo-400/60 transition-opacity duration-300">
              <img src={previewUrl} alt="" className="h-14 w-24 object-cover opacity-95" />
              <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[9px] font-medium text-white">
                Captured frame
              </span>
            </div>
          ) : null}

          {(capturePhase === 'capturing' || capturePhase === 'processing' || demoSignBusy) && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px]">
              <div className="mb-3 h-12 w-12 animate-spin rounded-full border-2 border-indigo-300/40 border-t-indigo-400" />
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow">
                {demoSignBusy ? 'Demo recognition…' : capturePhase === 'capturing' ? 'Capturing frame…' : 'Analyzing sign…'}
              </span>
              <div className="mt-4 h-0.5 w-40 overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-full origin-left animate-pulse bg-indigo-400/80" />
              </div>
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
                Capture a sign gesture — we analyze a video frame locally for this demo.
              </span>
            )}
          </div>
          {recognitionMeta ? (
            <p className="mt-2 text-[11px] text-zinc-500">
              {Math.round(recognitionMeta.confidence * 100)}% confidence ·{' '}
              <span className="font-medium text-zinc-600">{formatSource(recognitionMeta.source)}</span>
            </p>
          ) : null}
          {trackingError ? <p className="mt-1 text-[11px] text-amber-600">{trackingError}</p> : null}
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={runCapture}
          className="rounded-xl border border-zinc-200 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? demoSignBusy
              ? 'Processing…'
              : capturePhase === 'capturing'
                ? 'Capturing…'
                : 'Processing…'
            : 'Capture Sign'}
        </button>
        <p className="max-w-sm text-right text-[10px] text-zinc-400">{cameraLabel}</p>
      </div>
    </section>
  )
}

function formatSource(source) {
  if (source === 'demo_inference') return 'Demo inference'
  if (source === 'camera_inference') return 'Camera inference'
  if (source.startsWith('hand_landmarker')) return 'MediaPipe hand landmarks'
  return source
}
