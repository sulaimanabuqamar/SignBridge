import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  SEQUENCE_TAIL_MS,
  beatDelay,
  resolveMotionForWord,
  splitGlossWords,
} from '../utils/avatarMotion'

const PHASE_LABEL = {
  idle: 'Idle',
  preparing: 'Preparing sign...',
  signing: 'Signing now',
}

const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
]

const REST_HAND_POINTS = [
  [-0.2, -0.22, 0],
  [-0.23, -0.16, 0.02],
  [-0.19, -0.09, 0.04],
  [-0.13, -0.03, 0.06],
  [-0.06, 0.03, 0.08],
  [-0.11, -0.02, 0.01],
  [-0.09, 0.12, 0.02],
  [-0.08, 0.24, 0.03],
  [-0.07, 0.36, 0.04],
  [-0.01, 0.01, 0],
  [0, 0.15, 0.01],
  [0.01, 0.29, 0.02],
  [0.02, 0.43, 0.03],
  [0.08, -0.01, -0.01],
  [0.09, 0.12, 0],
  [0.1, 0.24, 0.01],
  [0.11, 0.35, 0.02],
  [0.16, -0.05, -0.03],
  [0.18, 0.05, -0.02],
  [0.19, 0.15, -0.01],
  [0.2, 0.24, 0],
]

const FINGER_BASES = [
  new THREE.Vector3(-0.1, -0.01, 0.02),
  new THREE.Vector3(0, 0.02, 0.01),
  new THREE.Vector3(0.09, 0, 0),
  new THREE.Vector3(0.17, -0.04, -0.02),
]

const THUMB_BASE = new THREE.Vector3(-0.2, -0.18, 0.02)

const POSE_PRESETS = {
  idle: {
    twist: 0.05,
    lift: 0,
    pulse: 1,
    thumb: { spread: 0.34, curl: 0.18, fan: -0.2, rise: 0.01 },
    fingers: [
      { spread: -0.07, curl: [0.1, 0.08, 0.06], lean: -0.08 },
      { spread: -0.02, curl: [0.08, 0.06, 0.04], lean: -0.02 },
      { spread: 0.03, curl: [0.14, 0.12, 0.08], lean: 0.03 },
      { spread: 0.08, curl: [0.2, 0.15, 0.1], lean: 0.08 },
    ],
  },
  up: {
    twist: -0.22,
    lift: 0.12,
    pulse: 1.05,
    thumb: { spread: 0.4, curl: 0.08, fan: -0.4, rise: 0.05 },
    fingers: [
      { spread: -0.16, curl: [0.05, 0.02, 0.01], lean: -0.03 },
      { spread: -0.05, curl: [0.04, 0.02, 0], lean: -0.01 },
      { spread: 0.06, curl: [0.06, 0.03, 0.01], lean: 0.02 },
      { spread: 0.17, curl: [0.09, 0.05, 0.02], lean: 0.04 },
    ],
  },
  push: {
    twist: 0.14,
    lift: -0.01,
    pulse: 1.09,
    thumb: { spread: 0.28, curl: 0.24, fan: -0.15, rise: 0 },
    fingers: [
      { spread: -0.03, curl: [0.28, 0.18, 0.1], lean: -0.03 },
      { spread: 0, curl: [0.32, 0.2, 0.12], lean: 0 },
      { spread: 0.03, curl: [0.34, 0.22, 0.14], lean: 0.03 },
      { spread: 0.05, curl: [0.38, 0.26, 0.16], lean: 0.05 },
    ],
  },
  tap: {
    twist: 0.02,
    lift: -0.02,
    pulse: 1.03,
    thumb: { spread: 0.24, curl: 0.26, fan: -0.14, rise: -0.01 },
    fingers: [
      { spread: -0.03, curl: [0.03, 0.01, 0], lean: -0.14 },
      { spread: 0, curl: [0.5, 0.36, 0.24], lean: -0.02 },
      { spread: 0.03, curl: [0.56, 0.4, 0.27], lean: 0.03 },
      { spread: 0.07, curl: [0.62, 0.46, 0.3], lean: 0.08 },
    ],
  },
  sweep: {
    twist: 0.38,
    lift: 0.03,
    pulse: 1.08,
    thumb: { spread: 0.42, curl: 0.1, fan: -0.34, rise: 0.03 },
    fingers: [
      { spread: -0.2, curl: [0.08, 0.04, 0.02], lean: -0.1 },
      { spread: -0.08, curl: [0.06, 0.03, 0.01], lean: -0.04 },
      { spread: 0.08, curl: [0.08, 0.04, 0.02], lean: 0.05 },
      { spread: 0.2, curl: [0.12, 0.06, 0.03], lean: 0.11 },
    ],
  },
  wave: {
    twist: 0.28,
    lift: 0.08,
    pulse: 1.07,
    thumb: { spread: 0.46, curl: 0.04, fan: -0.42, rise: 0.04 },
    fingers: [
      { spread: -0.18, curl: [0.07, 0.03, 0.01], lean: -0.16 },
      { spread: -0.06, curl: [0.05, 0.02, 0], lean: -0.05 },
      { spread: 0.08, curl: [0.07, 0.03, 0.01], lean: 0.06 },
      { spread: 0.18, curl: [0.1, 0.05, 0.02], lean: 0.15 },
    ],
  },
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function rotatePoint([x, y, z], twist) {
  const cos = Math.cos(twist)
  const sin = Math.sin(twist)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
    z,
  }
}

function buildPose(name = 'idle') {
  const pose = POSE_PRESETS[name] ?? POSE_PRESETS.idle
  return buildPoseFromPreset(pose)
}

function buildPoseFromPreset(pose) {
  const points = REST_HAND_POINTS.map(([x, y, z]) => {
    const rotated = rotatePoint([x, y + pose.lift, z], pose.twist)
    return new THREE.Vector3(rotated.x, rotated.y, rotated.z)
  })

  const thumbAngles = [pose.thumb.fan, pose.thumb.fan * 0.7, pose.thumb.fan * 0.45]
  const thumbLengths = [0.09, 0.08, 0.075]
  let thumbCurrent = THUMB_BASE.clone()
  points[1] = thumbCurrent.clone()
  for (let segmentIndex = 0; segmentIndex < 3; segmentIndex += 1) {
    const angle = thumbAngles[segmentIndex]
    const length = thumbLengths[segmentIndex]
    thumbCurrent = thumbCurrent.clone().add(
      new THREE.Vector3(
        length * Math.cos(angle) * pose.thumb.spread,
        length * Math.sin(angle) + pose.thumb.rise - pose.thumb.curl * (segmentIndex * 0.03),
        0.02 + pose.thumb.curl * 0.06 + segmentIndex * 0.01,
      ),
    )
    points[segmentIndex + 2] = thumbCurrent
  }

  pose.fingers.forEach((fingerPose, fingerIndex) => {
    const baseIndex = 5 + fingerIndex * 4
    const base = FINGER_BASES[fingerIndex]
    points[baseIndex] = base.clone().add(new THREE.Vector3(fingerPose.spread, pose.lift, 0))

    const lengths = [0.12, 0.1, 0.085]
    let current = points[baseIndex]

    lengths.forEach((length, jointIndex) => {
      const curl = fingerPose.curl[jointIndex]
      const next = current.clone().add(
        new THREE.Vector3(
          fingerPose.spread * 0.15 + fingerPose.lean * (jointIndex + 1) * 0.18,
          length - curl * 0.16,
          curl * 0.2 + Math.abs(fingerPose.spread) * 0.03,
        ),
      )
      points[baseIndex + jointIndex + 1] = next
      current = next
    })
  })

  return points
}

function createBoneMesh(material) {
  return new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 1, 10), material)
}

export default function ProceduralAvatar({
  phrase,
  gloss,
  signPlan = [],
  phase = 'idle',
  playbackKey = 0,
  demoMode = false,
  onPlaybackEnd,
}) {
  const canvasWrapRef = useRef(null)
  const threeRef = useRef(null)
  const timersRef = useRef([])

  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [motion, setMotion] = useState('idle')
  const [wordIndex, setWordIndex] = useState(-1)
  const [sequenceProgress, setSequenceProgress] = useState(0)

  const isSigning = phase === 'signing'
  const isPreparing = phase === 'preparing'
  const words = useMemo(() => splitGlossWords(gloss), [gloss])
  const statusLabel = PHASE_LABEL[phase] ?? PHASE_LABEL.idle

  useEffect(() => {
    const container = canvasWrapRef.current
    if (!container) return undefined

    let destroyed = false
    let rafId = 0

    try {
      const width = container.clientWidth || 400
      const height = container.clientHeight || 300

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height)
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      container.appendChild(renderer.domElement)

      const camera = new THREE.PerspectiveCamera(38, width / height, 0.001, 50)
      camera.position.set(0, 0.08, 2.4)
      camera.lookAt(0, 0.05, 0)

      const scene = new THREE.Scene()
      scene.add(new THREE.AmbientLight(0xffffff, 2.2))

      const key = new THREE.DirectionalLight(0xfff0d0, 3.8)
      key.position.set(1.5, 2.5, 2.5)
      scene.add(key)

      const fill = new THREE.DirectionalLight(0x99bbff, 1.0)
      fill.position.set(-2, 0.5, 1.5)
      scene.add(fill)

      const rim = new THREE.DirectionalLight(0xffffff, 0.9)
      rim.position.set(0, -1.5, -2)
      scene.add(rim)

      const jointMaterial = new THREE.MeshStandardMaterial({
        color: '#f4d8bf',
        roughness: 0.58,
        metalness: 0.05,
      })
      const boneMaterial = new THREE.MeshStandardMaterial({
        color: '#d8b18c',
        roughness: 0.72,
        metalness: 0.03,
      })

      const handGroup = new THREE.Group()
      const joints = REST_HAND_POINTS.map(() => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 18, 18), jointMaterial)
        handGroup.add(mesh)
        return mesh
      })
      const bones = HAND_CONNECTIONS.map(() => {
        const mesh = createBoneMesh(boneMaterial)
        handGroup.add(mesh)
        return mesh
      })
      handGroup.rotation.x = -0.1
      scene.add(handGroup)

      const state = {
        renderer,
        camera,
        scene,
        handGroup,
        joints,
        bones,
        currentPose: buildPose('idle'),
        targetPose: buildPose('idle'),
        beatScale: 1,
        isIdle: true,
        time: 0,
        resizeObserver: null,
      }
      threeRef.current = state
      setIsLoaded(true)

      const lerpFactor = 0.14

      const animate = () => {
        rafId = window.requestAnimationFrame(animate)
        const s = threeRef.current
        if (!s) {
          renderer.render(scene, camera)
          return
        }

        s.time += 0.016

        if (s.isIdle) {
          s.targetPose = buildPose('idle').map((point, index) => {
            const out = point.clone()
            out.x += Math.sin(s.time * 0.7 + index * 0.1) * 0.004
            out.y += Math.cos(s.time * 0.65 + index * 0.08) * 0.005
            out.z += Math.sin(s.time * 0.6 + index * 0.05) * 0.003
            return out
          })
        }

        s.currentPose.forEach((point, index) => {
          point.lerp(s.targetPose[index], lerpFactor)
          s.joints[index].position.copy(point)
        })

        HAND_CONNECTIONS.forEach(([a, b], index) => {
          const start = s.currentPose[a]
          const end = s.currentPose[b]
          const direction = new THREE.Vector3().subVectors(end, start)
          const length = Math.max(direction.length(), 0.001)
          const bone = s.bones[index]

          bone.position.copy(start).addScaledVector(direction, 0.5)
          bone.scale.set(1, length, 1)
          bone.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.clone().normalize(),
          )
        })

        s.beatScale = lerp(s.beatScale, 1, 0.12)
        s.handGroup.scale.setScalar(s.beatScale)
        s.handGroup.rotation.y = lerp(s.handGroup.rotation.y, Math.sin(s.time * 0.22) * 0.08, 0.05)

        renderer.render(scene, camera)
      }

      animate()

      const resizeObserver = new ResizeObserver(() => {
        if (destroyed) return
        const nextWidth = container.clientWidth || 400
        const nextHeight = Math.max(container.clientHeight, 1)
        renderer.setSize(nextWidth, nextHeight)
        camera.aspect = nextWidth / nextHeight
        camera.updateProjectionMatrix()
      })
      resizeObserver.observe(container)
      state.resizeObserver = resizeObserver
    } catch (error) {
      setLoadError(error?.message || 'Three.js init failed.')
    }

    return () => {
      destroyed = true
      window.cancelAnimationFrame(rafId)
      const state = threeRef.current
      state?.resizeObserver?.disconnect()
      if (state?.renderer) {
        state.renderer.dispose()
        try {
          container.removeChild(state.renderer.domElement)
        } catch {
          /* noop */
        }
      }
      threeRef.current = null
    }
  }, [])

  const applyPose = useCallback((poseInput) => {
    const state = threeRef.current
    if (!state) return

    if (typeof poseInput === 'string') {
      state.targetPose = buildPose(poseInput)
      state.isIdle = poseInput === 'idle'
      if (poseInput !== 'idle') {
        state.beatScale = POSE_PRESETS[poseInput]?.pulse ?? 1.06
      }
      return
    }

    const preset = {
      ...POSE_PRESETS.idle,
      ...(POSE_PRESETS[poseInput.motion] ?? {}),
      ...poseInput,
    }

    state.targetPose = buildPoseFromPreset(preset)
    state.isIdle = false
    state.beatScale = preset.pulse ?? 1.06
  }, [])

  useEffect(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []

    const plan = signPlan.length > 0 ? signPlan : words.map((word) => ({ label: word, motion: resolveMotionForWord(word) }))

    if (!isSigning || plan.length === 0) {
      setMotion('idle')
      setWordIndex(-1)
      setSequenceProgress(0)
      applyPose('idle')
      return undefined
    }

    let elapsed = 60

    plan.forEach((entry, index) => {
      const timeoutId = window.setTimeout(() => {
        const nextMotion = entry.motion || resolveMotionForWord(entry.label || '')
        setMotion(entry.label || nextMotion)
        setWordIndex(index)
        setSequenceProgress((index + 1) / plan.length)
        applyPose(entry)
      }, elapsed)

      timersRef.current.push(timeoutId)

      if (index < plan.length - 1) {
        elapsed += beatDelay()
      }
    })

    const endId = window.setTimeout(() => {
      setMotion('idle')
      setWordIndex(-1)
      setSequenceProgress(1)
      applyPose('idle')
      onPlaybackEnd?.()
    }, elapsed + SEQUENCE_TAIL_MS)

    timersRef.current.push(endId)

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id))
    }
  }, [applyPose, gloss, isSigning, onPlaybackEnd, playbackKey, signPlan, words])

  return (
    <div
      className="relative flex min-h-[280px] w-full flex-col overflow-hidden rounded-2xl border border-zinc-800/60 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] transition-opacity duration-500 animate-fade-in"
      role="region"
      aria-label="Procedural signing hand"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(79,70,229,0.2),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgba(255,255,255,0.06),transparent_45%)]" />

      <div className="relative z-10 flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Procedural Hand
          </p>
          <p className="mt-0.5 text-sm font-medium text-zinc-100">
            MediaPipe-ready signing avatar
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
          <div ref={canvasWrapRef} className="absolute inset-0" />

          {!isLoaded && !loadError ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-indigo-400" />
              <p className="text-xs font-medium text-zinc-400">Building procedural hand...</p>
            </div>
          ) : null}

          {loadError ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 p-5 text-center">
              <span className="text-3xl" aria-hidden>
                Hand
              </span>
              <p className="text-sm font-semibold text-red-300">Procedural hand unavailable</p>
              <p className="max-w-[220px] text-[10px] leading-relaxed text-zinc-400">{loadError}</p>
            </div>
          ) : null}

          {isPreparing && isLoaded ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-zinc-950/92 to-black/88 backdrop-blur-[1px]">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 animate-pulse rounded-full bg-indigo-500/25 blur-xl" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/90 ring-1 ring-white/15">
                  <span className="text-sm text-zinc-100">HAND</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Preparing sign...</p>
                <p className="mt-1 text-xs text-zinc-500">Building motion from gloss</p>
              </div>
            </div>
          ) : null}

          {isSigning && words.length > 0 ? (
            <div className="pointer-events-none absolute inset-x-5 bottom-3 z-30 flex flex-col gap-1">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-indigo-400/90 transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.round(sequenceProgress * 100)}%` }}
                />
              </div>
              <p className="text-center font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-200/90">
                {motion === 'idle'
                  ? 'Finishing...'
                  : `${motion} / beat ${Math.max(0, wordIndex + 1)}/${words.length}`}
              </p>
            </div>
          ) : null}

          {phase === 'idle' && isLoaded && !loadError ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 px-6 text-center">
              <p className="text-xs text-zinc-500">
                {gloss
                  ? 'Idle. The next phrase will drive a new hand sequence.'
                  : 'Speak or choose a phrase. This hand is generated procedurally, not from a GLB.'}
              </p>
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col justify-center gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Live gloss
            </p>
            <p className="mt-1 font-mono text-lg font-semibold leading-snug tracking-wide text-white">
              {gloss ? <GlossWords words={words} activeIndex={wordIndex} /> : '-'}
            </p>
          </div>
          <div className="h-px w-full bg-white/10" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Phrase
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">
              {phrase || <span className="text-zinc-600">Waiting for speech...</span>}
            </p>
          </div>
          <div className="h-px w-full bg-white/10" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Sign type
            </p>
            <p className="mt-1 text-xs font-medium capitalize text-indigo-300">
              {motion === 'idle' ? '-' : motion}
            </p>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            This replaces the broken static GLB with a hand you can later drive from live MediaPipe landmarks.
          </p>
        </aside>
      </div>
    </div>
  )
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
