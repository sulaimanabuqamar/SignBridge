export const HAND_CONNECTIONS = [
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

function toCanvasPoint(point, width, height) {
  return {
    x: point.x * width,
    y: point.y * height,
  }
}

export function clearOverlay(canvas) {
  const ctx = canvas?.getContext('2d')
  if (!ctx || !canvas) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

export function drawHandOverlay(canvas, detection) {
  const ctx = canvas?.getContext('2d')
  if (!ctx || !canvas) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (!detection?.landmarks?.length) return

  const { width, height } = canvas

  detection.landmarks.forEach((hand, handIndex) => {
    const color = handIndex === 0 ? '#818cf8' : '#34d399'
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    HAND_CONNECTIONS.forEach(([a, b]) => {
      const pa = toCanvasPoint(hand[a], width, height)
      const pb = toCanvasPoint(hand[b], width, height)
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.stroke()
    })

    hand.forEach((point, pointIndex) => {
      const p = toCanvasPoint(point, width, height)
      const radius = pointIndex === 0 ? 6 : 4
      ctx.fillStyle = pointIndex === 0 ? '#ffffff' : color
      ctx.beginPath()
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
      ctx.fill()
    })
  })
}
