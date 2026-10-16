import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAllContent } from './searchIndex.ts';
import type { NoteItem, TaskItem, ConceptGraph } from '../types.ts';

const testNotes: NoteItem[] = [
  {
    id: 'n-1',
    title: 'Arquitectura Frontend',
    content: 'Diseño modular con Vite y React',
    strokes: [],
    paperStyle: 'blank',
    notebookId: 'nb-1',
    tags: [],
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    createdAt: 100,
    updatedAt: 100,
  },
  {
    id: 'n-2',
    title: 'Apunte Manuscrito',
    content: '',
    ocrText: 'Reunión de planificación de sprint con el equipo',
    strokes: [],
    paperStyle: 'blank',
    notebookId: 'nb-1',
    tags: [],
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    createdAt: 200,
    updatedAt: 200,
    audioNote: {
      transcript: 'El cliente aprobó la propuesta técnica',
      timestamp: 250,
    },
  },
];

const testTasks: TaskItem[] = [
  {
    id: 't-1',
    text: 'Entregar reporte financiero',
    completed: false,
    priority: 'high',
    createdAt: 100,
  },
];

const testGraph: ConceptGraph = {
  id: 'g-1',
  title: 'Flujo de Compra',
  diagramType: 'flowchart',
  nodes: [
    {
      id: 'node-checkout',
      label: 'Pantalla de Checkout',
      description: 'Pasarela de pago',
      x: 100,
      y: 100,
      color: '#3b82f6',
    },
  ],
  edges: [],
};

test('searchAllContent finds notes by title and content', () => {
  const res = searchAllContent('frontend', { notes: testNotes, tasks: testTasks, conceptGraph: testGraph });
  assert.equal(res.length, 1);
  assert.equal(res[0].type, 'note');
  assert.equal(res[0].targetId, 'n-1');
});

test('searchAllContent finds handwritten text through OCR index', () => {
  const res = searchAllContent('planificacion', { notes: testNotes, tasks: testTasks, conceptGraph: testGraph });
  assert.equal(res.length, 1);
  assert.equal(res[0].type, 'handwriting');
  assert.equal(res[0].targetId, 'n-2');
});

test('searchAllContent finds audio transcription text', () => {
  const res = searchAllContent('propuesta', { notes: testNotes, tasks: testTasks, conceptGraph: testGraph });
  assert.equal(res.length, 1);
  assert.equal(res[0].type, 'audio');
  assert.equal(res[0].targetId, 'n-2');
});

test('searchAllContent finds tasks and diagram nodes', () => {
  const taskRes = searchAllContent('reporte', { notes: testNotes, tasks: testTasks, conceptGraph: testGraph });
  assert.equal(taskRes.length, 1);
  assert.equal(taskRes[0].type, 'task');

  const diagramRes = searchAllContent('checkout', { notes: testNotes, tasks: testTasks, conceptGraph: testGraph });
  assert.equal(diagramRes.length, 1);
  assert.equal(diagramRes[0].type, 'diagram');
  assert.equal(diagramRes[0].subTargetId, 'node-checkout');
});

test('searchAllContent ignores queries shorter than 2 chars', () => {
  assert.equal(searchAllContent('a', { notes: testNotes, tasks: testTasks }).length, 0);
  assert.equal(searchAllContent('', { notes: testNotes, tasks: testTasks }).length, 0);
});
