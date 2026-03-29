let holisticPromise = null
let activeDetection = null

function createBlankCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  return canvas
}

async function createHolisticInstance() {
  await import('@mediapipe/holistic')
  const Holistic = globalThis.Holistic

  if (!Holistic) {
    throw new Error('MediaPipe Holistic could not be loaded.')
  }

  const instance = new Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
  })

  instance.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    refineFaceLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    selfieMode: true,
  })

  await instance.initialize()
  await instance.send({ image: createBlankCanvas() })

  return instance
}

async function getHolisticInstance() {
  if (!holisticPromise) {
    holisticPromise = createHolisticInstance()
  }

  return holisticPromise
}

function normalizeResults(results, timestamp) {
  const image = results?.image
  return {
    faceLandmarks: [results?.faceLandmarks || []],
    poseLandmarks: [results?.poseLandmarks || []],
    leftHandLandmarks: [results?.leftHandLandmarks || []],
    rightHandLandmarks: [results?.rightHandLandmarks || []],
    image: image
      ? {
          width: image.width,
          height: image.height,
        }
      : null,
    timestamp,
  }
}

export async function detectLegacyHolistic(video, nowMs = performance.now()) {
  if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null
  }

  if (activeDetection) {
    return activeDetection
  }

  const holistic = await getHolisticInstance()

  activeDetection = new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      activeDetection = null
      reject(new Error('Holistic frame timed out.'))
    }, 4000)

    holistic.onResults((results) => {
      window.clearTimeout(timeoutId)
      activeDetection = null
      resolve(normalizeResults(results, nowMs))
    })

    holistic.send({ image: video }).catch((error) => {
      window.clearTimeout(timeoutId)
      activeDetection = null
      reject(error)
    })
  })

  return activeDetection
}
