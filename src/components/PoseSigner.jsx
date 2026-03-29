import { useEffect, useRef, useState } from 'react'

let poseViewerDefined = false

async function ensurePoseViewer() {
  if (poseViewerDefined) return
  const { defineCustomElements, setAssetPath } = await import('pose-viewer/loader')
  if (typeof setAssetPath === 'function') {
    setAssetPath(import.meta.url)
  }
  defineCustomElements()
  poseViewerDefined = true
}

export default function PoseSigner({ src, phrase, loading, demoMode = false }) {
  const viewerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false

    ensurePoseViewer()
      .then(() => {
        if (!cancelled) {
          setReady(true)
          setLoadError('')
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error?.message || 'Could not load pose viewer')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !ready || !src) return

    viewer.setAttribute('src', src)
    viewer.setAttribute('autoplay', 'true')
    viewer.setAttribute('loop', 'true')
    viewer.setAttribute('background', '#232527')
    viewer.setAttribute('thickness', '1')
    viewer.setAttribute('width', '768px')
    viewer.setAttribute('height', '768px')
    viewer.style.display = 'block'
    viewer.style.width = '100%'
    viewer.style.height = '100%'
  }, [ready, src])

  return (
    <div
      className="relative flex min-h-[360px] w-full flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#1f2124] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
      role="region"
      aria-label="Signed pose viewer"
    >
      <div className="relative z-10 flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Pose Signer</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-100">
            Signed pose output
            {demoMode ? (
              <span className="ml-2 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
                Demo
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="relative flex min-h-[280px] flex-1 items-center justify-center overflow-hidden bg-[#232527]">
        {ready ? (
          <pose-viewer
            ref={viewerRef}
            src={src}
            autoplay="true"
            loop="true"
            background="#232527"
            thickness="1"
            width="768px"
            height="768px"
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        ) : null}

        {!src && !loading ? (
          <p className="px-6 text-center text-sm text-zinc-500">
            Type text and press `Sign text` to render the full signed pose sequence.
          </p>
        ) : null}

        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-indigo-400" />
            <p className="text-xs font-medium text-zinc-300">Loading signed pose sequence...</p>
          </div>
        ) : null}

        {loadError ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-300">
            {loadError}
          </div>
        ) : null}
      </div>

      <div className="relative z-10 border-t border-white/10 px-4 py-3 text-sm text-zinc-400 sm:px-5">
        {phrase || 'Waiting for text...'}
      </div>
    </div>
  )
}
