import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

let handLandmarkerPromise = null

async function createHandLandmarkerWithDelegate(vision, delegate) {
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate,
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })
}

async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  )

  try {
    return await createHandLandmarkerWithDelegate(vision, 'GPU')
  } catch (error) {
    const message = String(error?.message || error || '')
    const looksLikeGpuIssue =
      message.includes('No support of const') ||
      message.includes('UNIMPLEMENTED') ||
      message.includes('CalculatorGraph::Run') ||
      message.includes('WaitUntilIdle failed')

    if (!looksLikeGpuIssue) {
      throw error
    }
  }

  return createHandLandmarkerWithDelegate(vision, 'CPU')
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
