import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

let handLandmarkerPromise = null

async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  )

  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })
}

export async function getHandLandmarker() {
  if (!handLandmarkerPromise) {
    handLandmarkerPromise = createHandLandmarker()
  }
  return handLandmarkerPromise
}

export async function detectHands(video, nowMs = performance.now()) {
  if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null
  }

  const landmarker = await getHandLandmarker()
  const result = landmarker.detectForVideo(video, nowMs)

  return {
    landmarks: result.landmarks ?? [],
    worldLandmarks: result.worldLandmarks ?? [],
    handednesses: result.handednesses ?? [],
    timestamp: nowMs,
  }
}
