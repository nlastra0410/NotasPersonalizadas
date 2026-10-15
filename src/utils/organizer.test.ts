import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeString,
  filterNotes,
  sortNotes,
  getTagsSummary,
} from './organizer.ts';
import type { NoteItem } from './organizer.ts';

const mockNotes: NoteItem[] = [
  {
    id: '1',
    title: 'Apuntes de Matemáticas',
    content: 'Fórmulas de cálculo y derivadas',
    notebookId: 'nb-estudio',
    tags: ['estudio', 'cálculo'],
    isPinned: true,
    isArchived: false,
    isDeleted: false,
    createdAt: 1000,
    updatedAt: 2000,
    ocrText: 'dy/dx = lim h->0',
  },
  {
    id: '2',
    title: 'Lista de Compras',
    content: 'Frutas, verduras, café',
    notebookId: 'nb-personal',
    tags: ['compras'],
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    createdAt: 1200,
    updatedAt: 1500,
  },
  {
    id: '3',
    title: 'Proyecto Tablet Android',
    content: 'Diseño de interfaz para stylus táctil',
    notebookId: 'nb-trabajo',
    tags: ['trabajo', 'android'],
    isPinned: false,
    isArchived: true,
    isDeleted: false,
    createdAt: 800,
    updatedAt: 1800,
  },
  {
    id: '4',
    title: 'Nota Borrada',
    content: 'Texto viejo',
    notebookId: 'nb-personal',
    tags: ['borrador'],
    isPinned: false,
    isArchived: false,
    isDeleted: true,
    createdAt: 500,
    updatedAt: 600,
  },
];

test('normalizeString strips accents and lowercases', () => {
  assert.equal(normalizeString('Árbol Matemático'), 'arbol matematico');
});

test('filterNotes filters active, archived and trash correctly', () => {
  const active = filterNotes(mockNotes, { filterMode: 'active' });
  assert.equal(active.length, 2);

  const archived = filterNotes(mockNotes, { filterMode: 'archived' });
  assert.equal(archived.length, 1);
  assert.equal(archived[0].id, '3');

  const trash = filterNotes(mockNotes, { filterMode: 'trash' });
  assert.equal(trash.length, 1);
  assert.equal(trash[0].id, '4');
});

test('filterNotes searches across title, content, and OCR text with accent tolerance', () => {
  const res1 = filterNotes(mockNotes, { searchQuery: 'matematicas' });
  assert.equal(res1.length, 1);
  assert.equal(res1[0].id, '1');

  // Search by OCR text
  const res2 = filterNotes(mockNotes, { searchQuery: 'lim h->0' });
  assert.equal(res2.length, 1);
  assert.equal(res2[0].id, '1');
});

test('sortNotes keeps pinned notes first regardless of date', () => {
  const sorted = sortNotes(mockNotes.filter((n) => !n.isDeleted && !n.isArchived), 'updatedAt', 'desc', true);
  assert.equal(sorted[0].id, '1', 'Pinned note 1 should be on top');
  assert.equal(sorted[1].id, '2');
});

test('getTagsSummary aggregates tag frequencies', () => {
  const summary = getTagsSummary(mockNotes);
  assert.equal(summary['estudio'], 1);
  assert.equal(summary['compras'], 1);
  // Note 4 is deleted so 'borrador' should not be counted
  assert.equal(summary['borrador'], undefined);
});
