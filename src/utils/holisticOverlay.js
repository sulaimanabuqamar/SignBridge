const POSE_CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
]

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

const FACE_FEATURES = {
  oval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
  leftEye: [33, 160, 158, 133, 153, 144, 33],
  rightEye: [362, 385, 387, 263, 373, 380, 362],
  mouth: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 61],
  brows: [
    [70, 63, 105, 66, 107],
    [336, 296, 334, 293, 300],
  ],
}

function toCanvasPoint(point, width, height) {
  return {
    x: point.x * width,
    y: point.y * height,
  }
}

function drawPolyline(ctx, points, width, height, color, lineWidth = 2) {
  if (!points.length) return
  ctx.beginPath()
  const first = toCanvasPoint(points[0], width, height)
  ctx.moveTo(first.x, first.y)
  for (let index = 1; index < points.length; index += 1) {
    const point = toCanvasPoint(points[index], width, height)
    ctx.lineTo(point.x, point.y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

function drawConnections(ctx, landmarks, width, height, connections, color, lineWidth = 3) {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  connections.forEach(([a, b]) => {
    const start = landmarks[a]
    const end = landmarks[b]
    if (!start || !end) return
    const p1 = toCanvasPoint(start, width, height)
    const p2 = toCanvasPoint(end, width, height)
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()
  })
}

function drawPoints(ctx, landmarks, width, height, color, radius = 3) {
  ctx.fillStyle = color
  landmarks.forEach((landmark) => {
    if (!landmark) return
    const point = toCanvasPoint(landmark, width, height)
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fill()
  })
}

export function clearHolisticOverlay(canvas) {
  const ctx = canvas?.getContext('2d')
  if (!ctx || !canvas) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

export function drawHolisticOverlay(canvas, detection) {
  const ctx = canvas?.getContext('2d')
  if (!ctx || !canvas) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const { width, height } = canvas
  const face = detection?.faceLandmarks?.[0]
  const pose = detection?.poseLandmarks?.[0]
  const leftHand = detection?.leftHandLandmarks?.[0]
  const rightHand = detection?.rightHandLandmarks?.[0]

  if (pose) {
    drawConnections(ctx, pose, width, height, POSE_CONNECTIONS, '#f59e0b', 4)
    drawPoints(
      ctx,
      [pose[11], pose[12], pose[13], pose[14], pose[15], pose[16]],
      width,
      height,
      '#fde68a',
      4,
    )
  }

  if (leftHand) {
    drawConnections(ctx, leftHand, width, height, HAND_CONNECTIONS, '#ef4444', 3)
    drawPoints(ctx, leftHand, width, height, '#fecaca', 3)
  }

  if (rightHand) {
    drawConnections(ctx, rightHand, width, height, HAND_CONNECTIONS, '#22c55e', 3)
    drawPoints(ctx, rightHand, width, height, '#bbf7d0', 3)
  }

  if (face) {
    drawPolyline(ctx, FACE_FEATURES.oval.map((index) => face[index]).filter(Boolean), width, height, '#93c5fd', 1.5)
    drawPolyline(ctx, FACE_FEATURES.leftEye.map((index) => face[index]).filter(Boolean), width, height, '#60a5fa', 1.5)
    drawPolyline(ctx, FACE_FEATURES.rightEye.map((index) => face[index]).filter(Boolean), width, height, '#60a5fa', 1.5)
    drawPolyline(ctx, FACE_FEATURES.mouth.map((index) => face[index]).filter(Boolean), width, height, '#fca5a5', 1.5)
    FACE_FEATURES.brows.forEach((indices) => {
      drawPolyline(ctx, indices.map((index) => face[index]).filter(Boolean), width, height, '#c4b5fd', 1.5)
    })
  }
}
