import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * @typedef {'idle' | 'requesting' | 'live' | 'error' | 'unsupported'} CameraHookStatus
 */

function mapGetUserMediaError(err) {
  const name = err?.name || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      code: 'not_allowed',
      message: 'Camera permission denied. Allow access in your browser settings and try again.',
    }
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: 'not_found',
      message: 'No webcam detected. You can still run recognition for the demo.',
    }
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: 'not_readable',
      message: 'Camera is in use by another app or cannot be started.',
    }
  }
  if (name === 'OverconstrainedError') {
    return {
      code: 'overconstrained',
      message: 'Camera does not support the requested settings.',
    }
  }
  return {
    code: 'unknown',
    message: err?.message || 'Camera could not be opened.',
  }
}

/**
 * Webcam stream with cleanup. Attach `videoRef` to `<video ref={videoRef} muted playsInline autoPlay />`.
 */
export function useCamera() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState(/** @type {CameraHookStatus} */ ('requesting'))
  const [error, setError] = useState(/** @type {{ code: string; message: string } | null} */ (null))
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    function stopTracks() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      const el = videoRef.current
      if (el) el.srcObject = null
    }

    async function open() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setStatus('unsupported')
          setError({
            code: 'unsupported',
            message:
              'This browser does not support camera access. Use Chrome, Edge, or Safari on HTTPS or localhost.',
          })
        }
        return
      }

      if (!cancelled) {
        setStatus('requesting')
        setError(null)
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        setStatus('live')

        const bind = () => {
          const el = videoRef.current
          if (el && streamRef.current) {
            el.srcObject = streamRef.current
            el.play().catch(() => {})
          }
        }
        bind()
        window.requestAnimationFrame(bind)
      } catch (e) {
        if (cancelled) return
        stopTracks()
        setError(mapGetUserMediaError(e))
        setStatus('error')
      }
    }

    open()

    return () => {
      cancelled = true
      stopTracks()
    }
  }, [retryToken])

  const retry = useCallback(() => {
    setRetryToken((n) => n + 1)
  }, [])

  return {
    videoRef,
    status,
    error,
    isLive: status === 'live',
    retry,
  }
}
