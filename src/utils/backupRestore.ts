import type { AppBackupData, NoteItem, Notebook, TaskItem, ConceptGraph } from '../types.ts';

export const BACKUP_VERSION = 1;

export function generateBackupFileName(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `notascribe-backup-${yyyy}-${mm}-${dd}.json`;
}

export function serializeAppData(payload: {
  notes: NoteItem[];
  notebooks: Notebook[];
  tasks: TaskItem[];
  conceptGraphs?: ConceptGraph[];
  conceptGraph?: ConceptGraph;
}): string {
  const graphs = payload.conceptGraphs || (payload.conceptGraph ? [payload.conceptGraph] : []);

  const backup: AppBackupData = {
    version: BACKUP_VERSION,
    appName: 'Nota Scribe',
    exportedAt: Date.now(),
    notes: payload.notes || [],
    notebooks: payload.notebooks || [],
    tasks: payload.tasks || [],
    conceptGraphs: graphs,
  };

  return JSON.stringify(backup, null, 2);
}

export function validateBackupData(jsonString: string): {
  valid: boolean;
  error?: string;
  data?: AppBackupData;
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'El archivo no contiene un JSON válido.' };
    }

    if (!Array.isArray(parsed.notes) && !Array.isArray(parsed.notebooks)) {
      return {
        valid: false,
        error: 'El archivo no contiene una estructura válida de notas o libretas.',
      };
    }

    const cleanData: AppBackupData = {
      version: typeof parsed.version === 'number' ? parsed.version : BACKUP_VERSION,
      appName: parsed.appName || 'Nota Scribe',
      exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      notebooks: Array.isArray(parsed.notebooks) ? parsed.notebooks : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      conceptGraphs: Array.isArray(parsed.conceptGraphs)
        ? parsed.conceptGraphs
        : parsed.conceptGraph
        ? [parsed.conceptGraph]
        : [],
    };

    return { valid: true, data: cleanData };
  } catch {
    return { valid: false, error: 'Error de sintaxis JSON en el archivo.' };
  }
}

export function restoreAppData(
  incoming: AppBackupData,
  current: {
    notes: NoteItem[];
    notebooks: Notebook[];
    tasks: TaskItem[];
    conceptGraphs?: ConceptGraph[];
  },
  mode: 'replace' | 'merge' = 'replace'
): {
  notes: NoteItem[];
  notebooks: Notebook[];
  tasks: TaskItem[];
  conceptGraphs: ConceptGraph[];
} {
  if (mode === 'replace') {
    return {
      notes: incoming.notes,
      notebooks: incoming.notebooks.length > 0 ? incoming.notebooks : current.notebooks,
      tasks: incoming.tasks,
      conceptGraphs: incoming.conceptGraphs,
    };
  }

  // Merge mode: Deduplicate by ID
  const noteMap = new Map<string, NoteItem>();
  current.notes.forEach((n) => noteMap.set(n.id, n));
  incoming.notes.forEach((n) => noteMap.set(n.id, n));

  const nbMap = new Map<string, Notebook>();
  current.notebooks.forEach((nb) => nbMap.set(nb.id, nb));
  incoming.notebooks.forEach((nb) => nbMap.set(nb.id, nb));

  const taskMap = new Map<string, TaskItem>();
  current.tasks.forEach((t) => taskMap.set(t.id, t));
  incoming.tasks.forEach((t) => taskMap.set(t.id, t));

  const graphMap = new Map<string, ConceptGraph>();
  (current.conceptGraphs || []).forEach((g) => graphMap.set(g.id, g));
  incoming.conceptGraphs.forEach((g) => graphMap.set(g.id, g));

  return {
    notes: Array.from(noteMap.values()),
    notebooks: Array.from(nbMap.values()),
    tasks: Array.from(taskMap.values()),
    conceptGraphs: Array.from(graphMap.values()),
  };
}
