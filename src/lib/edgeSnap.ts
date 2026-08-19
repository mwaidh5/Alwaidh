/** A pixel in the picture being edited. */
export interface Point {
  x: number;
  y: number;
}

/** Below this, whatever is nearby is texture or noise rather than an edge. */
const MIN_EDGE = 24;

/**
 * Measure how sharply the colour changes at every pixel (a Sobel edge
 * map) — this is what the magnetic lasso follows.
 *
 * Transparency is folded into the brightness, so the border of an area
 * that has already been rubbed out reads as an edge like any other.
 */
export function buildEdgeMap(
  pixels: Uint8ClampedArray | number[],
  width: number,
  height: number,
): Float32Array {
  const grey = new Float32Array(width * height);
  for (let i = 0, p = 0; i < grey.length; i++, p += 4) {
    const alpha = pixels[p + 3] / 255;
    grey[i] = (0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2]) * alpha;
  }
  const out = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const tl = grey[i - width - 1];
      const t = grey[i - width];
      const tr = grey[i - width + 1];
      const l = grey[i - 1];
      const r = grey[i + 1];
      const bl = grey[i + width - 1];
      const b = grey[i + width];
      const br = grey[i + width + 1];
      const gx = tl + 2 * l + bl - (tr + 2 * r + br);
      const gy = tl + 2 * t + tr - (bl + 2 * b + br);
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

/**
 * How far the lasso reaches for an edge. Measured against the picture's
 * real size, not the screen: the canvas on show is scaled down, so a fixed
 * number of pixels would feel grabby on a small photo and useless on a
 * large one.
 */
export function snapRadius(width: number, height: number): number {
  return Math.max(4, Math.round(Math.max(width, height) / 100));
}

/**
 * Pull a point onto the nearest strong edge. Closer edges beat stronger
 * ones further away, so the line follows the shape being traced instead of
 * jumping to a bolder one nearby; in a flat area, where there is nothing
 * worth sticking to, the point is left exactly where it was.
 */
export function snapToEdge(
  map: Float32Array,
  width: number,
  height: number,
  point: Point,
  radius = snapRadius(width, height),
): Point {
  const cx = Math.round(point.x);
  const cy = Math.round(point.y);
  let best = point;
  let bestScore = -1;
  for (let dy = -radius; dy <= radius; dy++) {
    const y = cy + dy;
    if (y < 1 || y >= height - 1) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      if (x < 1 || x >= width - 1) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const score = map[y * width + x] * (1 - (0.6 * dist) / radius);
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return bestScore > MIN_EDGE ? best : point;
}
