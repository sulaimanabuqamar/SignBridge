import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  SEQUENCE_TAIL_MS,
  beatDelay,
  resolveMotionForWord,
  splitGlossWords,
} from '../utils/avatarMotion'

const PHASE_LABEL = {
  idle: 'Idle',
  preparing: 'Preparing sign…',
  signing: 'Signing now',
}

/** @typedef {import('../utils/avatarMotion').MotionKind | 'idle'} MotionState */

/**
 * SVG transform presets — shoulders ~ (72,122) left, (128,122) right
 */
function useFigureTransforms(motion) {
  return useMemo(() => {
    const base = {
      head: 'rotate(0deg) translate(0,0)',
      torso: 'translate(0,0)',
      eye: 'translate(0,0)',
      armL: 'rotate(8deg)',
      armR: 'rotate(-8deg)',
      handL: 'translate(0,0)',
      handR: 'translate(0,0)',
    }
    switch (motion) {
      case 'idle':
        return base
      case 'up':
        return {
          ...base,
          head: 'rotate(-4deg) translate(0,-2px)',
          armL: 'rotate(-58deg)',
          armR: 'rotate(58deg)',
          eye: 'translate(0,-0.5px)',
        }
      case 'push':
        return {
          ...base,
          head: 'rotate(2deg) translate(2px,0)',
          torso: 'translate(0,-4px) scale(1.02)',
          armL: 'rotate(-35deg) translate(-4px,6px)',
          armR: 'rotate(35deg) translate(4px,6px)',
        }
      case 'tap':
        return {
          ...base,
          head: 'rotate(3deg)',
          armL: 'rotate(22deg)',
          armR: 'rotate(-42deg) translate(0,10px)',
          handR: 'translate(0,4px)',
        }
      case 'sweep':
        return {
          ...base,
          head: 'rotate(-3deg)',
          armL: 'rotate(-25deg) translate(-10px,-4px)',
          armR: 'rotate(25deg) translate(10px,-4px)',
          eye: 'translate(2px,0)',
        }
      case 'wave':
        return {
          ...base,
          head: 'rotate(-2deg)',
          armL: 'rotate(-12deg)',
          armR: 'rotate(-55deg) translate(4px,-6px)',
        }
      default:
        return base
    }
  }, [motion])
}

export default function GeneratedAvatar({
  phrase,
  gloss,
  phase = 'idle',
  playbackKey = 0,
  demoMode = false,
  onPlaybackEnd,
}) {
  const isSigning = phase === 'signing'
  const isPreparing = phase === 'preparing'

  const [motion, setMotion] = useState(/** @type {MotionState} */ ('idle'))
  const [wordIndex, setWordIndex] = useState(-1)
  const [sequenceProgress, setSequenceProgress] = useState(0)

  const words = useMemo(() => splitGlossWords(gloss), [gloss])
  const transforms = useFigureTransforms(motion === 'idle' ? 'idle' : motion)

  const timersRef = useRef([])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
  }, [])

  useEffect(() => {
    clearTimers()
    let cancelled = false

    const boot = window.setTimeout(() => {
      setMotion('idle')
      setWordIndex(-1)
      setSequenceProgress(0)

      if (!isSigning || words.length === 0) return

      let t = 60

      words.forEach((word, i) => {
        const id = window.setTimeout(() => {
          if (cancelled) return
          setMotion(resolveMotionForWord(word))
          setWordIndex(i)
          setSequenceProgress((i + 1) / words.length)
        }, t)
        timersRef.current.push(id)
        if (i < words.length - 1) t += beatDelay()
      })

      const endId = window.setTimeout(() => {
        if (cancelled) return
        setMotion('idle')
        setWordIndex(-1)
        setSequenceProgress(1)
        onPlaybackEnd?.()
      }, t + SEQUENCE_TAIL_MS)
      timersRef.current.push(endId)
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(boot)
      clearTimers()
    }
  }, [isSigning, gloss, playbackKey, words, onPlaybackEnd, clearTimers])

  const statusLabel = PHASE_LABEL[phase] ?? PHASE_LABEL.idle
  const showFigure = !isPreparing

  return (
    <div
      className="relative flex min-h-[280px] w-full flex-col overflow-hidden rounded-2xl border border-zinc-800/60 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] transition-opacity duration-500 animate-fade-in"
      role="region"
      aria-label="Generated signing avatar"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(79,70,229,0.2),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgba(255,255,255,0.06),transparent_45%)]" />

      <div className="relative z-10 flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Generated Signer
          </p>
          <p className="mt-0.5 text-sm font-medium text-zinc-100">
            AI-style motion from gloss
            {demoMode ? (
              <span className="ml-2 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
                Demo
              </span>
            ) : null}
          </p>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            phase === 'signing'
              ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40'
              : phase === 'preparing'
                ? 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/35'
                : 'bg-zinc-700/50 text-zinc-300 ring-1 ring-white/10'
          }`}
        >
          {statusLabel}
        </div>
      </div>

      <div className="relative z-10 grid min-h-[220px] flex-1 grid-cols-1 gap-4 p-4 sm:min-h-[260px] sm:grid-cols-[1fr_200px] sm:p-5">
        <div className="relative flex min-h-[200px] items-center justify-center overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
          {isPreparing ? <PreparingOverlay /> : null}

          {showFigure ? (
            <div
              className={`relative flex h-full w-full max-w-[320px] items-end justify-center pb-4 ${
                phase === 'idle' ? 'ga-breathe' : ''
              }`}
            >
              <svg
                viewBox="0 0 200 280"
                className="h-[min(100%,320px)] w-full max-w-[280px] drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)]"
                aria-hidden
              >
                <defs>
                  <linearGradient id="ga-skin" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#e8dccf" />
                    <stop offset="100%" stopColor="#c9b8a8" />
                  </linearGradient>
                  <linearGradient id="ga-shirt" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#312e81" />
                  </linearGradient>
                </defs>

                <g
                  style={{
                    transform: transforms.torso,
                    transformOrigin: '100px 150px',
                    transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <ellipse cx="100" cy="78" rx="30" ry="34" fill="url(#ga-skin)" />
                  <g
                    style={{
                      transform: transforms.head,
                      transformOrigin: '100px 78px',
                      transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <g
                      style={{
                        transform: transforms.eye,
                        transformOrigin: '100px 74px',
                        transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <ellipse cx="92" cy="74" rx="3" ry="2.5" fill="#1e1b18" />
                      <ellipse cx="108" cy="74" rx="3" ry="2.5" fill="#1e1b18" />
                    </g>
                    <path
                      d="M 94 88 Q 100 92 106 88"
                      stroke="#a89080"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                  </g>

                  <path
                    d="M 78 118 L 72 175 Q 70 195 68 210"
                    stroke="url(#ga-skin)"
                    strokeWidth="14"
                    strokeLinecap="round"
                    fill="none"
                    style={{
                      transform: transforms.armL,
                      transformOrigin: '78px 118px',
                      transition: 'transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                  <path
                    d="M 122 118 L 128 175 Q 130 195 132 210"
                    stroke="url(#ga-skin)"
                    strokeWidth="14"
                    strokeLinecap="round"
                    fill="none"
                    style={{
                      transform: transforms.armR,
                      transformOrigin: '122px 118px',
                      transition: 'transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />

                  <circle
                    cx="66"
                    cy="212"
                    r="10"
                    fill="url(#ga-skin)"
                    style={{
                      transform: transforms.handL,
                      transformOrigin: '66px 212px',
                      transition: 'transform 0.35s ease-out',
                    }}
                  />
                  <circle
                    cx="134"
                    cy="212"
                    r="10"
                    fill="url(#ga-skin)"
                    style={{
                      transform: transforms.handR,
                      transformOrigin: '134px 212px',
                      transition: 'transform 0.35s ease-out',
                    }}
                  />

                  <path
                    d="M 72 118 Q 100 128 128 118 L 125 175 Q 100 188 75 175 Z"
                    fill="url(#ga-shirt)"
                  />
                  <path
                    d="M 82 175 Q 100 205 118 175 L 115 248 Q 100 258 85 248 Z"
                    fill="#1e1b18"
                    opacity="0.92"
                  />
                </g>
              </svg>

              {isSigning && words.length > 0 ? (
                <div className="pointer-events-none absolute inset-x-6 bottom-3 flex flex-col gap-1">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-indigo-400/90 transition-[width] duration-300 ease-out"
                      style={{ width: `${Math.round(sequenceProgress * 100)}%` }}
                    />
                  </div>
                  <p className="text-center font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-200/90">
                    {motion === 'idle' ? 'Finishing…' : `${motion} · beat ${Math.max(0, wordIndex + 1)}/${words.length}`}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isPreparing && phase === 'idle' ? (
            <IdleHint hasGloss={Boolean(gloss)} />
          ) : null}
        </div>

        <aside className="flex flex-col justify-center gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Live gloss
            </p>
            <p className="mt-1 font-mono text-lg font-semibold leading-snug tracking-wide text-white">
              {gloss ? <GlossWords gloss={gloss} activeIndex={wordIndex} /> : '—'}
            </p>
          </div>
          <div className="h-px w-full bg-white/10" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Phrase
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">
              {phrase || <span className="text-zinc-600">Waiting for speech…</span>}
            </p>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Motions are synthesized from gloss words for demo clarity — not a substitute for a human
            interpreter.
          </p>
        </aside>
      </div>
    </div>
  )
}

function GlossWords({ gloss, activeIndex }) {
  const parts = useMemo(() => splitGlossWords(gloss), [gloss])
  return (
    <span className="break-words">
      {parts.map((w, i) => (
        <span key={`${w}-${i}`}>
          <span
            className={
              i === activeIndex
                ? 'rounded bg-indigo-500/35 px-1 text-white ring-1 ring-indigo-300/50'
                : ''
            }
          >
            {w}
          </span>
          {i < parts.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}

function PreparingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-zinc-950/95 to-black/90 px-6 text-center">
      <div className="ga-prepare-ring relative flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-indigo-500/25 blur-xl ga-prepare-pulse" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/90 ring-1 ring-white/15">
          <span className="text-2xl" aria-hidden>
            ✋
          </span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-white">Preparing sign…</p>
        <p className="mt-1 text-xs text-zinc-500">Building motion sequence from gloss</p>
      </div>
    </div>
  )
}

function IdleHint({ hasGloss }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 px-6 text-center">
      <p className="text-xs text-zinc-500">
        {hasGloss
          ? 'Idle — next utterance will drive a new motion sequence.'
          : 'Speak or choose a phrase. The signer animates from gloss in real time.'}
      </p>
    </div>
  )
}
