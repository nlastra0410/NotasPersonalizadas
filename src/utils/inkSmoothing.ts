/**
 * Ink smoothing and point calculation utilities for tablet stylus writing.
 */

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
}

export type PenTool = 'pen' | 'fountain' | 'highlighter' | 'brush' | 'eraser';

export interface Stroke {
  id: string;
  points: Point[];
  tool: PenTool;
  color: string;
  size: number;
  opacity: number;
  timestamp: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Calculates Euclidean distance between two points.
 */
export function getDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the midpoint between two points.
 */
export function getMidPoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    pressure: ((p1.pressure ?? 0.5) + (p2.pressure ?? 0.5)) / 2,
    time: ((p1.time ?? 0) + (p2.time ?? 0)) / 2,
  };
}

/**
 * Computes dynamic line width based on tool type, base size, and stylus pressure.
 */
export function getDynamicStrokeWidth(
  baseSize: number,
  tool: PenTool,
  pressure: number = 0.5,
  velocity: number = 0
): number {
  const normPressure = Math.max(0.1, Math.min(1.0, pressure));

  switch (tool) {
    case 'fountain': {
      // Dynamic calligraphy pen: reacts sharply to pressure and speed
      const pressureFactor = normPressure * 1.6;
      const speedDamping = Math.max(0.6, 1.0 - Math.min(0.4, velocity * 0.05));
      return Math.max(1, baseSize * pressureFactor * speedDamping);
    }
    case 'brush': {
      // Artistic brush: very wide dynamic range
      return Math.max(1.5, baseSize * (0.3 + normPressure * 1.4));
    }
    case 'highlighter': {
      // Highlighter maintains a broad consistent chisel width
      return baseSize * 2.5;
    }
    case 'eraser': {
      return baseSize * 3.0;
    }
    case 'pen':
    default: {
      // Standard ballpoint/fineliner: subtle pressure response
      return Math.max(1, baseSize * (0.7 + normPressure * 0.6));
    }
  }
}

/**
 * Calculates the bounding box that encapsulates a collection of strokes.
 */
export function getStrokesBoundingBox(strokes: Stroke[], padding: number = 10): BoundingBox | null {
  if (strokes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  let hasPoints = false;
  for (const stroke of strokes) {
    for (const pt of stroke.points) {
      hasPoints = true;
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  if (!hasPoints) return null;

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = maxX + padding;
  maxY = maxY + padding;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Simplifies a sequence of points to remove redundant micro-jitters.
 */
export function simplifyPoints(points: Point[], minDistance: number = 1.5): Point[] {
  if (points.length <= 2) return [...points];

  const result: Point[] = [points[0]];
  let lastAdded = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    if (getDistance(lastAdded, current) >= minDistance) {
      result.push(current);
      lastAdded = current;
    }
  }

  // Always keep the terminal endpoint
  result.push(points[points.length - 1]);
  return result;
}
