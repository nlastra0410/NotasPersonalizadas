import { Notebook, NoteItem, TaskItem, ConceptGraph, Stroke } from '../types';

export const initialNotebooks: Notebook[] = [
  {
    id: 'nb-general',
    name: 'Mi Cuaderno',
    color: '#3b82f6',
    icon: 'BookOpen',
    description: 'Cuaderno principal de notas',
  },
];

export const sampleHandwrittenStrokes: Stroke[] = [];

export const initialNotes: NoteItem[] = [
  {
    id: 'note-1',
    title: 'Mi Primera Nota',
    content: '',
    strokes: [],
    paperStyle: 'blank',
    notebookId: 'nb-general',
    tags: [],
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const initialTasks: TaskItem[] = [];

export const initialConceptGraph: ConceptGraph = {
  id: 'graph-1',
  title: 'Mi Primer Diagrama',
  diagramType: 'flowchart',
  nodes: [],
  edges: [],
};
