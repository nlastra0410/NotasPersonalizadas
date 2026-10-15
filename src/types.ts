export type PenTool = 'pen' | 'fountain' | 'highlighter' | 'brush' | 'eraser';

export type PaperStyle = 'ruled' | 'grid' | 'dots' | 'cornell' | 'blank' | 'dark_board';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  tool: PenTool;
  color: string;
  size: number;
  opacity: number;
  timestamp: number;
}

export interface Notebook {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string; // typed markdown / text
  strokes: Stroke[]; // handwritten ink strokes
  paperStyle: PaperStyle;
  notebookId: string;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
  ocrText?: string;
  audioNote?: {
    transcript: string;
    duration?: number;
    timestamp: number;
  };
}

export type Priority = 'high' | 'medium' | 'low';

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  dueDate?: string;
  notebookId?: string;
  noteId?: string;
  createdAt: number;
  completedAt?: number;
}

export interface ConceptNode {
  id: string;
  label: string;
  description?: string;
  x: number;
  y: number;
  color: string;
  width?: number;
  height?: number;
}

export interface ConceptEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface ConceptGraph {
  id: string;
  title: string;
  noteId?: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

export type ActiveTab = 'canvas' | 'organizer' | 'tasks' | 'concept';
