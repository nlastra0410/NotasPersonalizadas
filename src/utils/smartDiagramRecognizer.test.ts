import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBoundingBox,
  calculatePathLength,
  detectGeometricShapeDetailed,
  detectConnectingArrow,
  classifySmartStroke,
} from './smartDiagramRecognizer.ts';
import type { Point, Stroke, ConceptNode } from '../types.ts';

describe('smartDiagramRecognizer', () => {
  it('calculates bounding box and path length accurately', () => {
    const points: Point[] = [
      { x: 10, y: 20 },
      { x: 30, y: 20 },
      { x: 30, y: 50 },
    ];
    const bbox = calculateBoundingBox(points);
    assert.equal(bbox.minX, 10);
    assert.equal(bbox.maxX, 30);
    assert.equal(bbox.minY, 20);
    assert.equal(bbox.maxY, 50);
    assert.equal(bbox.width, 20);
    assert.equal(bbox.height, 30);
    assert.equal(bbox.cx, 20);
    assert.equal(bbox.cy, 35);

    const length = calculatePathLength(points);
    assert.equal(length, 20 + 30); // 20 horizontal + 30 vertical
  });

  it('detects a circular shape when drawing a closed loop with uniform radius', () => {
    const points: Point[] = [];
    const cx = 300;
    const cy = 300;
    const radius = 60;
    const steps = 30;

    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      points.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    }

    const shape = detectGeometricShapeDetailed(points);
    assert.ok(shape !== null);
    assert.equal(shape?.shape, 'circle');
  });

  it('detects a rectangular shape when drawing an elongated box', () => {
    const points: Point[] = [
      { x: 100, y: 100 },
      { x: 260, y: 100 },
      { x: 260, y: 170 },
      { x: 100, y: 170 },
      { x: 100, y: 100 },
    ];

    // Interpolate points along edges so length and point count match natural drawing
    const densePoints: Point[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      for (let s = 0; s < 8; s++) {
        const t = s / 8;
        densePoints.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
        });
      }
    }
    densePoints.push(points[points.length - 1]);

    const shape = detectGeometricShapeDetailed(densePoints);
    assert.ok(shape !== null);
    assert.equal(shape?.shape, 'rectangle');
  });

  it('detects a triangle when drawing 3 corners with apex', () => {
    // Triangle: (200, 100) -> (100, 260) -> (300, 260) -> (200, 100)
    const points: Point[] = [
      { x: 200, y: 100 },
      { x: 100, y: 260 },
      { x: 300, y: 260 },
      { x: 200, y: 100 },
    ];
    const densePoints: Point[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      for (let s = 0; s < 10; s++) {
        const t = s / 10;
        densePoints.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
        });
      }
    }
    densePoints.push(points[points.length - 1]);

    const shape = detectGeometricShapeDetailed(densePoints);
    assert.ok(shape !== null);
    assert.equal(shape?.shape, 'triangle');
  });

  it('detects an arrow connecting two existing nodes', () => {
    const nodeA: ConceptNode = {
      id: 'node-a',
      label: 'Inicio',
      x: 100,
      y: 100,
      color: '#3b82f6',
      width: 120,
      height: 60,
    };
    const nodeB: ConceptNode = {
      id: 'node-b',
      label: 'Servidor',
      x: 350,
      y: 100,
      color: '#10b981',
      width: 120,
      height: 60,
    };

    // Stroke from edge of nodeA to edge of nodeB
    const points: Point[] = [
      { x: 160, y: 100 },
      { x: 220, y: 100 },
      { x: 290, y: 100 },
    ];

    const arrow = detectConnectingArrow(points, [nodeA, nodeB]);
    assert.ok(arrow !== null);
    assert.equal(arrow?.sourceId, 'node-a');
    assert.equal(arrow?.targetId, 'node-b');
  });

  it('classifies strokes correctly in auto mode', () => {
    const nodeA: ConceptNode = {
      id: 'node-1',
      label: 'Base de datos',
      x: 200,
      y: 200,
      color: '#3b82f6',
      width: 160,
      height: 80,
    };

    // Stroke drawn inside nodeA
    const textStroke: Stroke = {
      id: 's-text',
      points: [
        { x: 190, y: 195 },
        { x: 200, y: 205 },
        { x: 210, y: 198 },
      ],
      tool: 'pen',
      color: '#000000',
      size: 2,
      opacity: 1,
      timestamp: Date.now(),
    };

    const result = classifySmartStroke(textStroke, [nodeA], 'auto');
    assert.equal(result.type, 'text_in_node');
    if (result.type === 'text_in_node') {
      assert.equal(result.targetNodeId, 'node-1');
    }
  });

  it('guarantees that a handwritten word like "hola" is NEVER recognized as a rectangle or shape', () => {
    // Simulating cursive handwriting points for "hola"
    // Multiple letters with vertical oscillations (peaks and valleys) across a 160px width
    const holaPoints: Point[] = [
      // 'h': down, up, hump down
      { x: 50, y: 100 },
      { x: 50, y: 150 },
      { x: 52, y: 120 },
      { x: 65, y: 110 },
      { x: 75, y: 150 },
      // 'o': loop
      { x: 80, y: 135 },
      { x: 90, y: 125 },
      { x: 100, y: 135 },
      { x: 95, y: 150 },
      { x: 85, y: 145 },
      // 'l': tall stroke
      { x: 110, y: 100 },
      { x: 112, y: 150 },
      // 'a': loop and tail
      { x: 125, y: 135 },
      { x: 135, y: 125 },
      { x: 145, y: 135 },
      { x: 140, y: 150 },
      { x: 155, y: 148 },
    ];

    const detected = detectGeometricShapeDetailed(holaPoints);
    assert.equal(detected, null, 'Handwritten word "hola" must NOT be detected as a geometric shape or rectangle!');

    const stroke: Stroke = {
      id: 'hola-stroke',
      points: holaPoints,
      tool: 'pen',
      color: '#2563eb',
      size: 3,
      opacity: 1,
      timestamp: Date.now(),
    };

    const classification = classifySmartStroke(stroke, [], 'auto');
    assert.equal(classification.type, 'text_floating', 'Handwritten word must be classified as floating text!');
  });
});
