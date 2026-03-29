import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  SEQUENCE_TAIL_MS,
  beatDelay,
  resolveMotionForWord,
  splitGlossWords,
} from '../utils/avatarMotion'

// ─── Phase labels ─────────────────────────────────────────────────────────────
const PHASE_LABEL = {
  idle: 'Idle',
  preparing: 'Preparing sign…',
  signing: 'Signing now',
}

// ─── 3D pose library ──────────────────────────────────────────────────────────
// Each entry drives the Hand_Left_30 group node in the loaded GLB.
// rx/ry/rz = Euler rotation (radians); py = vertical position offset.
// These orientations roughly correspond to ASL motion categories:
//   up    → time signs (TOMORROW, NOW): raised palm facing out
//   push  → transfer signs (SEND, GIVE, GO): hand extended forward-right
//   tap   → reference signs (REPORT, TASK): index-point with wrist flexion
//   sweep → social signs (THANK, HELLO, PLEASE): broad lateral sweep
//   wave  → greetings / farewell: oscillating wave
const MOTION_POSES_3D = {
  idle:  { rx:  0.06, ry:  0.0,  rz:  0.0,   py:  0.0  },
  up:    { rx: -0.55, ry:  0.0,  rz:  0.18,  py:  0.13 },
  push:  { rx:  0.18, ry:  0.28, rz:  0.0,   py:  0.0  },
  tap:   { rx:  0.75, ry:  0.06, rz: -0.18,  py: -0.09 },
  sweep: { rx:  0.1,  ry:  0.6,  rz:  0.0,   py:  0.02 },
  wave:  { rx: -0.18, ry:  0.38, rz:  0.38,  py:  0.09 },
}

// Clamp a value toward a target by lerp factor
function lerp(a, b, t) {
  return a + (b - a) * t
}

// ─── Component ────────────────────────────────────────────────────────────────
/**
 * GeneratedAvatar
 * Renders the hand_rig.glb in a Three.js WebGL canvas and drives it via gloss
 * word → motion mapping. Falls back to a clear error state if three is missing
 * or the GLB fails to load.
 *
 * SETUP (once in your project):
 *   1. npm install three
 *   2. Copy hand_rig.glb → public/hand_rig.glb
 */
export default function GeneratedAvatar({
  phrase,
  gloss,
  phase = 'idle',
  playbackKey = 0,
  demoMode = false,
  onPlaybackEnd,
}) {
  const canvasWrapRef = useRef(null)
  const threeRef     = useRef(null)   // mutable Three.js state, NOT React state
  const timersRef    = useRef([])

  const [isLoaded,   setIsLoaded]   = useState(false)
  const [loadError,  setLoadError]  = useState(null)
  const [motion,     setMotion]     = useState('idle')
  const [wordIndex,  setWordIndex]  = useState(-1)
  const [seqProg,    setSeqProg]    = useState(0)

  const isSigning   = phase === 'signing'
  const isPreparing = phase === 'preparing'
  const words       = useMemo(() => splitGlossWords(gloss), [gloss])
  const statusLabel = PHASE_LABEL[phase] ?? PHASE_LABEL.idle

  // ── Three.js init (runs once) ──────────────────────────────────────────────
  useEffect(() => {
    const container = canvasWrapRef.current
    if (!container) return

    let destroyed = false
    let rafId     = null

    async function init() {
      // Dynamic imports so the app still builds even without three installed
      let THREE, GLTFLoader
      try {
        THREE = await import('three')
        ;({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'))
      } catch {
        if (!destroyed)
          setLoadError('Run  npm install three  then restart the dev server.')
        return
      }
      if (destroyed) return

      // ── Renderer ────────────────────────────────────────────────────────
      const w = container.clientWidth  || 400
      const h = container.clientHeight || 300

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(w, h)
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      container.appendChild(renderer.domElement)

      // ── Camera ──────────────────────────────────────────────────────────
      const camera = new THREE.PerspectiveCamera(38, w / h, 0.001, 50)
      camera.position.set(0, 0, 2.4)
      camera.lookAt(0, 0, 0)

      // ── Scene & Lights ──────────────────────────────────────────────────
      const scene = new THREE.Scene()

      // Soft overall fill
      scene.add(new THREE.AmbientLight(0xffffff, 2.2))

      // Warm key from front-left
      const key = new THREE.DirectionalLight(0xfff0d0, 3.8)
      key.position.set(1.5, 2.5, 2.5)
      scene.add(key)

      // Cool blue fill from right
      const fill = new THREE.DirectionalLight(0x99bbff, 1.0)
      fill.position.set(-2, 0.5, 1.5)
      scene.add(fill)

      // Subtle rim from below-back to lift the hand off the dark background
      const rim = new THREE.DirectionalLight(0xffffff, 0.9)
      rim.position.set(0, -1.5, -2)
      scene.add(rim)

      // ── Mutable animation state (written in RAF, read in applyPose) ─────
      const state = {
        renderer, camera, scene,
        handGroup: null,
        // Interpolation targets
        targetRx: MOTION_POSES_3D.idle.rx,
        targetRy: MOTION_POSES_3D.idle.ry,
        targetRz: MOTION_POSES_3D.idle.rz,
        targetPy: MOTION_POSES_3D.idle.py,
        beatScale: 1.0,   // pulse on each new word beat
        isIdle: true,
        t: 0,
        ro: null,
      }
      threeRef.current = state

      // ── Load hand_rig.glb ────────────────────────────────────────────────
      const loader = new GLTFLoader()
      loader.load(
        '/hand_rig.glb',
        (gltf) => {
          if (destroyed) return

          const model = gltf.scene

          // The GLB contains 1 left hand + 3 right hands + 1 standalone right.
          // Hide everything except the left hand.
          const hideNames = [
            'Hand_Right_58',
            'Hand_Right.001_86',
            'Hand_Right.002_114',
            'Hand.R.002_0',
          ]
          hideNames.forEach((name) => {
            const obj = model.getObjectByName(name)
            if (obj) obj.visible = false
          })

          const leftHand = model.getObjectByName('Hand_Left_30')
          if (!leftHand) {
            setLoadError(
              'Hand_Left_30 node not found — re-export the GLB with node names preserved.'
            )
            return
          }

          // Center + scale the model so the hand fills the viewport nicely
          const box    = new THREE.Box3().setFromObject(leftHand)
          const center = box.getCenter(new THREE.Vector3())
          const size   = box.getSize(new THREE.Vector3())

          // Shift the entire model so the left hand is centred at origin
          model.position.set(-center.x, -center.y, -center.z)

          const maxDim = Math.max(size.x, size.y, size.z) || 1
          model.scale.setScalar(1.15 / maxDim)

          scene.add(model)
          state.handGroup = leftHand
          setIsLoaded(true)
        },
        undefined,
        (err) => {
          if (!destroyed)
            setLoadError(
              (err?.message || 'GLB load failed') +
              ' — copy hand_rig.glb to /public/hand_rig.glb and restart.'
            )
        }
      )

      // ── Animation loop ───────────────────────────────────────────────────
      const LERP = 0.085   // 0 = instant, 1 = no movement

      function animate() {
        rafId = requestAnimationFrame(animate)
        const s = threeRef.current
        if (!s || !s.handGroup) { renderer.render(scene, camera); return }

        s.t += 0.016

        // Idle breathing: gentle rhythmic sway when no sign is playing
        if (s.isIdle) {
          s.targetRx = MOTION_POSES_3D.idle.rx + Math.sin(s.t * 0.45) * 0.028
          s.targetRy = Math.sin(s.t * 0.28) * 0.042
          s.targetRz = Math.cos(s.t * 0.32) * 0.016
          s.targetPy = Math.sin(s.t * 0.38) * 0.018
        }

        // Smooth approach to target rotation
        s.handGroup.rotation.x = lerp(s.handGroup.rotation.x, s.targetRx, LERP)
        s.handGroup.rotation.y = lerp(s.handGroup.rotation.y, s.targetRy, LERP)
        s.handGroup.rotation.z = lerp(s.handGroup.rotation.z, s.targetRz, LERP)
        s.handGroup.position.y = lerp(s.handGroup.position.y, s.targetPy, LERP)

        // Word-beat pulse: snap scale up, then ease back to 1
        s.beatScale = lerp(s.beatScale, 1.0, 0.12)
        s.handGroup.scale.setScalar(s.beatScale)

        renderer.render(scene, camera)
      }
      animate()

      // ── Resize observer ──────────────────────────────────────────────────
      const ro = new ResizeObserver(() => {
        if (destroyed) return
        const w2 = container.clientWidth
        const h2 = Math.max(container.clientHeight, 1)
        renderer.setSize(w2, h2)
        camera.aspect = w2 / h2
        camera.updateProjectionMatrix()
      })
      ro.observe(container)
      state.ro = ro
    }

    init().catch((err) => {
      if (!destroyed) setLoadError(err?.message || 'Three.js init failed.')
    })

    return () => {
      destroyed = true
      cancelAnimationFrame(rafId)
      const s = threeRef.current
      s?.ro?.disconnect()
      if (s?.renderer) {
        s.renderer.dispose()
        try { container.removeChild(s.renderer.domElement) } catch { /* noop */ }
      }
      threeRef.current = null
    }
  }, [])

  // ── Apply a pose to the 3D hand group ────────────────────────────────────
  const applyPose = useCallback((motionName) => {
    const s = threeRef.current
    if (!s) return
    const pose = MOTION_POSES_3D[motionName] ?? MOTION_POSES_3D.idle
    s.targetRx = pose.rx
    s.targetRy = pose.ry
    s.targetRz = pose.rz
    s.targetPy = pose.py
    s.isIdle   = motionName === 'idle'
    // Trigger a subtle scale pop on each new word beat
    if (motionName !== 'idle') s.beatScale = 1.07
  }, [])

  // ── Drive animation from phase / gloss / playbackKey ─────────────────────
  useEffect(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    if (!isSigning || words.length === 0) {
      setMotion('idle')
      setWordIndex(-1)
      setSeqProg(0)
      applyPose('idle')
      return
    }

    let t = 60
    words.forEach((word, i) => {
      const id = setTimeout(() => {
        const m = resolveMotionForWord(word)
        setMotion(m)
        setWordIndex(i)
        setSeqProg((i + 1) / words.length)
        applyPose(m)
      }, t)
      timersRef.current.push(id)
      if (i < words.length - 1) t += beatDelay()
    })

    const endId = setTimeout(() => {
      setMotion('idle')
      setWordIndex(-1)
      setSeqProg(1)
      applyPose('idle')
      onPlaybackEnd?.()
    }, t + SEQUENCE_TAIL_MS)
    timersRef.current.push(endId)

    return () => timersRef.current.forEach((id) => clearTimeout(id))
  }, [isSigning, gloss, playbackKey, words, onPlaybackEnd, applyPose])

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative flex min-h-[280px] w-full flex-col overflow-hidden rounded-2xl border border-zinc-800/60 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] transition-opacity duration-500 animate-fade-in"
      role="region"
      aria-label="3D signing avatar"
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(79,70,229,0.2),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgba(255,255,255,0.06),transparent_45%)]" />

      {/* ── Header ── */}
      <div className="relative z-10 flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            3D Hand Rig
          </p>
          <p className="mt-0.5 text-sm font-medium text-zinc-100">
            Real-time sign from gloss
            {demoMode && (
              <span className="ml-2 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
                Demo
              </span>
            )}
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

      {/* ── Main grid ── */}
      <div className="relative z-10 grid min-h-[220px] flex-1 grid-cols-1 gap-4 p-4 sm:min-h-[260px] sm:grid-cols-[1fr_200px] sm:p-5">

        {/* WebGL canvas area */}
        <div className="relative flex min-h-[200px] items-center justify-center overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
          {/* Canvas is injected here by Three.js */}
          <div ref={canvasWrapRef} className="absolute inset-0" />

          {/* Loading spinner */}
          {!isLoaded && !loadError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-indigo-400" />
              <p className="text-xs font-medium text-zinc-400">Loading hand rig…</p>
            </div>
          )}

          {/* Error state */}
          {loadError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 p-5 text-center">
              <span className="text-3xl" aria-hidden>✋</span>
              <p className="text-sm font-semibold text-red-300">3D hand unavailable</p>
              <p className="max-w-[220px] text-[10px] leading-relaxed text-zinc-400">{loadError}</p>
            </div>
          )}

          {/* Preparing overlay */}
          {isPreparing && isLoaded && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-zinc-950/92 to-black/88 backdrop-blur-[1px]">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 animate-pulse rounded-full bg-indigo-500/25 blur-xl" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/90 ring-1 ring-white/15">
                  <span className="text-2xl" aria-hidden>✋</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Preparing sign…</p>
                <p className="mt-1 text-xs text-zinc-500">Building motion from gloss</p>
              </div>
            </div>
          )}

          {/* Sequence progress bar */}
          {isSigning && words.length > 0 && (
            <div className="pointer-events-none absolute inset-x-5 bottom-3 z-30 flex flex-col gap-1">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-indigo-400/90 transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.round(seqProg * 100)}%` }}
                />
              </div>
              <p className="text-center font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-200/90">
                {motion === 'idle'
                  ? 'Finishing…'
                  : `${motion} · beat ${Math.max(0, wordIndex + 1)}/${words.length}`}
              </p>
            </div>
          )}

          {/* Idle hint (only when loaded and truly idle) */}
          {phase === 'idle' && isLoaded && !loadError && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 px-6 text-center">
              <p className="text-xs text-zinc-500">
                {gloss
                  ? 'Idle — next utterance will drive a new sign sequence.'
                  : 'Speak or choose a phrase · the hand rig animates from gloss in real time.'}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col justify-center gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Live gloss
            </p>
            <p className="mt-1 font-mono text-lg font-semibold leading-snug tracking-wide text-white">
              {gloss ? (
                <GlossWords words={words} activeIndex={wordIndex} />
              ) : (
                '—'
              )}
            </p>
          </div>
          <div className="h-px w-full bg-white/10" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Phrase
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">
              {phrase || (
                <span className="text-zinc-600">Waiting for speech…</span>
              )}
            </p>
          </div>
          <div className="h-px w-full bg-white/10" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Sign type
            </p>
            <p className="mt-1 text-xs font-medium capitalize text-indigo-300">
              {motion === 'idle' ? '—' : motion}
            </p>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            3D rig from GLB · wrist orientation follows ASL motion categories per word.
          </p>
        </aside>
      </div>
    </div>
  )
}

// ─── GlossWords sub-component ─────────────────────────────────────────────────
function GlossWords({ words, activeIndex }) {
  return (
    <span className="break-words">
      {words.map((w, i) => (
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
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}