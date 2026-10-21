export type PosePoint = {
  x: number
  y: number
  z?: number
  visibility?: number
}
export type PoseQualityIssue = 'not_front_facing' | 'arms_obscured' | 'posture' | 'not_standing' | 'low_visibility'

/** Conservative pose hints, not calibrated body measurements or a depth scan. */
export function poseQualityIssue(points: PosePoint[], aspectRatio = 1): PoseQualityIssue | null {
  const aspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1
  const visible = (i: number) => {
    const p = points[i]
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 &&
      Number.isFinite(p.visibility) && (p.visibility ?? 0) >= 0.6
  }
  if (![11, 12, 23, 24].every(visible)) return 'low_visibility'
  const [a, b, c, d] = [points[11], points[12], points[23], points[24]]
  const yaw = (p: PosePoint, q: PosePoint) => {
    if (!Number.isFinite(p.z) || !Number.isFinite(q.z)) return null
    const dx = Math.abs(p.x - q.x), dz = Math.abs(p.z! - q.z!)
    return dx + dz > 0 ? dz / Math.hypot(dx, dz) : null
  }
  const turns = [yaw(a, b), yaw(c, d)].filter((v): v is number => v !== null)
  // Both shoulder and hip depth support a marked turn. Avoid reacting to one joint.
  // This does not distinguish a straight rear view from a straight front view.

  const top = (a.y + b.y) / 2, bottom = (c.y + d.y) / 2
  const torsoDy = bottom - top
  const torsoDx = ((c.x + d.x - a.x - b.x) / 2) * aspect
  const torsoLength = Math.hypot(torsoDx, torsoDy)
  const shoulderWidth = Math.hypot((a.x - b.x) * aspect, a.y - b.y)
  if (
    torsoDy <= 0 || torsoLength <= 0 ||
    torsoDy < shoulderWidth * 0.35 ||
    Math.abs(torsoDx) > torsoDy * 0.6 ||
    Math.abs(a.y - b.y) > torsoLength * 0.28 ||
    Math.abs(c.y - d.y) > torsoLength * 0.28
  ) return 'posture'

  // Require evidence from BOTH visible legs. One relaxed/bent knee is common in
  // usable standing photos. Pixel-aspect-correct geometry also makes the check
  // stable when a portrait image is resized or padded into a landscape frame.
  const foldedLeg = (hipIndex: number, kneeIndex: number, ankleIndex: number) => {
    if (![hipIndex, kneeIndex, ankleIndex].every(visible)) return false
    const hip = points[hipIndex], knee = points[kneeIndex], ankle = points[ankleIndex]
    const thigh = { x: (hip.x - knee.x) * aspect, y: hip.y - knee.y }
    const shin = { x: (ankle.x - knee.x) * aspect, y: ankle.y - knee.y }
    const thighLength = Math.hypot(thigh.x, thigh.y), shinLength = Math.hypot(shin.x, shin.y)
    if (shinLength < torsoLength * 0.15) return false
    const cosine = thighLength > 0
      ? (thigh.x * shin.x + thigh.y * shin.y) / (thighLength * shinLength)
      : 1
    const bentOrForeshortened = cosine > -0.65 || thighLength < torsoLength * 0.25
    return bentOrForeshortened &&
      (knee.y - hip.y) / torsoLength < 0.55 &&
      (ankle.y - hip.y) / torsoLength < 1.2
  }
  if (foldedLeg(23, 25, 27) && foldedLeg(24, 26, 28)) return 'not_standing'
  // Give the more actionable standing instruction before a concurrent turn hint.
  if (turns.length === 2 && turns.every((v) => v > 0.65)) return 'not_front_facing'

  const left = Math.min(a.x, b.x, c.x, d.x), right = Math.max(a.x, b.x, c.x, d.x)
  const margin = (right - left) * 0.12
  if ([15, 16].some((i) => visible(i) && points[i].y > top &&
    points[i].y < bottom + torsoLength * 0.07 &&
    points[i].x > left + margin && points[i].x < right - margin)) return 'arms_obscured'
  return null
}
