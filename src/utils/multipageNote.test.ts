import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNotePages,
  getCurrentPageStrokes,
  updateNotePageStrokes,
  addPageToNote,
  deletePageFromNote,
} from './multipageNote.ts';
import type { NoteItem, Stroke } from '../types.ts';

const dummyStroke: Stroke = {
  id: 's-1',
  points: [{ x: 10, y: 10 }],
  tool: 'pen',
  color: '#000000',
  size: 2,
  opacity: 1,
  timestamp: Date.now(),
};

const baseNote: NoteItem = {
  id: 'test-note',
  title: 'Test Multipage',
  content: 'Hello',
  strokes: [dummyStroke],
  paperStyle: 'blank',
  notebookId: 'nb-1',
  tags: [],
  isPinned: false,
  isArchived: false,
  isDeleted: false,
  createdAt: 1000,
  updatedAt: 1000,
};

test('getNotePages returns note.pages when present or falls back to [strokes]', () => {
  const pages = getNotePages(baseNote);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].length, 1);
  assert.equal(pages[0][0].id, 's-1');
});

test('addPageToNote appends a new blank page and updates activePageIndex', () => {
  const updated = addPageToNote(baseNote);
  assert.equal(getNotePages(updated).length, 2);
  assert.equal(updated.activePageIndex, 1);
  assert.equal(getCurrentPageStrokes(updated, 1).length, 0);
});

test('updateNotePageStrokes updates the specific page and keeps strokes synced for page 0', () => {
  const multi = addPageToNote(baseNote);
  const stroke2: Stroke = { ...dummyStroke, id: 's-2' };
  const updatedPage1 = updateNotePageStrokes(multi, 1, [stroke2]);

  assert.equal(getCurrentPageStrokes(updatedPage1, 0).length, 1);
  assert.equal(getCurrentPageStrokes(updatedPage1, 1).length, 1);
  assert.equal(getCurrentPageStrokes(updatedPage1, 1)[0].id, 's-2');
});

test('deletePageFromNote removes the page and adjusts index safely', () => {
  const multi = addPageToNote(baseNote);
  assert.equal(getNotePages(multi).length, 2);

  const deleted = deletePageFromNote(multi, 1);
  assert.equal(getNotePages(deleted).length, 1);
  assert.equal(deleted.activePageIndex, 0);

  // Deleting the last remaining page clears it rather than removing it
  const cleared = deletePageFromNote(deleted, 0);
  assert.equal(getNotePages(cleared).length, 1);
  assert.equal(cleared.strokes.length, 0);
});
