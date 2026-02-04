export interface GodOrthoFrustum {
  left: number
  right: number
  top: number
  bottom: number
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value))
    return min
  return Math.max(min, Math.min(max, value))
}

/**
 * Compute an orthographic camera frustum that fits the whole maze (centered at the maze center).
 *
 * Coordinates assume the maze spans x:[0, cols], z:[0, rows] in world units.
 *
 * - `aspect` is the viewport aspect ratio (width / height).
 * - `zoom` is a zoom-out multiplier (>= 1 shows more area).
 */
export function computeGodOrthoFrustum(
  cols: number,
  rows: number,
  aspect: number,
  zoom = 1,
): GodOrthoFrustum {
  const safeCols = Math.floor(clampNumber(cols, 1, 5000))
  const safeRows = Math.floor(clampNumber(rows, 1, 5000))
  const safeAspect = clampNumber(aspect, 0.1, 10)
  const safeZoom = clampNumber(zoom, 1, 10)

  // Small padding so outer walls/border helpers don't get clipped.
  const padding = 0.9

  let halfW = (safeCols / 2 + padding) * safeZoom
  let halfH = (safeRows / 2 + padding) * safeZoom

  // Expand the smaller axis to match viewport aspect ratio while keeping the maze fully visible.
  if (safeAspect >= halfW / halfH) {
    halfW = halfH * safeAspect
  }
  else {
    halfH = halfW / safeAspect
  }

  return {
    left: -halfW,
    right: halfW,
    top: halfH,
    bottom: -halfH,
  }
}
