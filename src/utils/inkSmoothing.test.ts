import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDistance,
  getMidPoint,
  getDynamicStrokeWidth,
  getStrokesBoundingBox,
  simplifyPoints,
} from './inkSmoothing.ts';
import type { Stroke } from './inkSmoothing.ts';

test('getDistance returns accurate Euclidean distance', () => {
  const d = getDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
  assert.equal(d, 5);
});

test('getMidPoint calculates midpoint and interpolates pressure', () => {
  const mid = getMidPoint({ x: 10, y: 20, pressure: 0.2 }, { x: 30, y: 40, pressure: 0.8 });
  assert.equal(mid.x, 20);
  assert.equal(mid.y, 30);
  assert.equal(mid.pressure, 0.5);
});

test('getDynamicStrokeWidth adapts properly across tools', () => {
  const baseSize = 4;
  const penWidthLow = getDynamicStrokeWidth(baseSize, 'pen', 0.2);
  const penWidthHigh = getDynamicStrokeWidth(baseSize, 'pen', 1.0);
  assert.ok(penWidthHigh > penWidthLow, 'Pen width increases with pressure');

  const highlighterWidth = getDynamicStrokeWidth(baseSize, 'highlighter', 0.5);
  assert.equal(highlighterWidth, baseSize * 2.5);

  const fountainWidth = getDynamicStrokeWidth(baseSize, 'fountain', 0.8, 0);
  assert.ok(fountainWidth > baseSize, 'Fountain pen widens under high pressure');
});

test('getStrokesBoundingBox computes tight bounding box with padding', () => {
  const testStroke: Stroke = {
    id: 's1',
    tool: 'pen',
    color: '#000000',
    size: 2,
    opacity: 1,
    timestamp: Date.now(),
    points: [
      { x: 50, y: 100 },
      { x: 150, y: 300 },
    ],
  };

  const bbox = getStrokesBoundingBox([testStroke], 10);
  assert.ok(bbox !== null);
  assert.equal(bbox.minX, 40);
  assert.equal(bbox.minY, 90);
  assert.equal(bbox.maxX, 160);
  assert.equal(bbox.maxY, 310);
  assert.equal(bbox.width, 120);
  assert.equal(bbox.height, 220);
});

test('simplifyPoints reduces jitter while keeping ends', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 0.2, y: 0.1 }, // jitter
    { x: 0.3, y: 0.2 }, // jitter
    { x: 10, y: 10 },
    { x: 20, y: 20 },
  ];

  const simplified = simplifyPoints(points, 2.0);
  assert.ok(simplified.length < points.length, 'Points should be reduced');
  assert.deepEqual(simplified[0], points[0], 'First point preserved');
  assert.deepEqual(simplified[simplified.length - 1], points[points.length - 1], 'Last point preserved');
});
