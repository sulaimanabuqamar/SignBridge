import { recognizeSignFrame } from './mockSignRecognition'

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

  if (fingers.thumbOpen && !fingers.indexOpen && !fingers.middleOpen && !fingers.ringOpen) {
    return {
      text: 'Yes',
      confidence: 0.75,
      source: `hand_landmarker_${handedness.toLowerCase()}`,
    }
  }

  return {
    text: 'One moment please.',
    confidence: 0.56,
    source: `hand_landmarker_${handedness.toLowerCase()}`,
  }
}

export function recognizeHandCapture({
  detection,
  imageData,
  demoMode,
  captureIndex,
  hasLiveVideo,
}) {
  if (!demoMode && detection?.landmarks?.length) {
    const primaryHand = detection.landmarks[0]
    const primaryHandedness = detection.handednesses?.[0]?.[0]?.categoryName || 'Unknown'
    return {
      ...classifyFromHand(primaryHand, primaryHandedness),
      timestamp: Date.now(),
    }
  }

  return recognizeSignFrame({
    imageData,
    demoMode,
    captureIndex,
    hasLiveVideo,
  })
}
