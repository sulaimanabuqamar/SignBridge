const FINGER_TIPS = [4, 8, 12, 16, 20]
const FINGER_PIPS = [3, 6, 10, 14, 18]
const FINGER_MCPS = [2, 5, 9, 13, 17]

function dist(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z || 0) - (b.z || 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getFingerStates(hand) {
  const wrist = hand[0]
  const palmScale = Math.max(dist(wrist, hand[9]), 0.001)

  const thumbOpen =
    dist(hand[4], hand[5]) > dist(hand[3], hand[5]) + palmScale * 0.12 &&
    Math.abs(hand[4].x - wrist.x) > palmScale * 0.18

  const fingerOpen = [8, 12, 16, 20].map((tipIndex, idx) => {
    const pipIndex = FINGER_PIPS[idx + 1]
    const mcpIndex = FINGER_MCPS[idx + 1]
    const tip = hand[tipIndex]
    const pip = hand[pipIndex]
    const mcp = hand[mcpIndex]
    return tip.y < pip.y && dist(tip, wrist) > dist(mcp, wrist) + palmScale * 0.2
  })

  const openness =
    FINGER_TIPS.reduce((sum, idx) => sum + dist(hand[idx], wrist), 0) / FINGER_TIPS.length / palmScale

  return {
    thumbOpen,
    indexOpen: fingerOpen[0],
    middleOpen: fingerOpen[1],
    ringOpen: fingerOpen[2],
    pinkyOpen: fingerOpen[3],
    openness,
  }
}

function classifyFromHand(hand, handedness = 'Unknown') {
  const fingers = getFingerStates(hand)
  const openCount =
    Number(fingers.thumbOpen) +
    Number(fingers.indexOpen) +
    Number(fingers.middleOpen) +
    Number(fingers.ringOpen) +
    Number(fingers.pinkyOpen)

  if (openCount >= 4 && fingers.openness > 1.45) {
    return {
      text: 'Hello',
      confidence: clamp(0.72 + (fingers.openness - 1.45) * 0.18, 0.72, 0.93),
      source: `hand_landmarker_${handedness.toLowerCase()}`,
    }
  }

  if (openCount >= 4 && fingers.openness <= 1.45) {
    return {
      text: 'Stop',
      confidence: 0.76,
      source: `hand_landmarker_${handedness.toLowerCase()}`,
    }
  }

  if (openCount <= 1 && fingers.openness < 1.18) {
    return {
      text: 'No',
      confidence: clamp(0.7 + (1.18 - fingers.openness) * 0.22, 0.7, 0.9),
      source: `hand_landmarker_${handedness.toLowerCase()}`,
    }
  }

  if (fingers.indexOpen && !fingers.middleOpen && !fingers.ringOpen && !fingers.pinkyOpen) {
    return {
      text: 'I need help',
      confidence: 0.79,
      source: `hand_landmarker_${handedness.toLowerCase()}`,
    }
  }

  if (fingers.indexOpen && fingers.middleOpen && !fingers.ringOpen && !fingers.pinkyOpen) {
    return {
      text: 'Please repeat',
      confidence: 0.77,
      source: `hand_landmarker_${handedness.toLowerCase()}`,
    }
  }

  if (fingers.thumbOpen && fingers.indexOpen && fingers.middleOpen && !fingers.ringOpen && !fingers.pinkyOpen) {
    return {
      text: 'Thank you',
      confidence: 0.78,
      source: `hand_landmarker_${handedness.toLowerCase()}`,
    }
  }

  if (fingers.thumbOpen && fingers.pinkyOpen && !fingers.indexOpen && !fingers.middleOpen && !fingers.ringOpen) {
    return {
      text: 'Water',
      confidence: 0.74,
      source: `hand_landmarker_${handedness.toLowerCase()}`,
    }
  }

  if (!fingers.thumbOpen && !fingers.indexOpen && !fingers.middleOpen && !fingers.ringOpen && fingers.pinkyOpen) {
    return {
      text: 'Bathroom',
      confidence: 0.72,
      source: `hand_landmarker_${handedness.toLowerCase()}`,
    }
  }

  if (fingers.thumbOpen && fingers.indexOpen && !fingers.middleOpen && !fingers.ringOpen && !fingers.pinkyOpen) {
    return {
      text: 'Okay',
      confidence: 0.73,
      source: `hand_landmarker_${handedness.toLowerCase()}`,
    }
  }

  if (fingers.thumbOpen && !fingers.indexOpen && !fingers.middleOpen && !fingers.ringOpen) {
    return {
      text: 'Yes',
      confidence: 0.75,
      source: `hand_landmarker_${handedness.toLowerCase()}`,
    }
  }

  return null
}

function getSequenceSummary(history) {
  const frames = history
    .map((entry) => {
      const hand = entry.landmarks?.[0]
      if (!hand) return null
      return {
        hand,
        handedness: entry.handednesses?.[0]?.[0]?.categoryName || 'Unknown',
        fingers: getFingerStates(hand),
        wrist: hand[0],
      }
    })
    .filter(Boolean)

  if (!frames.length) return null

  const xs = frames.map((frame) => frame.wrist.x)
  const ys = frames.map((frame) => frame.wrist.y)
  const openness = average(frames.map((frame) => frame.fingers.openness))
  const openCount = average(
    frames.map(
      (frame) =>
        Number(frame.fingers.thumbOpen) +
        Number(frame.fingers.indexOpen) +
        Number(frame.fingers.middleOpen) +
        Number(frame.fingers.ringOpen) +
        Number(frame.fingers.pinkyOpen),
    ),
  )

  const counts = frames.reduce(
    (acc, frame) => {
      if (frame.fingers.thumbOpen) acc.thumbOpen += 1
      if (frame.fingers.indexOpen) acc.indexOpen += 1
      if (frame.fingers.middleOpen) acc.middleOpen += 1
      if (frame.fingers.ringOpen) acc.ringOpen += 1
      if (frame.fingers.pinkyOpen) acc.pinkyOpen += 1
      return acc
    },
    { thumbOpen: 0, indexOpen: 0, middleOpen: 0, ringOpen: 0, pinkyOpen: 0 },
  )

  const total = frames.length
  const majority = Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, value / total >= 0.58]),
  )

  return {
    handedness: frames[frames.length - 1].handedness,
    openCount,
    openness,
    xTravel: Math.max(...xs) - Math.min(...xs),
    yTravel: Math.max(...ys) - Math.min(...ys),
    majority,
    sampleCount: total,
  }
}

function classifyFromSequence(history) {
  const summary = getSequenceSummary(history)
  if (!summary || summary.sampleCount < 6) return null

  const { handedness, openCount, openness, xTravel, yTravel, majority, sampleCount } = summary
  const source = `hand_landmarker_sequence_${handedness.toLowerCase()}`

  if (openCount >= 4 && openness > 1.42 && xTravel > 0.12) {
    return {
      text: 'Hello',
      confidence: clamp(0.79 + xTravel * 0.45, 0.79, 0.95),
      source,
      sampleCount,
    }
  }

  if (openCount >= 4 && openness > 1.3 && xTravel <= 0.12) {
    return {
      text: 'Stop',
      confidence: 0.79,
      source,
      sampleCount,
    }
  }

  if (openCount <= 1.35 && openness < 1.18 && yTravel > 0.09) {
    return {
      text: 'Yes',
      confidence: clamp(0.76 + yTravel * 0.55, 0.76, 0.92),
      source,
      sampleCount,
    }
  }

  if (
    majority.indexOpen &&
    majority.middleOpen &&
    !majority.ringOpen &&
    !majority.pinkyOpen &&
    openCount <= 2.6
  ) {
    return {
      text: xTravel > 0.055 || yTravel > 0.045 ? 'No' : 'Please repeat',
      confidence: clamp(0.75 + Math.max(xTravel, yTravel) * 0.45, 0.75, 0.9),
      source,
      sampleCount,
    }
  }

  if (
    majority.thumbOpen &&
    majority.indexOpen &&
    majority.middleOpen &&
    !majority.ringOpen &&
    !majority.pinkyOpen
  ) {
    return {
      text: 'Thank you',
      confidence: 0.8,
      source,
      sampleCount,
    }
  }

  if (
    majority.thumbOpen &&
    majority.pinkyOpen &&
    !majority.indexOpen &&
    !majority.middleOpen &&
    !majority.ringOpen
  ) {
    return {
      text: 'Water',
      confidence: 0.77,
      source,
      sampleCount,
    }
  }

  if (
    !majority.thumbOpen &&
    !majority.indexOpen &&
    !majority.middleOpen &&
    !majority.ringOpen &&
    majority.pinkyOpen
  ) {
    return {
      text: 'Bathroom',
      confidence: 0.75,
      source,
      sampleCount,
    }
  }

  if (
    majority.thumbOpen &&
    majority.indexOpen &&
    !majority.middleOpen &&
    !majority.ringOpen &&
    !majority.pinkyOpen
  ) {
    return {
      text: 'Okay',
      confidence: 0.76,
      source,
      sampleCount,
    }
  }

  if (majority.indexOpen && !majority.middleOpen && !majority.ringOpen && !majority.pinkyOpen) {
    return {
      text: 'I need help',
      confidence: clamp(0.74 + (majority.thumbOpen ? 0.04 : 0), 0.74, 0.88),
      source,
      sampleCount,
    }
  }

  if (openCount <= 1.2 && openness < 1.12) {
    return {
      text: 'No',
      confidence: clamp(0.7 + (1.12 - openness) * 0.4, 0.7, 0.88),
      source,
      sampleCount,
    }
  }

  return null
}

function preferSequenceResult(sequenceResult, frameResult) {
  if (sequenceResult && frameResult && sequenceResult.text === frameResult.text) {
    return {
      text: sequenceResult.text,
      confidence: clamp(Math.max(sequenceResult.confidence, frameResult.confidence), 0, 0.96),
      source: sequenceResult.source,
    }
  }

  if (sequenceResult?.confidence >= 0.74) return sequenceResult
  if (frameResult?.confidence >= 0.8) return frameResult
  return sequenceResult || frameResult || null
}

export function recognizeHandCapture({
  detection,
  history = [],
  demoMode,
}) {
  if (demoMode) return null

  const sequenceResult = history.length ? classifyFromSequence(history) : null
  const frameResult = detection?.landmarks?.length
    ? classifyFromHand(detection.landmarks[0], detection.handednesses?.[0]?.[0]?.categoryName || 'Unknown')
    : null

  const result = preferSequenceResult(sequenceResult, frameResult)
  if (!result) return null

  return {
    text: result.text,
    confidence: result.confidence,
    source: result.source,
    timestamp: Date.now(),
  }
}
