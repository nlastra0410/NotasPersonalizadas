/**
 * Note organizer, notebooks, search, and sorting logic.
 */

export interface Notebook {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  notebookId: string;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
  ocrText?: string;
  strokes?: any[];
  audioNote?: {
    transcript: string;
    duration?: number;
    timestamp: number;
  };
  hasDrawing?: boolean;
  hasAudio?: boolean;
}

export type SortField = 'updatedAt' | 'createdAt' | 'title';
export type SortDirection = 'asc' | 'desc';

/**
 * Normalizes string for accent/case-insensitive search.
 */
export function normalizeString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filters notes based on notebook, tags, search query, and archive/trash filters.
 */
export function filterNotes(
  notes: NoteItem[],
  options: {
    notebookId?: string | null;
    tag?: string | null;
    searchQuery?: string;
    filterMode?: 'active' | 'pinned' | 'archived' | 'trash';
  }
): NoteItem[] {
  const { notebookId, tag, searchQuery, filterMode = 'active' } = options;
  const normalizedQuery = searchQuery ? normalizeString(searchQuery) : '';

  return notes.filter((note) => {
    // Trash / Archive status checks
    if (filterMode === 'trash') {
      if (!note.isDeleted) return false;
    } else if (filterMode === 'archived') {
      if (note.isDeleted || !note.isArchived) return false;
    } else {
      // 'active' or 'pinned'
      if (note.isDeleted || note.isArchived) return false;
      if (filterMode === 'pinned' && !note.isPinned) return false;
    }

    // Notebook filter
    if (notebookId && note.notebookId !== notebookId) {
      return false;
    }

    // Tag filter
    if (tag && !note.tags.includes(tag)) {
      return false;
    }

    // Search query matching
    if (normalizedQuery) {
      const matchTitle = normalizeString(note.title).includes(normalizedQuery);
      const matchContent = normalizeString(note.content).includes(normalizedQuery);
      const matchOcr = normalizeString(note.ocrText || '').includes(normalizedQuery);
      const matchTags = note.tags.some((t) => normalizeString(t).includes(normalizedQuery));

      if (!matchTitle && !matchContent && !matchOcr && !matchTags) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts notes list, optionally keeping pinned items on top.
 */
export function sortNotes(
  notes: NoteItem[],
  field: SortField = 'updatedAt',
  direction: SortDirection = 'desc',
  keepPinnedOnTop: boolean = true
): NoteItem[] {
  return [...notes].sort((a, b) => {
    if (keepPinnedOnTop) {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
    }

    let comparison = 0;
    if (field === 'title') {
      comparison = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    } else {
      comparison = a[field] - b[field];
    }

    return direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Gathers tag frequency statistics.
 */
export function getTagsSummary(notes: NoteItem[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const note of notes) {
    if (note.isDeleted) continue;
    for (const tag of note.tags) {
      summary[tag] = (summary[tag] || 0) + 1;
    }
  }
  return summary;
}
