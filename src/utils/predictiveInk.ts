/**
 * Predictive handwriting math, path extrapolation, shape detection,
 * snapping, and Spanish predictive text suggestions.
 */
import type { Point } from './inkSmoothing.ts';

/**
 * Extrapolates future points along the tangent vector for zero-lag stylus response.
 */
export function predictNextPoint(points: Point[], lookaheadDistance: number = 4): Point | null {
  if (points.length < 2) return null;

  const pLast = points[points.length - 1];
  const pPrev = points[points.length - 2];

  const dx = pLast.x - pPrev.x;
  const dy = pLast.y - pPrev.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 0.5) return null;

  const normX = dx / dist;
  const normY = dy / dist;

  return {
    x: pLast.x + normX * lookaheadDistance,
    y: pLast.y + normY * lookaheadDistance,
    pressure: pLast.pressure ?? 0.5,
    time: (pLast.time ?? Date.now()) + 16,
  };
}

/**
 * Detects if a hand-drawn stroke closely resembles a circle, rectangle, or straight line.
 */
export function detectGeometricShape(
  points: Point[]
): { type: 'circle' | 'rectangle' | 'line' | null; confidence: number } {
  if (points.length < 6) return { type: null, confidence: 0 };

  const pStart = points[0];
  const pEnd = points[points.length - 1];
  const distStartEnd = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);

  // Total stroke length along trajectory
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    pathLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }

  if (pathLength < 20) return { type: null, confidence: 0 };

  // 1. Straight Line Check: pathLength / distStartEnd is very close to 1.0
  const straightnessRatio = distStartEnd / pathLength;
  if (straightnessRatio > 0.94) {
    return { type: 'line', confidence: straightnessRatio };
  }

  // 2. Closed Loop Check: start and end are close together
  const isClosed = distStartEnd < pathLength * 0.28;
  if (isClosed && points.length > 10) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = width / (height || 1);

    if (aspectRatio >= 0.72 && aspectRatio <= 1.38) {
      return { type: 'circle', confidence: 0.88 };
    } else {
      return { type: 'rectangle', confidence: 0.82 };
    }
  }

  return { type: null, confidence: 0 };
}

/**
 * Generates an idealized, clean set of points for a recognized geometric shape.
 */
export function generateCleanShapePoints(
  points: Point[],
  shapeType: 'circle' | 'rectangle' | 'line'
): Point[] {
  if (points.length < 2) return points;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const pStart = points[0];
  const pEnd = points[points.length - 1];

  if (shapeType === 'line') {
    return [
      { x: pStart.x, y: pStart.y, pressure: 0.5 },
      { x: pEnd.x, y: pEnd.y, pressure: 0.5 },
    ];
  }

  if (shapeType === 'rectangle') {
    return [
      { x: minX, y: minY, pressure: 0.5 },
      { x: maxX, y: minY, pressure: 0.5 },
      { x: maxX, y: maxY, pressure: 0.5 },
      { x: minX, y: maxY, pressure: 0.5 },
      { x: minX, y: minY, pressure: 0.5 },
    ];
  }

  if (shapeType === 'circle') {
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const radius = Math.max((maxX - minX) / 2, (maxY - minY) / 2);
    const circlePoints: Point[] = [];
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const angle = (i * 2 * Math.PI) / segments;
      circlePoints.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        pressure: 0.5,
      });
    }
    return circlePoints;
  }

  return points;
}

// Common Spanish predictive vocabulary and contextual continuations
const SPANISH_VOCABULARY = [
  'Reunión', 'Objetivos', 'Estrategia', 'Proyecto', 'Planificación',
  'Desarrollo', 'Diseño', 'Arquitectura', 'Tareas', 'Importante',
  'Pendiente', 'Terminado', 'Revisar', 'Confirmar', 'Presupuesto',
  'Investigación', 'Cliente', 'Servidor', 'Base de datos', 'Sistema',
  'Calidad', 'Entrega', 'Pruebas', 'Proceso', 'Decisión', 'Diagrama',
];

const PREDICTIVE_FOLLOW_UPS: Record<string, string[]> = {
  reunion: ['con el equipo', 'de seguimiento', 'de diseño', 'urgente'],
  proyecto: ['de desarrollo', 'de investigación', 'aprobado', 'en curso'],
  revisar: ['documentación', 'código', 'diseño', 'entregables'],
  importante: ['completar hoy', 'enviar reporte', 'revisar métricas'],
  sistema: ['de información', 'distribuido', 'operativo', 'en la nube'],
  lista: ['de tareas', 'de compras', 'de verificación'],
  plan: ['de acción', 'de contingencia', 'de trabajo'],
  diagrama: ['de flujo', 'de arquitectura', 'conceptual', 'mental'],
};

/**
 * Returns predictive suggestions in Spanish based on the active word or sentence.
 */
export function getSpanishWordPredictions(currentInput: string): string[] {
  const trimmed = (currentInput || '').trim().toLowerCase();
  if (!trimmed) {
    return ['Proyecto', 'Reunión', 'Tareas', 'Importante', 'Diagrama'];
  }

  const words = trimmed.split(/\s+/);
  const lastWord = words[words.length - 1];

  // 1. Follow-up suggestions for the previous completed word
  if (PREDICTIVE_FOLLOW_UPS[lastWord]) {
    return PREDICTIVE_FOLLOW_UPS[lastWord];
  }

  // 2. Autocomplete matching vocabulary by prefix
  const matching = SPANISH_VOCABULARY.filter((vocab) =>
    vocab.toLowerCase().startsWith(lastWord)
  );

  if (matching.length > 0) {
    return matching.slice(0, 5);
  }

  // 3. Fallback common completions
  return ['continuar', 'finalizar', 'objetivo', 'detalle', 'flujo'];
}

/**
 * Predicts and formats Spanish punctuation for speech dictation.
 */
export function predictPunctuation(rawText: string): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // Capitalize start
  text = text.charAt(0).toUpperCase() + text.slice(1);

  // Capitalize after periods
  text = text.replace(/([.!?])\s+([a-záéíóúñ])/g, (_, p, c) => `${p} ${c.toUpperCase()}`);

  // Detect Spanish questions starting with interrogative keywords
  const questionWords = ['cómo', 'como', 'cuándo', 'cuando', 'qué', 'que', 'dónde', 'donde', 'por qué', 'porque', 'quién', 'quien', 'cuál', 'cual'];
  const firstWord = text.split(/\s+/)[0]?.toLowerCase().replace(/[¿?¡!]/g, '');

  if (firstWord && questionWords.includes(firstWord) && !text.endsWith('?')) {
    if (!text.startsWith('¿')) {
      text = '¿' + text;
    }
    if (!text.endsWith('?')) {
      text = text + '?';
    }
  }

  return text;
}
