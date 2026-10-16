import type { NoteItem, Stroke } from '../types.ts';

/**
 * Ensures note pages array exists and is valid.
 * Falls back to [note.strokes] for backward compatibility.
 */
export function getNotePages(note: NoteItem): Stroke[][] {
  if (note.pages && Array.isArray(note.pages) && note.pages.length > 0) {
    return note.pages;
  }
  return [note.strokes || []];
}

/**
 * Gets strokes for a specific page index (0-indexed).
 * Clamps safely within range.
 */
export function getCurrentPageStrokes(note: NoteItem, pageIndex: number): Stroke[] {
  const pages = getNotePages(note);
  const safeIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));
  return pages[safeIndex] || [];
}

/**
 * Updates strokes for a given page index and syncs back to the note object,
 * keeping page 0 in note.strokes for backward compatibility.
 */
export function updateNotePageStrokes(
  note: NoteItem,
  pageIndex: number,
  newStrokes: Stroke[]
): NoteItem {
  const pages = [...getNotePages(note)];
  const safeIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));
  pages[safeIndex] = newStrokes;

  return {
    ...note,
    pages,
    strokes: pages[0] || [], // keep page 0 synced for backward compatibility
    activePageIndex: safeIndex,
    updatedAt: Date.now(),
  };
}

/**
 * Appends a new blank page to the note.
 */
export function addPageToNote(note: NoteItem): NoteItem {
  const pages = [...getNotePages(note), []];
  const newPageIndex = pages.length - 1;

  return {
    ...note,
    pages,
    activePageIndex: newPageIndex,
    updatedAt: Date.now(),
  };
}

/**
 * Deletes a page from the note. Always keeps at least 1 page.
 */
export function deletePageFromNote(note: NoteItem, pageIndex: number): NoteItem {
  const pages = getNotePages(note);
  if (pages.length <= 1) {
    // If only 1 page remains, clear it instead of removing
    return {
      ...note,
      pages: [[]],
      strokes: [],
      activePageIndex: 0,
      updatedAt: Date.now(),
    };
  }

  const newPages = pages.filter((_, idx) => idx !== pageIndex);
  const newActiveIndex = Math.min(pageIndex, newPages.length - 1);

  return {
    ...note,
    pages: newPages,
    strokes: newPages[0] || [],
    activePageIndex: newActiveIndex,
    updatedAt: Date.now(),
  };
}
