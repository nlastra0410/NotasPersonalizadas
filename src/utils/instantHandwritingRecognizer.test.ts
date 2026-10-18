import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recognizeHandwritingInstant } from './instantHandwritingRecognizer.ts';
import type { Stroke } from '../types.ts';

describe('instantHandwritingRecognizer', () => {
  it('recognizes a checkmark gesture instantly', () => {
    // V checkmark
    const stroke: Stroke = {
      id: 's1',
      points: [
        { x: 10, y: 15 },
        { x: 20, y: 35 },
        { x: 45, y: 5 },
      ],
      tool: 'pen',
      color: '#000',
      size: 2,
      opacity: 1,
      timestamp: Date.now(),
    };
    const res = recognizeHandwritingInstant([stroke]);
    assert.equal(res, 'OK');
  });

  it('recognizes vertical stroke as 1', () => {
    const stroke: Stroke = {
      id: 's1',
      points: [
        { x: 20, y: 10 },
        { x: 20, y: 25 },
        { x: 20, y: 60 },
      ],
      tool: 'pen',
      color: '#000',
      size: 2,
      opacity: 1,
      timestamp: Date.now(),
    };
    const res = recognizeHandwritingInstant([stroke]);
    assert.equal(res, '1');
  });

  it('recognizes horizontal stroke as dash', () => {
    const stroke: Stroke = {
      id: 's1',
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 20 },
        { x: 60, y: 20 },
      ],
      tool: 'pen',
      color: '#000',
      size: 2,
      opacity: 1,
      timestamp: Date.now(),
    };
    const res = recognizeHandwritingInstant([stroke]);
    assert.equal(res, '-');
  });

  it('recognizes multi-stroke writing inside a node', () => {
    const s1: Stroke = {
      id: 's1',
      points: [{ x: 10, y: 10 }, { x: 10, y: 30 }],
      tool: 'pen',
      color: '#000',
      size: 2,
      opacity: 1,
      timestamp: Date.now(),
    };
    const s2: Stroke = {
      id: 's2',
      points: [{ x: 20, y: 10 }, { x: 20, y: 30 }],
      tool: 'pen',
      color: '#000',
      size: 2,
      opacity: 1,
      timestamp: Date.now(),
    };
    const res = recognizeHandwritingInstant([s1, s2], 'node');
    assert.ok(res.length > 0);
  });
});
