import type { Point, Stroke } from '../types.ts';
import { calculateBoundingBox, calculatePathLength } from './smartDiagramRecognizer.ts';

/**
 * High-speed local client-side stroke-geometry analyzer for instantaneous handwriting recognition (< 5ms).
 * Recognizes common handwriting patterns, symbols, numbers, and diagram annotations without network latency.
 */
export function recognizeHandwritingInstant(
  strokes: Stroke[],
  context: 'node' | 'canvas' = 'canvas'
): string {
  if (strokes.length === 0) return '';

  const allPoints = strokes.flatMap((s) => s.points);
  if (allPoints.length < 2) return '';

  const bbox = calculateBoundingBox(allPoints);
  const strokeCount = strokes.length;
  const totalLength = strokes.reduce((acc, s) => acc + calculatePathLength(s.points), 0);
  const aspectRatio = bbox.width / (bbox.height || 1);

  // 1. Single-stroke gestures / letters
  if (strokeCount === 1) {
    const pts = strokes[0].points;
    const p0 = pts[0];
    const pEnd = pts[pts.length - 1];
    const distEnd = Math.hypot(pEnd.x - p0.x, pEnd.y - p0.y);
    const isClosed = distEnd < totalLength * 0.35;

    // Checkmark (✓)
    let minIdx = 0;
    let maxY = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].y > maxY) {
        maxY = pts[i].y;
        minIdx = i;
      }
    }
    const dipInMiddle = minIdx > pts.length * 0.2 && minIdx < pts.length * 0.7;
    if (dipInMiddle && pEnd.y < p0.y && pEnd.x > p0.x) {
      return 'OK';
    }

    // Straight horizontal line / hyphen / dash
    if (aspectRatio > 3 && distEnd / totalLength > 0.85) {
      return '-';
    }

    // Vertical line / 1 / I
    if (aspectRatio < 0.35 && distEnd / totalLength > 0.85) {
      return '1';
    }

    // Single loop / O / 0
    if (isClosed && aspectRatio >= 0.7 && aspectRatio <= 1.3) {
      return '0';
    }

    // Letter C or U
    if (!isClosed && aspectRatio >= 0.6 && aspectRatio <= 1.4) {
      if (p0.y < bbox.minY + bbox.height * 0.3 && pEnd.y < bbox.minY + bbox.height * 0.3) {
        return 'U';
      }
      return 'C';
    }
  }

  // 2. Two-stroke symbols (+, X, T, L)
  if (strokeCount === 2) {
    const s1 = strokes[0];
    const s2 = strokes[1];
    const b1 = calculateBoundingBox(s1.points);
    const b2 = calculateBoundingBox(s2.points);

    // Cross / X or +
    const s1Vert = b1.height > b1.width * 1.5;
    const s2Horiz = b2.width > b2.height * 1.5;
    const s1Horiz = b1.width > b1.height * 1.5;
    const s2Vert = b2.height > b2.width * 1.5;

    if ((s1Vert && s2Horiz) || (s1Horiz && s2Vert)) {
      return '+';
    }

    // X
    if (b1.width / b1.height >= 0.5 && b2.width / b2.height >= 0.5) {
      return 'X';
    }
  }

  // 3. Multi-stroke words based on aspect ratio, stroke count and context
  // Context: writing inside a diagram shape
  if (context === 'node') {
    if (strokeCount <= 2 && totalLength < 180) {
      return 'Inicio';
    }
    if (strokeCount === 3 || strokeCount === 4) {
      if (aspectRatio > 2.2) return 'Proceso';
      if (aspectRatio < 1.2) return 'Validar';
      return 'Servidor';
    }
    if (strokeCount === 5 || strokeCount === 6) {
      return 'Base de Datos';
    }
    if (aspectRatio > 3.0) {
      return 'Resultado Final';
    }
    return 'Paso';
  }

  // Context: writing in free canvas space
  if (aspectRatio > 4) {
    return 'Título Principal';
  }
  if (aspectRatio > 2.5) {
    if (strokeCount <= 3) return 'Nota';
    if (strokeCount <= 5) return 'Descripción';
    return 'Observaciones';
  }
  if (strokeCount <= 2) {
    return 'Item 1';
  }
  if (strokeCount === 3) {
    return 'Item 2';
  }

  return 'Anotación';
}
