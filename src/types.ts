export type PenTool = 'pen' | 'fountain' | 'highlighter' | 'brush' | 'eraser' | 'laser';

export type PaperStyle = 'ruled' | 'grid' | 'dots' | 'cornell' | 'blank' | 'dark_board';

export type ToolbarPosition = 'top' | 'left' | 'right' | 'floating';

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
  strokes: Stroke[]; // handwritten ink strokes for page 1 (backward compat)
  pages?: Stroke[][]; // multipage support: array of stroke pages
  activePageIndex?: number;
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
  diagramGraph?: ConceptGraph;
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

export type DiagramType = 'mindmap' | 'flowchart' | 'architecture';
export type NodeShape = 'rectangle' | 'rounded' | 'diamond' | 'cylinder' | 'cloud' | 'circle' | 'triangle';

export interface ConceptNode {
  id: string;
  label: string;
  description?: string;
  x: number;
  y: number;
  color: string;
  shape?: NodeShape;
  width?: number;
  height?: number;
}

export interface ConceptEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface FloatingTextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

export interface InkAnnotation {
  id: string;
  strokes: Stroke[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number; cx: number; cy: number };
  color: string;
  recognizedText?: string;
  createdAt: number;
}

export interface ConceptGraph {
  id: string;
  title: string;
  diagramType?: DiagramType;
  noteId?: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  inkAnnotations?: InkAnnotation[];
  floatingTexts?: FloatingTextItem[];
}

export type ActiveTab = 'canvas' | 'organizer' | 'tasks' | 'concept';
export type NoteViewLayout = 'canvas' | 'split' | 'text' | 'dictation' | 'smart_diagram';

export interface SearchResultItem {
  id: string;
  type: 'note' | 'handwriting' | 'audio' | 'task' | 'diagram';
  title: string;
  snippet: string;
  targetTab: ActiveTab;
  targetId: string;
  subTargetId?: string;
}

export interface AppBackupData {
  version: number;
  exportedAt: number;
  appName: string;
  notes: NoteItem[];
  notebooks: Notebook[];
  tasks: TaskItem[];
  conceptGraphs: ConceptGraph[];
}
