import { useEffect, useMemo, useRef, useState } from 'react'
import { SEQUENCE_TAIL_MS, beatDelay, resolveMotionForWord, splitGlossWords } from '../utils/avatarMotion'

const PHASE_LABEL = {
  idle: 'Idle',
  preparing: 'Preparing sign...',
  signing: 'Signing now',
}

const BASE_POSE = {
  leftShoulder: { x: 172, y: 268 },
  rightShoulder: { x: 308, y: 268 },
  leftElbow: { x: 148, y: 368 },
  rightElbow: { x: 332, y: 368 },
  leftHand: { x: 138, y: 478 },
  rightHand: { x: 342, y: 478 },
}

const SIGN_POSES = {
  idle: BASE_POSE,
  HELLO: {
    ...BASE_POSE,
    rightElbow: { x: 322, y: 220 },
    rightHand: { x: 298, y: 170 },
  },
  'THANK-YOU': {
    ...BASE_POSE,
    rightElbow: { x: 300, y: 250 },
    rightHand: { x: 270, y: 220 },
    leftElbow: { x: 160, y: 340 },
    leftHand: { x: 150, y: 425 },
  },
  PLEASE: {
    ...BASE_POSE,
    rightElbow: { x: 286, y: 300 },
    rightHand: { x: 258, y: 318 },
  },
  REPEAT: {
    ...BASE_POSE,
    rightElbow: { x: 282, y: 286 },
    rightHand: { x: 244, y: 300 },
    leftElbow: { x: 178, y: 296 },
    leftHand: { x: 212, y: 304 },
  },
  HELP: {
    ...BASE_POSE,
    leftElbow: { x: 188, y: 304 },
    leftHand: { x: 222, y: 296 },
    rightElbow: { x: 280, y: 304 },
    rightHand: { x: 244, y: 296 },
  },
  ME: {
    ...BASE_POSE,
    rightElbow: { x: 284, y: 300 },
    rightHand: { x: 252, y: 326 },
  },
  YOU: {
    ...BASE_POSE,
    rightElbow: { x: 286, y: 284 },
    rightHand: { x: 232, y: 286 },
  },
  REPORT: {
    ...BASE_POSE,
    rightElbow: { x: 280, y: 320 },
    rightHand: { x: 254, y: 348 },
    leftElbow: { x: 182, y: 322 },
    leftHand: { x: 212, y: 352 },
  },
  SEND: {
    ...BASE_POSE,
    rightElbow: { x: 274, y: 304 },
    rightHand: { x: 210, y: 286 },
  },
  TOMORROW: {
    ...BASE_POSE,
    rightElbow: { x: 316, y: 216 },
    rightHand: { x: 282, y: 148 },
  },
  BATHROOM: {
    ...BASE_POSE,
    rightElbow: { x: 286, y: 308 },
    rightHand: { x: 292, y: 338 },
  },
  WHERE: {
    ...BASE_POSE,
    leftElbow: { x: 184, y: 256 },
    leftHand: { x: 170, y: 220 },
    rightElbow: { x: 296, y: 256 },
    rightHand: { x: 310, y: 220 },
  },
  YES: {
    ...BASE_POSE,
    rightElbow: { x: 288, y: 280 },
    rightHand: { x: 266, y: 248 },
  },
  NO: {
    ...BASE_POSE,
    rightElbow: { x: 292, y: 258 },
    rightHand: { x: 272, y: 230 },
  },
  WAIT: {
    ...BASE_POSE,
    leftElbow: { x: 188, y: 310 },
    leftHand: { x: 206, y: 292 },
    rightElbow: { x: 292, y: 310 },
    rightHand: { x: 274, y: 292 },
  },
}

function mixPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  }
}

function normalizeEntry(entry) {
  if (!entry) return { label: 'IDLE' }
  return {
    ...entry,
    label: String(entry.label || entry.motion || 'IDLE').toUpperCase(),
  }
}

export default function LineSignAvatar({
  phrase,
  gloss,
  signPlan = [],
  phase = 'idle',
  playbackKey = 0,
  demoMode = false,
  onPlaybackEnd,
}) {
  const [activeIndex, setActiveIndex] = useState(-1)
  const [pose, setPose] = useState(BASE_POSE)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef(0)
  const timeoutRef = useRef([])

  const words = useMemo(() => splitGlossWords(gloss), [gloss])
  const statusLabel = PHASE_LABEL[phase] ?? PHASE_LABEL.idle

  useEffect(() => {
    timeoutRef.current.forEach((id) => window.clearTimeout(id))
    timeoutRef.current = []
    window.cancelAnimationFrame(rafRef.current)

    const plan =
      signPlan.length > 0
        ? signPlan.map(normalizeEntry)
        : words.map((word) => normalizeEntry({ label: word, motion: resolveMotionForWord(word) }))

    if (phase !== 'signing' || plan.length === 0) {
      setActiveIndex(-1)
      setProgress(0)
      animateToPose(BASE_POSE, setPose, rafRef)
      return undefined
    }

    let elapsed = 80

    plan.forEach((entry, index) => {
      const id = window.setTimeout(() => {
        const target = SIGN_POSES[entry.label] ?? SIGN_POSES[entry.motion?.toUpperCase?.()] ?? BASE_POSE
        setActiveIndex(index)
        setProgress((index + 1) / plan.length)
        animateToPose(target, setPose, rafRef)
      }, elapsed)

      timeoutRef.current.push(id)
      if (index < plan.length - 1) elapsed += beatDelay()
    })

    const endId = window.setTimeout(() => {
      setActiveIndex(-1)
      setProgress(1)
      animateToPose(BASE_POSE, setPose, rafRef)
      onPlaybackEnd?.()
    }, elapsed + SEQUENCE_TAIL_MS)

    timeoutRef.current.push(endId)

    return () => {
      timeoutRef.current.forEach((id) => window.clearTimeout(id))
      window.cancelAnimationFrame(rafRef.current)
    }
  }, [gloss, onPlaybackEnd, phase, playbackKey, signPlan, words])

  return (
    <div
      className="relative flex min-h-[320px] w-full flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#1f2124] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
      role="region"
      aria-label="Line signing avatar"
    >
      <div className="relative z-10 flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Line Signer</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-100">
            Text-to-sign stage
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

      <div className="relative grid min-h-[260px] flex-1 grid-cols-1 gap-4 p-4 sm:grid-cols-[1fr_220px] sm:p-5">
        <div className="relative overflow-hidden rounded-xl bg-[#232527] ring-1 ring-white/5">
          <svg viewBox="0 0 480 560" className="h-full w-full">
            <g stroke="#d11d0f" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="240" cy="112" rx="44" ry="58" />
              <path d="M220 98 Q205 86 192 98" />
              <path d="M260 98 Q275 86 288 98" />
              <path d="M206 120 Q220 128 232 120" />
              <path d="M248 120 Q260 128 274 120" />
              <path d="M214 154 Q240 176 266 154" />
              <path d="M170 266 L310 266 L292 518 L188 518 Z" />
              <path d={`M${BASE_POSE.leftShoulder.x} ${BASE_POSE.leftShoulder.y} L${pose.leftElbow.x} ${pose.leftElbow.y} L${pose.leftHand.x} ${pose.leftHand.y}`} />
              <path d={`M${BASE_POSE.rightShoulder.x} ${BASE_POSE.rightShoulder.y} L${pose.rightElbow.x} ${pose.rightElbow.y} L${pose.rightHand.x} ${pose.rightHand.y}`} />
              <circle cx={pose.leftHand.x} cy={pose.leftHand.y} r="10" />
              <circle cx={pose.rightHand.x} cy={pose.rightHand.y} r="10" />
            </g>
          </svg>

          {phase === 'preparing' ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 text-sm font-semibold text-zinc-200">
              Preparing sign...
            </div>
          ) : null}

          {phase === 'idle' ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 px-6 text-center">
              <p className="text-xs text-zinc-500">
                {gloss
                  ? 'Ready for the next sign sequence.'
                  : 'Type text on the left and the signer will animate here.'}
              </p>
            </div>
          ) : null}

          {phase === 'signing' ? (
            <div className="pointer-events-none absolute inset-x-5 bottom-3 flex flex-col gap-1">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-indigo-400/90 transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col justify-center gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Live gloss</p>
            <p className="mt-1 font-mono text-lg font-semibold leading-snug tracking-wide text-white">
              {gloss ? <GlossWords words={words} activeIndex={activeIndex} /> : '-'}
            </p>
          </div>
          <div className="h-px w-full bg-white/10" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Phrase</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">
              {phrase || <span className="text-zinc-600">Waiting for text...</span>}
            </p>
          </div>
          <div className="h-px w-full bg-white/10" />
          <p className="text-[11px] leading-relaxed text-zinc-500">
            This is a line-style signer closer to the reference layout, with visible arm and hand poses instead of a floating hand rig.
          </p>
        </aside>
      </div>
    </div>
  )
}

function animateToPose(target, setPose, rafRef) {
  const startTime = performance.now()
  let from = BASE_POSE

  setPose((prev) => {
    from = prev
    return prev
  })

  const step = (now) => {
    const t = Math.min(1, (now - startTime) / 280)
    const eased = 1 - Math.pow(1 - t, 3)
    setPose({
      leftShoulder: mixPoint(from.leftShoulder, target.leftShoulder, eased),
      rightShoulder: mixPoint(from.rightShoulder, target.rightShoulder, eased),
      leftElbow: mixPoint(from.leftElbow, target.leftElbow, eased),
      rightElbow: mixPoint(from.rightElbow, target.rightElbow, eased),
      leftHand: mixPoint(from.leftHand, target.leftHand, eased),
      rightHand: mixPoint(from.rightHand, target.rightHand, eased),
    })
    if (t < 1) {
      rafRef.current = window.requestAnimationFrame(step)
    }
  }

  window.cancelAnimationFrame(rafRef.current)
  rafRef.current = window.requestAnimationFrame(step)
}

function GlossWords({ words, activeIndex }) {
  return (
    <span className="break-words">
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span
            className={
              index === activeIndex
                ? 'rounded bg-indigo-500/35 px-1 text-white ring-1 ring-indigo-300/50'
                : ''
            }
          >
            {word}
          </span>
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}
