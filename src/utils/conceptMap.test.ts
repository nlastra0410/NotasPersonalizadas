import test from 'node:test';
import assert from 'node:assert/strict';
import {
  purgeOrphanEdges,
  autoLayoutNodes,
  graphToMarkdown,
  textLinesToConceptNodes,
} from './conceptMap.ts';
import type { ConceptNode, ConceptEdge, ConceptGraph } from './conceptMap.ts';

test('purgeOrphanEdges eliminates edges pointing to missing nodes', () => {
  const nodes: ConceptNode[] = [
    { id: 'a', label: 'Node A', x: 0, y: 0, color: '#3b82f6' },
    { id: 'b', label: 'Node B', x: 10, y: 10, color: '#10b981' },
  ];
  const edges: ConceptEdge[] = [
    { id: 'e1', sourceId: 'a', targetId: 'b', label: 'relates' },
    { id: 'e2', sourceId: 'a', targetId: 'c', label: 'broken' }, // node c doesn't exist
  ];

  const purged = purgeOrphanEdges(nodes, edges);
  assert.equal(purged.length, 1);
  assert.equal(purged[0].id, 'e1');
});

test('autoLayoutNodes sets radial positions correctly', () => {
  const nodes: ConceptNode[] = [
    { id: '1', label: 'Central', x: 0, y: 0, color: '#3b82f6' },
    { id: '2', label: 'Sub 1', x: 0, y: 0, color: '#10b981' },
    { id: '3', label: 'Sub 2', x: 0, y: 0, color: '#f59e0b' },
  ];

  const laidOut = autoLayoutNodes(nodes, 400, 300, 200);
  assert.equal(laidOut.length, 3);
  // Ensure not all nodes stay at 0, 0
  assert.notEqual(laidOut[0].x, 0);
  assert.notEqual(laidOut[0].y, 0);
});

test('textLinesToConceptNodes creates central root with connecting children', () => {
  const { nodes, edges } = textLinesToConceptNodes('Inteligencia Artificial', [
    'Machine Learning',
    'Deep Learning',
    'Visión Computacional',
  ]);

  assert.equal(nodes.length, 4); // 1 root + 3 children
  assert.equal(nodes[0].label, 'Inteligencia Artificial');
  assert.equal(edges.length, 3);
  assert.equal(edges[0].sourceId, 'node-root');
});

test('graphToMarkdown outputs structured text', () => {
  const graph: ConceptGraph = {
    id: 'g1',
    title: 'Ecosistema',
    nodes: [
      { id: 'n1', label: 'Productores', description: 'Plantas y algas', x: 0, y: 0, color: '#10b981' },
      { id: 'n2', label: 'Consumidores', description: 'Herbívoros y carnívoros', x: 10, y: 10, color: '#3b82f6' },
    ],
    edges: [{ id: 'e1', sourceId: 'n1', targetId: 'n2', label: 'alimentan a' }],
  };

  const md = graphToMarkdown(graph);
  assert.ok(md.includes('# Ecosistema'));
  assert.ok(md.includes('### Productores'));
  assert.ok(md.includes('alimentan a'));
});
