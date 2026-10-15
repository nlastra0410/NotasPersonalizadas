import test from 'node:test';
import assert from 'node:assert/strict';
import {
  predictNextPoint,
  detectGeometricShape,
  generateCleanShapePoints,
  getSpanishWordPredictions,
  predictPunctuation,
} from './predictiveInk.ts';
import type { Point } from './inkSmoothing.ts';

test('predictNextPoint extrapolates future point along movement vector', () => {
  const points: Point[] = [
    { x: 10, y: 10 },
    { x: 20, y: 10 },
  ];
  const predicted = predictNextPoint(points, 5);
  assert.ok(predicted !== null);
  assert.equal(predicted.x, 25);
  assert.equal(predicted.y, 10);
});

test('detectGeometricShape identifies straight lines', () => {
  const straightLine: Point[] = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 40, y: 0 },
    { x: 60, y: 0 },
    { x: 80, y: 0 },
    { x: 100, y: 0 },
  ];
  const shape = detectGeometricShape(straightLine);
  assert.equal(shape.type, 'line');
  assert.ok(shape.confidence > 0.9);
});

test('detectGeometricShape identifies closed circular loops', () => {
  const circlePoints: Point[] = [];
  const count = 16;
  const radius = 50;
  for (let i = 0; i <= count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    circlePoints.push({
      x: 100 + Math.cos(angle) * radius,
      y: 100 + Math.sin(angle) * radius,
    });
  }
  const shape = detectGeometricShape(circlePoints);
  assert.equal(shape.type, 'circle');
});

test('generateCleanShapePoints creates clean points', () => {
  const rect = generateCleanShapePoints(
    [
      { x: 10, y: 10 },
      { x: 50, y: 40 },
    ],
    'rectangle'
  );
  assert.equal(rect.length, 5);
  assert.equal(rect[0].x, 10);
  assert.equal(rect[0].y, 10);
});

test('getSpanishWordPredictions suggests contextual words', () => {
  // Test prefix match
  const preds1 = getSpanishWordPredictions('pla');
  assert.ok(preds1.includes('Planificación'));

  // Test follow-up match
  const preds2 = getSpanishWordPredictions('reunion');
  assert.ok(preds2.includes('con el equipo'));

  // Empty returns defaults
  const preds3 = getSpanishWordPredictions('');
  assert.ok(preds3.length > 0);
});

test('predictPunctuation formats sentences and questions properly', () => {
  const res1 = predictPunctuation('hola equipo esto es una prueba');
  assert.equal(res1, 'Hola equipo esto es una prueba');

  const res2 = predictPunctuation('cómo funciona este diagrama');
  assert.equal(res2, '¿Cómo funciona este diagrama?');
});
