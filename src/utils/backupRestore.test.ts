import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBackupFileName,
  serializeAppData,
  validateBackupData,
  restoreAppData,
} from './backupRestore.ts';
import type { NoteItem, Notebook, TaskItem, ConceptGraph, AppBackupData } from '../types.ts';

const sampleNote: NoteItem = {
  id: 'note-1',
  title: 'Prueba',
  content: 'Contenido',
  strokes: [],
  paperStyle: 'blank',
  notebookId: 'nb-1',
  tags: ['test'],
  isPinned: false,
  isArchived: false,
  isDeleted: false,
  createdAt: 100,
  updatedAt: 100,
};

const sampleNb: Notebook = {
  id: 'nb-1',
  name: 'General',
  color: '#3b82f6',
  icon: 'Book',
};

const sampleTask: TaskItem = {
  id: 't-1',
  text: 'Comprar lapiz',
  completed: false,
  priority: 'high',
  createdAt: 100,
};

const sampleGraph: ConceptGraph = {
  id: 'g-1',
  title: 'Mi Diagrama',
  nodes: [],
  edges: [],
};

test('generateBackupFileName returns structured date string', () => {
  const d = new Date(2026, 9, 15); // Oct 15 2026
  assert.equal(generateBackupFileName(d), 'notascribe-backup-2026-10-15.json');
});

test('serializeAppData produces valid JSON containing all items', () => {
  const jsonStr = serializeAppData({
    notes: [sampleNote],
    notebooks: [sampleNb],
    tasks: [sampleTask],
    conceptGraph: sampleGraph,
  });
  const res = validateBackupData(jsonStr);
  assert.equal(res.valid, true);
  assert.equal(res.data?.notes.length, 1);
  assert.equal(res.data?.tasks.length, 1);
  assert.equal(res.data?.conceptGraphs.length, 1);
});

test('validateBackupData catches invalid or corrupted JSON', () => {
  assert.equal(validateBackupData('{ corrupt').valid, false);
  assert.equal(validateBackupData('{}').valid, false);
});

test('restoreAppData replaces all items in replace mode', () => {
  const incoming: AppBackupData = {
    version: 1,
    appName: 'Nota Scribe',
    exportedAt: 500,
    notes: [sampleNote],
    notebooks: [sampleNb],
    tasks: [sampleTask],
    conceptGraphs: [sampleGraph],
  };

  const current = {
    notes: [],
    notebooks: [],
    tasks: [],
    conceptGraphs: [],
  };

  const restored = restoreAppData(incoming, current, 'replace');
  assert.equal(restored.notes.length, 1);
  assert.equal(restored.notes[0].id, 'note-1');
});

test('restoreAppData merges items without duplicates in merge mode', () => {
  const existingNote: NoteItem = { ...sampleNote, id: 'note-0', title: 'Antigua' };
  const incomingNote: NoteItem = { ...sampleNote, id: 'note-1', title: 'Nueva' };

  const incoming: AppBackupData = {
    version: 1,
    appName: 'Nota Scribe',
    exportedAt: 500,
    notes: [incomingNote],
    notebooks: [sampleNb],
    tasks: [],
    conceptGraphs: [],
  };

  const current = {
    notes: [existingNote],
    notebooks: [sampleNb],
    tasks: [],
    conceptGraphs: [],
  };

  const merged = restoreAppData(incoming, current, 'merge');
  assert.equal(merged.notes.length, 2);
  assert.ok(merged.notes.some((n) => n.id === 'note-0'));
  assert.ok(merged.notes.some((n) => n.id === 'note-1'));
});
