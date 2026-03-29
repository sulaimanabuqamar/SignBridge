import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'

const WINDOW_SIZE = 20
const EMPTY_LANDMARK = { x: 0, y: 0, z: 0 }
const POSE = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
}

let modelPromise = null
const detectorState = {
  lastPose: null,
  lastTimestamp: 0,
  shoulderWidth: new Float32Array(WINDOW_SIZE).fill(0),
  shoulderWidthIndex: 0,
}

async function getModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      try {
        await tf.setBackend('webgl')
      } catch {
        await tf.setBackend('cpu')
      }
      await tf.ready()
      return tf.loadLayersModel(`${import.meta.env.BASE_URL}assets/models/sign-detector/model.json`)
    })()
  }

  return modelPromise
}

function distance(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function isValidLandmark(point) {
  return point && point.x > 0.02 && point.x < 0.98 && point.y > 0.02 && point.y < 0.98
}

function normalizePose(detection) {
  const pose = detection?.poseLandmarks?.[0] || []
  const leftHand = detection?.leftHandLandmarks?.[0] || []
  const rightHand = detection?.rightHandLandmarks?.[0] || []

  const bodyLandmarks = Array.from({ length: 33 }, (_, index) => pose[index] || EMPTY_LANDMARK)
  const leftHandLandmarks = Array.from({ length: 21 }, (_, index) => leftHand[index] || EMPTY_LANDMARK)
  const rightHandLandmarks = Array.from({ length: 21 }, (_, index) => rightHand[index] || EMPTY_LANDMARK)

  const landmarks = bodyLandmarks
    .concat(leftHandLandmarks, rightHandLandmarks)
    .map((landmark) => (isValidLandmark(landmark) ? landmark : EMPTY_LANDMARK))

  const leftShoulder = landmarks[POSE.LEFT_SHOULDER]
  const rightShoulder = landmarks[POSE.RIGHT_SHOULDER]

  if (leftShoulder.x > 0 && rightShoulder.x > 0) {
    detectorState.shoulderWidth[detectorState.shoulderWidthIndex % WINDOW_SIZE] = distance(leftShoulder, rightShoulder)
    detectorState.shoulderWidthIndex += 1
  }

  if (detectorState.shoulderWidthIndex < WINDOW_SIZE) {
    return null
  }

  const meanShoulders =
    detectorState.shoulderWidth.reduce((sum, value) => sum + value, 0) / detectorState.shoulderWidth.length

  const scaled = landmarks.map((landmark) => ({
    x: landmark.x / meanShoulders,
    y: landmark.y / meanShoulders,
  }))

  const neck = {
    x: (scaled[POSE.LEFT_SHOULDER].x + scaled[POSE.RIGHT_SHOULDER].x) / 2,
    y: (scaled[POSE.LEFT_SHOULDER].y + scaled[POSE.RIGHT_SHOULDER].y) / 2,
  }

  return [
    scaled[POSE.NOSE],
    neck,
    scaled[POSE.RIGHT_SHOULDER],
    scaled[POSE.RIGHT_ELBOW],
    scaled[POSE.RIGHT_WRIST],
    scaled[POSE.LEFT_SHOULDER],
    scaled[POSE.LEFT_ELBOW],
    scaled[POSE.LEFT_WRIST],
    EMPTY_LANDMARK,
    EMPTY_LANDMARK,
    EMPTY_LANDMARK,
    EMPTY_LANDMARK,
    EMPTY_LANDMARK,
    EMPTY_LANDMARK,
    EMPTY_LANDMARK,
    scaled[POSE.RIGHT_EYE],
    scaled[POSE.LEFT_EYE],
    scaled[POSE.RIGHT_EAR],
    scaled[POSE.LEFT_EAR],
    EMPTY_LANDMARK,
    EMPTY_LANDMARK,
    EMPTY_LANDMARK,
    EMPTY_LANDMARK,
    EMPTY_LANDMARK,
    EMPTY_LANDMARK,
  ]
}

function distance2DTensors(p1, p2, multiplier = 1) {
  const output = new Float32Array(p1.length).fill(0)
  for (let index = 0; index < output.length; index += 1) {
    const a = p1[index]
    const b = p2[index]
    if (a.x > 0 && b.x > 0) {
      output[index] = distance(a, b) * multiplier
    }
  }
  return output
}

export async function estimateSigningProbability(detection) {
  const normalized = normalizePose(detection)
  const timestamp = performance.now() / 1000

  if (!normalized) {
    detectorState.lastPose = null
    detectorState.lastTimestamp = timestamp
    return 0
  }

  let confidence = 0
  if (detectorState.lastPose && detectorState.lastTimestamp) {
    const fps = 1 / Math.max(timestamp - detectorState.lastTimestamp, 1 / 120)
    const opticalFlow = distance2DTensors(normalized, detectorState.lastPose, fps)
    const model = await getModel()

    confidence = tf.tidy(() => {
      const prediction = model.predict(tf.tensor(opticalFlow).reshape([1, 1, opticalFlow.length]))
      const softmax = tf.softmax(prediction).dataSync()
      return softmax[1] || 0
    })
  }

  detectorState.lastTimestamp = timestamp
  detectorState.lastPose = normalized
  return confidence
}

export function resetSigningDetector() {
  detectorState.lastPose = null
  detectorState.lastTimestamp = 0
  detectorState.shoulderWidth.fill(0)
  detectorState.shoulderWidthIndex = 0
}
