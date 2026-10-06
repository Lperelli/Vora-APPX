import { classifyBodyType, type BodyWidths } from './body-classifier'

/** Three library photos must provide at least two agreeing, usable views. */
export function combinePhotoWidths(
  items: BodyWidths[],
  source: 'camera' | 'library'
): BodyWidths | null {
  const valid = items.filter((item) =>
    [item.shoulderW, item.waistW, item.hipW].every(
      (n) => Number.isFinite(n) && n > 0
    )
  )
  if (source === 'camera') return items.length === 1 && valid.length === 1 ? valid[0] : null
  if (valid.length < 2) return null
  const groups = new Map<string, BodyWidths[]>()
  for (const item of valid) {
    const result = classifyBodyType(item)
    if (result.confidence === 'low') continue
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
