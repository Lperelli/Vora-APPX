import { classifyBodyType, type BodyWidths } from './body-classifier'
import { PHOTO_VISIBILITY } from './body-type-config'

/** Three library photos must provide at least two agreeing, usable views. */
export function combinePhotoWidths(
  items: BodyWidths[],
  source: 'camera' | 'library'
): BodyWidths | null {
  const valid = items.filter((item) =>
    [item.shoulderW, item.waistW, item.hipW].every(
      (n) => Number.isFinite(n) && n > 0
    ) &&
    (item.visibility === undefined ||
      (Number.isFinite(item.visibility) && item.visibility >= PHOTO_VISIBILITY.low))
  )
  if (source === 'camera') return items.length === 1 && valid.length === 1 ? valid[0] : null
  if (valid.length < 2) return null
  const groups = new Map<string, BodyWidths[]>()
  for (const item of valid) {
    const result = classifyBodyType(item)
    // An ambiguous category is still a usable view. Confidence describes the
    // styling estimate; body visibility and photo quality were checked earlier.
    const key = result.type
    groups.set(key, [...(groups.get(key) || []), item])
  }
  const agreeing = [...groups.values()].sort((a, b) => b.length - a.length)[0]
  if (!agreeing || agreeing.length < 2) return null
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }
  return {
    shoulderW: median(agreeing.map((p) => p.shoulderW / p.hipW)),
    waistW: median(agreeing.map((p) => p.waistW / p.hipW)),
    hipW: 1,
    visibility: Math.min(...agreeing.map((p) => p.visibility ?? 1)),
  }
}

/** A legible photo may produce a tentative profile; it must retain its confidence. */
export function classifyPhotoSession(
  items: BodyWidths[],
  source: 'camera' | 'library'
) {
  const widths = combinePhotoWidths(items, source)
  return widths ? classifyBodyType(widths) : null
}
