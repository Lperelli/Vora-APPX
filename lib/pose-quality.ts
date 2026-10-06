export type PosePoint = {
  x: number
  y: number
  z?: number
  visibility?: number
}
export type PoseQualityIssue = 'not_front_facing' | 'arms_obscured' | 'posture'

/** Conservative pose hints, not calibrated body measurements or a depth scan. */
export function poseQualityIssue(points: PosePoint[]): PoseQualityIssue | null {
  const visible = (i: number) => points[i] && (points[i].visibility ?? 0) >= 0.6
  if (![11, 12, 23, 24].every(visible)) return null
  const [a, b, c, d] = [points[11], points[12], points[23], points[24]]
  const yaw = (p: PosePoint, q: PosePoint) => {
    if (!Number.isFinite(p.z) || !Number.isFinite(q.z)) return null
    const dx = Math.abs(p.x - q.x),
      dz = Math.abs(p.z! - q.z!)
    return dx + dz > 0.02 ? dz / Math.hypot(dx, dz) : null
  }
  const turns = [yaw(a, b), yaw(c, d)].filter((v): v is number => v !== null)
  // Both shoulder and hip depth support a marked turn. Avoid reacting to one joint.
  if (turns.length === 2 && turns.every((v) => v > 0.65))
    return 'not_front_facing'
  const top = (a.y + b.y) / 2,
    bottom = (c.y + d.y) / 2
  if (
    bottom - top < 0.12 ||
    Math.abs(a.y - b.y) > 0.07 ||
    Math.abs(c.y - d.y) > 0.07
  )
    return 'posture'
  const left = Math.min(a.x, b.x, c.x, d.x),
    right = Math.max(a.x, b.x, c.x, d.x)
  const margin = (right - left) * 0.12
  if (
    [15, 16].some(
      (i) =>
        visible(i) &&
        points[i].y > top &&
        points[i].y < bottom + 0.02 &&
        points[i].x > left + margin &&
        points[i].x < right - margin
    )
  )
    return 'arms_obscured'
  return null
}
