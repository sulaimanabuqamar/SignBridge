import { FilesetResolver, HolisticLandmarker } from '@mediapipe/tasks-vision'

let holisticLandmarkerPromise = null

async function createHolisticLandmarkerWithDelegate(vision, delegate) {
  return HolisticLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task',
      delegate,
    },
    runningMode: 'VIDEO',
    outputFaceBlendshapes: true,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minHandLandmarksConfidence: 0.5,
  })
}

async function createHolisticLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  )

  try {
    return await createHolisticLandmarkerWithDelegate(vision, 'GPU')
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

  return createHolisticLandmarkerWithDelegate(vision, 'CPU')
}

export async function getHolisticLandmarker() {
  if (!holisticLandmarkerPromise) {
    holisticLandmarkerPromise = createHolisticLandmarker()
  }
  return holisticLandmarkerPromise
}

export async function detectHolistic(video, nowMs = performance.now()) {
  if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null
  }

  const landmarker = await getHolisticLandmarker()
  const result = landmarker.detectForVideo(video, nowMs)

  return {
    faceLandmarks: result.faceLandmarks ?? [],
    faceBlendshapes: result.faceBlendshapes ?? [],
    poseLandmarks: result.poseLandmarks ?? [],
    poseWorldLandmarks: result.poseWorldLandmarks ?? [],
    leftHandLandmarks: result.leftHandLandmarks ?? [],
    rightHandLandmarks: result.rightHandLandmarks ?? [],
    leftHandWorldLandmarks: result.leftHandWorldLandmarks ?? [],
    rightHandWorldLandmarks: result.rightHandWorldLandmarks ?? [],
    timestamp: nowMs,
  }
}
