import { recognizeSignFrame } from './mockSignRecognition'

const FINGER_TIPS = [4, 8, 12, 16, 20]
const FINGER_PIPS = [3, 6, 10, 14, 18]
const FINGER_MCPS = [2, 5, 9, 13, 17]
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const MOUTH_TOP = 13
const MOUTH_BOTTOM = 14

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function dist(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z || 0) - (b.z || 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getShoulderWidth(pose) {
  if (!pose?.[LEFT_SHOULDER] || !pose?.[RIGHT_SHOULDER]) return 0.2
  return Math.max(dist(pose[LEFT_SHOULDER], pose[RIGHT_SHOULDER]), 0.05)
}

function getFingerStates(hand) {
  if (!hand?.length) {
    return {
      thumbOpen: false,
      indexOpen: false,
      middleOpen: false,
      ringOpen: false,
      pinkyOpen: false,
      openness: 0,
    }
  }

  const wrist = hand[0]
  const palmScale = Math.max(dist(wrist, hand[9]), 0.001)
  const thumbOpen =
    dist(hand[4], hand[5]) > dist(hand[3], hand[5]) + palmScale * 0.12 &&
    Math.abs(hand[4].x - wrist.x) > palmScale * 0.18

  const fingerOpen = [8, 12, 16, 20].map((tipIndex, idx) => {
    const pipIndex = FINGER_PIPS[idx + 1]
    const mcpIndex = FINGER_MCPS[idx + 1]
    return hand[tipIndex].y < hand[pipIndex].y && dist(hand[tipIndex], wrist) > dist(hand[mcpIndex], wrist) + palmScale * 0.2
  })

  const openness =
    FINGER_TIPS.reduce((sum, index) => sum + dist(hand[index], wrist), 0) / FINGER_TIPS.length / palmScale

  return {
    thumbOpen,
    indexOpen: fingerOpen[0],
    middleOpen: fingerOpen[1],
    ringOpen: fingerOpen[2],
    pinkyOpen: fingerOpen[3],
    openness,
  }
}

function getBrowRaise(face) {
  if (!face?.length) return 0
  const leftBrow = face[105]
  const rightBrow = face[334]
  const leftEye = face[159]
  const rightEye = face[386]
  if (!leftBrow || !rightBrow || !leftEye || !rightEye) return 0
  return average([
    Math.max(0, leftEye.y - leftBrow.y),
    Math.max(0, rightEye.y - rightBrow.y),
  ])
}

function getMouthOpen(face) {
  if (!face?.length) return 0
  const top = face[MOUTH_TOP]
  const bottom = face[MOUTH_BOTTOM]
  return top && bottom ? Math.max(0, bottom.y - top.y) : 0
}

function toFrame(entry) {
  const pose = entry.poseLandmarks?.[0] || null
  const leftHand = entry.leftHandLandmarks?.[0] || null
  const rightHand = entry.rightHandLandmarks?.[0] || null
  const primaryHand = rightHand || leftHand
  if (!primaryHand) return null

  const fingers = getFingerStates(primaryHand)
  const wrist = primaryHand[0]
  const shoulderWidth = getShoulderWidth(pose)
  const mouthCenter = entry.faceLandmarks?.[0]?.[MOUTH_TOP] && entry.faceLandmarks?.[0]?.[MOUTH_BOTTOM]
    ? {
        x: (entry.faceLandmarks[0][MOUTH_TOP].x + entry.faceLandmarks[0][MOUTH_BOTTOM].x) / 2,
        y: (entry.faceLandmarks[0][MOUTH_TOP].y + entry.faceLandmarks[0][MOUTH_BOTTOM].y) / 2,
      }
    : null

  return {
    fingers,
    wrist,
    shoulderWidth,
    nearMouth: mouthCenter ? dist(wrist, mouthCenter) / shoulderWidth : 99,
    chestOffset: pose?.[LEFT_SHOULDER] && pose?.[RIGHT_SHOULDER]
      ? Math.abs(
          wrist.x - (pose[LEFT_SHOULDER].x + pose[RIGHT_SHOULDER].x) / 2,
        ) / shoulderWidth
      : 99,
    browRaise: getBrowRaise(entry.faceLandmarks?.[0]),
    mouthOpen: getMouthOpen(entry.faceLandmarks?.[0]),
  }
}

function classifyFromHolisticHistory(history) {
  const frames = history.map(toFrame).filter(Boolean)
  if (frames.length < 6) return null

  const xs = frames.map((frame) => frame.wrist.x)
  const ys = frames.map((frame) => frame.wrist.y)
  const xTravel = Math.max(...xs) - Math.min(...xs)
  const yTravel = Math.max(...ys) - Math.min(...ys)
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
  const openness = average(frames.map((frame) => frame.fingers.openness))
  const nearMouth = average(frames.map((frame) => frame.nearMouth))
  const chestOffset = average(frames.map((frame) => frame.chestOffset))
  const browRaise = average(frames.map((frame) => frame.browRaise))
  const mouthOpen = average(frames.map((frame) => frame.mouthOpen))

  const majority = {
    indexOpen: average(frames.map((frame) => Number(frame.fingers.indexOpen))) >= 0.58,
    middleOpen: average(frames.map((frame) => Number(frame.fingers.middleOpen))) >= 0.58,
    ringOpen: average(frames.map((frame) => Number(frame.fingers.ringOpen))) >= 0.58,
    pinkyOpen: average(frames.map((frame) => Number(frame.fingers.pinkyOpen))) >= 0.58,
    thumbOpen: average(frames.map((frame) => Number(frame.fingers.thumbOpen))) >= 0.58,
  }

  if (openCount >= 3.6 && openness > 1.24 && xTravel > 0.075) {
    return {
      text: 'Hello',
      confidence: clamp(0.8 + xTravel * 0.4, 0.8, 0.95),
      source: 'holistic_sequence_greeting',
    }
  }

  if (openCount <= 1.7 && openness < 1.24 && yTravel > 0.05) {
    return {
      text: 'Yes',
      confidence: clamp(0.76 + yTravel * 0.55, 0.76, 0.92),
      source: 'holistic_sequence_yes',
    }
  }

  if (majority.indexOpen && majority.middleOpen && !majority.ringOpen && !majority.pinkyOpen) {
    return {
      text: xTravel > 0.05 || yTravel > 0.04 ? 'No' : 'Please repeat',
      confidence: clamp(0.72 + Math.max(xTravel, yTravel) * 0.45, 0.72, 0.9),
      source: 'holistic_sequence_two_fingers',
    }
  }

  if (majority.indexOpen && !majority.middleOpen && chestOffset < 1.45 && yTravel < 0.08) {
    return {
      text: 'I need help',
      confidence: clamp(0.74 + (1.2 - chestOffset) * 0.08, 0.74, 0.9),
      source: 'holistic_sequence_help',
    }
  }

  if (openCount >= 3.5 && nearMouth < 1.7 && yTravel > 0.03 && mouthOpen > 0.01) {
    return {
      text: 'Thank you',
      confidence: clamp(0.72 + (1.45 - nearMouth) * 0.08, 0.72, 0.88),
      source: 'holistic_sequence_thanks',
    }
  }

  if (browRaise > 0.024 && mouthOpen > 0.012) {
    return {
      text: 'Could you repeat that?',
      confidence: 0.68,
      source: 'holistic_sequence_question',
    }
  }

  return null
}

function classifyFromHolisticDetection(detection) {
  const rightHand = detection?.rightHandLandmarks?.[0]
  const leftHand = detection?.leftHandLandmarks?.[0]
  const hand = rightHand || leftHand
  if (!hand) return null

  const fingers = getFingerStates(hand)
  const pose = detection?.poseLandmarks?.[0]
  const shoulderWidth = getShoulderWidth(pose)
  const wrist = hand[0]
  const centerX =
    pose?.[LEFT_SHOULDER] && pose?.[RIGHT_SHOULDER]
      ? (pose[LEFT_SHOULDER].x + pose[RIGHT_SHOULDER].x) / 2
      : wrist.x

  if (
    fingers.indexOpen &&
    !fingers.middleOpen &&
    !fingers.ringOpen &&
    !fingers.pinkyOpen &&
    Math.abs(wrist.x - centerX) / shoulderWidth < 1.2
  ) {
    return {
      text: 'I need help',
      confidence: 0.72,
      source: 'holistic_single_frame_help',
    }
  }

  if (fingers.thumbOpen && fingers.indexOpen && fingers.middleOpen && fingers.ringOpen && fingers.pinkyOpen) {
    return {
      text: 'Hello',
      confidence: 0.7,
      source: 'holistic_single_frame_open_hand',
    }
  }

  return null
}

export function recognizeHolisticCapture({
  detection,
  history = [],
  imageData,
  demoMode,
  captureIndex,
  hasLiveVideo,
  allowFallback = true,
}) {
  if (!demoMode && history.length) {
    const sequenceResult = classifyFromHolisticHistory(history)
    if (sequenceResult) {
      return {
        ...sequenceResult,
        timestamp: Date.now(),
      }
    }
  }

  if (!demoMode && detection) {
    const frameResult = classifyFromHolisticDetection(detection)
    if (frameResult) {
      return {
        ...frameResult,
        timestamp: Date.now(),
      }
    }
  }

  if (!allowFallback) {
    return null
  }

  return recognizeSignFrame({
    imageData,
    demoMode,
    captureIndex,
    hasLiveVideo,
  })
}
