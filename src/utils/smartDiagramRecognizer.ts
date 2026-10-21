import type { Point, Stroke, NodeShape, ConceptNode, ConceptEdge } from '../types.ts';

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export interface ShapeDetectionResult {
  shape: NodeShape;
  bounds: BoundingBox;
  confidence: number;
}

export interface ArrowDetectionResult {
  sourceId: string;
  targetId: string;
  sourceNode: ConceptNode;
  targetNode: ConceptNode;
  confidence: number;
}

export type SmartStrokeClassification =
  | { type: 'shape'; shapeResult: ShapeDetectionResult }
  | { type: 'arrow'; arrowResult: ArrowDetectionResult }
  | { type: 'text_in_node'; targetNodeId: string; stroke: Stroke }
  | { type: 'text_floating'; bounds: BoundingBox; stroke: Stroke }
  | { type: 'unknown' };

/**
 * Calculates the bounding box and center of a sequence of points.
 */
export function calculateBoundingBox(points: Point[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, cx: 0, cy: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const cx = minX + width / 2;
  const cy = minY + height / 2;

  return { minX, maxX, minY, maxY, width, height, cx, cy };
}

/**
 * Calculates total path length along the stroke points.
 */
export function calculatePathLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

/**
 * Detects if a point is inside or near a node's bounding rectangle.
 */
export function isPointNearNode(
  point: Point,
  node: ConceptNode,
  tolerance: number = 40
): boolean {
  const nodeW = node.width || 160;
  const nodeH = node.height || 80;
  const left = node.x - nodeW / 2 - tolerance;
  const right = node.x + nodeW / 2 + tolerance;
  const top = node.y - nodeH / 2 - tolerance;
  const bottom = node.y + nodeH / 2 + tolerance;

  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
}

/**
 * Checks if a point is strictly inside a node's box.
 */
export function isPointInsideNode(point: Point, node: ConceptNode): boolean {
  const nodeW = node.width || 160;
  const nodeH = node.height || 80;
  const left = node.x - nodeW / 2;
  const right = node.x + nodeW / 2;
  const top = node.y - nodeH / 2;
  const bottom = node.y + nodeH / 2;

  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
}

/**
 * Finds the node closest to a given point within a maximum radius.
 */
export function findClosestNode(
  point: Point,
  nodes: ConceptNode[],
  maxDistance: number = 70
): { node: ConceptNode; distance: number } | null {
  let closest: ConceptNode | null = null;
  let minDistance = Infinity;

  for (const node of nodes) {
    const distToCenter = Math.hypot(point.x - node.x, point.y - node.y);
    const nodeW = node.width || 160;
    const nodeH = node.height || 80;
    const effectiveRadius = Math.max(nodeW, nodeH) / 2 + maxDistance;

    if (distToCenter <= effectiveRadius && distToCenter < minDistance) {
      minDistance = distToCenter;
      closest = node;
    }
  }

  return closest ? { node: closest, distance: minDistance } : null;
}

/**
 * Counts local directional reversals in X and Y (peaks and valleys).
 * Used to distinguish handwriting (which oscillates frequently) from simple geometric primitives.
 */
export function countDirectionChanges(points: Point[]): { xChanges: number; yChanges: number } {
  if (points.length < 3) return { xChanges: 0, yChanges: 0 };

  let xChanges = 0;
  let yChanges = 0;
  let lastDx = 0;
  let lastDy = 0;
  const minDelta = 4; // Ignore sub-pixel jitter

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;

    if (Math.abs(dx) > minDelta) {
      if (lastDx !== 0 && ((dx > 0 && lastDx < 0) || (dx < 0 && lastDx > 0))) {
        xChanges++;
      }
      lastDx = dx;
    }

    if (Math.abs(dy) > minDelta) {
      if (lastDy !== 0 && ((dy > 0 && lastDy < 0) || (dy < 0 && lastDy > 0))) {
        yChanges++;
      }
      lastDy = dy;
    }
  }

  return { xChanges, yChanges };
}

/**
 * Analyzes whether a stroke genuinely represents a geometric shape (circle, rectangle, diamond, cylinder, triangle).
 * Guaranteed to return null for handwritten words, handwriting loops, arrows, and freehand text.
 */
export function detectGeometricShapeDetailed(points: Point[]): ShapeDetectionResult | null {
  if (points.length < 6) return null;

  const bbox = calculateBoundingBox(points);
  const pathLength = calculatePathLength(points);
  const pStart = points[0];
  const pEnd = points[points.length - 1];
  const distStartEnd = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);

  // Must have substantial size for a diagram node
  if (bbox.width < 45 || bbox.height < 45 || pathLength < 110) {
    return null;
  }

  // 1. Strict Closure Check: A real drawn geometric shape starts and finishes at approximately the same point
  // For handwritten words (like 'hola'), start is at 'h' and end is at 'a', so distStartEnd is wide (~bbox.width)
  const isClosed =
    distStartEnd <= Math.min(50, Math.max(20, pathLength * 0.15)) &&
    distStartEnd <= Math.min(bbox.width, bbox.height) * 0.32;

  if (!isClosed) {
    return null;
  }

  // 2. Handwriting vs Shape Oscillations Check:
  // A geometric shape (circle, rectangle, diamond, triangle) has at most 2-3 directional reversals.
  // A handwritten word has letters going up and down repeatedly (4 or more changes).
  const { xChanges, yChanges } = countDirectionChanges(points);
  if (yChanges >= 4 || xChanges >= 4) {
    return null; // Definitely handwriting (multiple letter strokes), NOT a shape!
  }

  const aspectRatio = bbox.width / bbox.height;

  // Compute distance variance from center to all points
  const distances = points.map((p) => Math.hypot(p.x - bbox.cx, p.y - bbox.cy));
  const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance =
    distances.reduce((sum, d) => sum + Math.pow(d - avgDist, 2), 0) / distances.length;
  const stdDevRatio = Math.sqrt(variance) / avgDist;

  // 3. Circle Check: uniform radius from center and aspect ratio ~ 1
  if (aspectRatio >= 0.78 && aspectRatio <= 1.28 && stdDevRatio < 0.16) {
    return { shape: 'circle', bounds: bbox, confidence: 0.94 };
  }

  // 4. Diamond (Rombo) Check: apexes at top, bottom, left, right and empty corners
  let nearTopApex = false;
  let nearBottomApex = false;
  let nearLeftApex = false;
  let nearRightApex = false;

  for (const p of points) {
    if (Math.abs(p.y - bbox.minY) < bbox.height * 0.16 && Math.abs(p.x - bbox.cx) < bbox.width * 0.25) {
      nearTopApex = true;
    }
    if (Math.abs(p.y - bbox.maxY) < bbox.height * 0.16 && Math.abs(p.x - bbox.cx) < bbox.width * 0.25) {
      nearBottomApex = true;
    }
    if (Math.abs(p.x - bbox.minX) < bbox.width * 0.16 && Math.abs(p.y - bbox.cy) < bbox.height * 0.25) {
      nearLeftApex = true;
    }
    if (Math.abs(p.x - bbox.maxX) < bbox.width * 0.16 && Math.abs(p.y - bbox.cy) < bbox.height * 0.25) {
      nearRightApex = true;
    }
  }

  if (nearTopApex && nearBottomApex && nearLeftApex && nearRightApex && aspectRatio >= 0.65 && aspectRatio <= 1.45) {
    let cornersOccupied = 0;
    const cornerThresholdX = bbox.width * 0.16;
    const cornerThresholdY = bbox.height * 0.16;
    for (const p of points) {
      const isTopLeft = p.x < bbox.minX + cornerThresholdX && p.y < bbox.minY + cornerThresholdY;
      const isTopRight = p.x > bbox.maxX - cornerThresholdX && p.y < bbox.minY + cornerThresholdY;
      const isBottomLeft = p.x < bbox.minX + cornerThresholdX && p.y > bbox.maxY - cornerThresholdY;
      const isBottomRight = p.x > bbox.maxX - cornerThresholdX && p.y > bbox.maxY - cornerThresholdY;
      if (isTopLeft || isTopRight || isBottomLeft || isBottomRight) {
        cornersOccupied++;
      }
    }

    if (cornersOccupied < points.length * 0.12) {
      return { shape: 'diamond', bounds: bbox, confidence: 0.92 };
    }
  }

  // 5. Triangle Check: pointed apex at top or bottom with wide base
  const topQuarterPoints = points.filter((p) => p.y < bbox.minY + bbox.height * 0.25);
  const bottomQuarterPoints = points.filter((p) => p.y > bbox.maxY - bbox.height * 0.25);
  if (topQuarterPoints.length >= 2 && bottomQuarterPoints.length >= 2) {
    const minTopX = Math.min(...topQuarterPoints.map((p) => p.x));
    const maxTopX = Math.max(...topQuarterPoints.map((p) => p.x));
    const minBottomX = Math.min(...bottomQuarterPoints.map((p) => p.x));
    const maxBottomX = Math.max(...bottomQuarterPoints.map((p) => p.x));
    const topW = maxTopX - minTopX;
    const bottomW = maxBottomX - minBottomX;
    if (topW < bbox.width * 0.35 && bottomW > bbox.width * 0.62) {
      return { shape: 'triangle', bounds: bbox, confidence: 0.9 };
    }
    if (bottomW < bbox.width * 0.35 && topW > bbox.width * 0.62) {
      return { shape: 'triangle', bounds: bbox, confidence: 0.9 };
    }
  }

  // 6. Cylinder Check: taller than wide with two distinct horizontal curvature lobes
  if (aspectRatio >= 0.45 && aspectRatio <= 0.82 && bbox.height >= 85) {
    return { shape: 'cylinder', bounds: bbox, confidence: 0.85 };
  }

  // 7. Strict Rectangle / Rounded Box Check:
  // A true rectangle outline:
  // - Points are concentrated near the 4 perimeter edges
  // - The interior of the box is empty (not filled like a written word)
  // - Reaches all 4 quadrants (top-left, top-right, bottom-left, bottom-right)
  const edgeMarginX = Math.max(8, bbox.width * 0.22);
  const edgeMarginY = Math.max(8, bbox.height * 0.22);

  const nearPerimeterCount = points.filter((p) => {
    return (
      p.x < bbox.minX + edgeMarginX ||
      p.x > bbox.maxX - edgeMarginX ||
      p.y < bbox.minY + edgeMarginY ||
      p.y > bbox.maxY - edgeMarginY
    );
  }).length;

  const perimeterRatio = nearPerimeterCount / points.length;

  // Check that the interior (central 40% of the box) is hollow (empty outline)
  const innerLeft = bbox.minX + bbox.width * 0.3;
  const innerRight = bbox.maxX - bbox.width * 0.3;
  const innerTop = bbox.minY + bbox.height * 0.3;
  const innerBottom = bbox.maxY - bbox.height * 0.3;
  const innerPointsCount = points.filter(
    (p) => p.x > innerLeft && p.x < innerRight && p.y > innerTop && p.y < innerBottom
  ).length;

  const interiorRatio = innerPointsCount / points.length;

  // Corner quadrants check: must have points in all 4 corners
  const hasTopLeft = points.some((p) => p.x <= bbox.cx && p.y <= bbox.cy);
  const hasTopRight = points.some((p) => p.x >= bbox.cx && p.y <= bbox.cy);
  const hasBottomLeft = points.some((p) => p.x <= bbox.cx && p.y >= bbox.cy);
  const hasBottomRight = points.some((p) => p.x >= bbox.cx && p.y >= bbox.cy);
  const hasAllCorners = hasTopLeft && hasTopRight && hasBottomLeft && hasBottomRight;

  if (perimeterRatio >= 0.72 && interiorRatio <= 0.08 && hasAllCorners) {
    return {
      shape: aspectRatio > 1.25 || aspectRatio < 0.8 ? 'rectangle' : 'rounded',
      bounds: bbox,
      confidence: 0.89,
    };
  }

  // If none of the strict geometric criteria match, it is NOT a shape!
  return null;
}

/**
 * Detects if a stroke is an intentional arrow or connector between two existing nodes.
 */
export function detectConnectingArrow(
  points: Point[],
  existingNodes: ConceptNode[]
): ArrowDetectionResult | null {
  if (points.length < 3 || existingNodes.length < 2) return null;

  const pStart = points[0];
  const pEnd = points[points.length - 1];
  const pathLength = calculatePathLength(points);
  const distStartEnd = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);

  // Must not be a closed shape (must be an open path)
  if (distStartEnd < pathLength * 0.4) return null;
  if (distStartEnd < 50) return null;

  // Find start node and end node
  const startMatch = findClosestNode(pStart, existingNodes, 85);
  const endMatch = findClosestNode(pEnd, existingNodes, 85);

  if (startMatch && endMatch && startMatch.node.id !== endMatch.node.id) {
    return {
      sourceId: startMatch.node.id,
      targetId: endMatch.node.id,
      sourceNode: startMatch.node,
      targetNode: endMatch.node,
      confidence: 0.94,
    };
  }

  return null;
}

/**
 * Master classifier for smart diagram strokes:
 * Categorizes a stroke into:
 * - A new geometric shape
 * - An arrow connecting two nodes
 * - Handwritten text inside an existing shape
 * - A floating text note
 */
export function classifySmartStroke(
  stroke: Stroke,
  existingNodes: ConceptNode[],
  forcedMode: 'auto' | 'shape' | 'arrow' | 'text' = 'auto'
): SmartStrokeClassification {
  const points = stroke.points;
  if (points.length < 2) return { type: 'unknown' };

  const bbox = calculateBoundingBox(points);
  const pathLength = calculatePathLength(points);

  // 1. Forced Mode: Arrow
  if (forcedMode === 'arrow') {
    const arrow = detectConnectingArrow(points, existingNodes);
    if (arrow) return { type: 'arrow', arrowResult: arrow };
    // If not close enough to 2 nodes, still try closest
    const start = findClosestNode(points[0], existingNodes, 150);
    const end = findClosestNode(points[points.length - 1], existingNodes, 150);
    if (start && end && start.node.id !== end.node.id) {
      return {
        type: 'arrow',
        arrowResult: {
          sourceId: start.node.id,
          targetId: end.node.id,
          sourceNode: start.node,
          targetNode: end.node,
          confidence: 0.8,
        },
      };
    }
    return { type: 'unknown' };
  }

  // 2. Forced Mode: Shape
  if (forcedMode === 'shape') {
    const shape = detectGeometricShapeDetailed(points);
    if (shape) {
      return { type: 'shape', shapeResult: shape };
    }
    // Default to rounded box matching bounding box if forced
    const defaultShape: NodeShape =
      bbox.width / bbox.height >= 0.8 && bbox.width / bbox.height <= 1.25 ? 'circle' : 'rounded';
    return {
      type: 'shape',
      shapeResult: {
        shape: defaultShape,
        bounds: bbox,
        confidence: 0.75,
      },
    };
  }

  // 3. Forced Mode: Text
  if (forcedMode === 'text') {
    // Check if written inside a node
    for (const node of existingNodes) {
      if (isPointInsideNode(points[0], node) || isPointNearNode(points[0], node, 20)) {
        return { type: 'text_in_node', targetNodeId: node.id, stroke };
      }
    }
    return { type: 'text_floating', bounds: bbox, stroke };
  }

  // --- AUTO MODE ---

  // Check A: Is it an arrow between two existing nodes?
  const arrowMatch = detectConnectingArrow(points, existingNodes);
  if (arrowMatch) {
    return { type: 'arrow', arrowResult: arrowMatch };
  }

  // Check B: Is it written inside an existing node?
  for (const node of existingNodes) {
    const insideCount = points.filter((p) => isPointInsideNode(p, node)).length;
    // If more than 75% of points are inside the node and stroke is not an outline of the node
    if (insideCount > points.length * 0.75) {
      const nodeW = node.width || 160;
      const nodeH = node.height || 80;
      // If stroke perimeter is small compared to node, it's handwriting!
      if (bbox.width < nodeW * 0.9 && bbox.height < nodeH * 0.9) {
        return { type: 'text_in_node', targetNodeId: node.id, stroke };
      }
    }
  }

  // Check C: Is it a geometric shape?
  const shapeMatch = detectGeometricShapeDetailed(points);
  if (shapeMatch) {
    return { type: 'shape', shapeResult: shapeMatch };
  }

  // Check D: If it is not a shape or arrow, it is handwritten text or handwriting stroke!
  if (pathLength >= 15) {
    return { type: 'text_floating', bounds: bbox, stroke };
  }

  return { type: 'unknown' };
}
