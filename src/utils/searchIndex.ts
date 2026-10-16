import type { NoteItem, TaskItem, ConceptGraph, SearchResultItem } from '../types.ts';
import { normalizeString } from './organizer.ts';

export function searchAllContent(
  query: string,
  context: {
    notes: NoteItem[];
    tasks: TaskItem[];
    conceptGraph?: ConceptGraph;
    conceptGraphs?: ConceptGraph[];
  }
): SearchResultItem[] {
  const cleanQ = normalizeString(query.trim());
  if (!cleanQ || cleanQ.length < 2) return [];

  const results: SearchResultItem[] = [];

  // 1. Search Notes (Title, Content, OCR text, Audio transcript)
  for (const note of context.notes) {
    if (note.isDeleted) continue;

    const normTitle = normalizeString(note.title);
    const normContent = normalizeString(note.content);
    const normOcr = note.ocrText ? normalizeString(note.ocrText) : '';
    const normAudio = note.audioNote?.transcript ? normalizeString(note.audioNote.transcript) : '';

    if (normTitle.includes(cleanQ)) {
      results.push({
        id: `search-note-${note.id}`,
        type: 'note',
        title: note.title,
        snippet: note.content ? note.content.slice(0, 100) : 'Nota manuscrita',
        targetTab: 'canvas',
        targetId: note.id,
      });
      continue;
    }

    if (normOcr && normOcr.includes(cleanQ)) {
      results.push({
        id: `search-ocr-${note.id}`,
        type: 'handwriting',
        title: `${note.title} (Manuscrito OCR)`,
        snippet: extractSnippet(note.ocrText || '', cleanQ),
        targetTab: 'canvas',
        targetId: note.id,
      });
      continue;
    }

    if (normAudio && normAudio.includes(cleanQ)) {
      results.push({
        id: `search-audio-${note.id}`,
        type: 'audio',
        title: `${note.title} (Dictado de voz)`,
        snippet: extractSnippet(note.audioNote?.transcript || '', cleanQ),
        targetTab: 'canvas',
        targetId: note.id,
      });
      continue;
    }

    if (normContent.includes(cleanQ)) {
      results.push({
        id: `search-content-${note.id}`,
        type: 'note',
        title: note.title,
        snippet: extractSnippet(note.content, cleanQ),
        targetTab: 'canvas',
        targetId: note.id,
      });
    }
  }

  // 2. Search Tasks
  for (const task of context.tasks) {
    const normTask = normalizeString(task.text);
    if (normTask.includes(cleanQ)) {
      results.push({
        id: `search-task-${task.id}`,
        type: 'task',
        title: task.text,
        snippet: task.completed ? 'Tarea completada' : `Prioridad: ${task.priority}`,
        targetTab: 'tasks',
        targetId: task.id,
      });
    }
  }

  // 3. Search Concept Graphs (Nodes & Edges)
  const graphs = context.conceptGraphs || (context.conceptGraph ? [context.conceptGraph] : []);
  for (const graph of graphs) {
    for (const node of graph.nodes) {
      const normLabel = normalizeString(node.label);
      const normDesc = node.description ? normalizeString(node.description) : '';
      if (normLabel.includes(cleanQ) || normDesc.includes(cleanQ)) {
        results.push({
          id: `search-diagram-node-${node.id}`,
          type: 'diagram',
          title: `${graph.title}: ${node.label}`,
          snippet: node.description || `Nodo en ${graph.diagramType || 'diagrama'}`,
          targetTab: 'concept',
          targetId: graph.id,
          subTargetId: node.id,
        });
      }
    }
  }

  return results.slice(0, 15);
}

function extractSnippet(fullText: string, query: string, radius = 40): string {
  const norm = normalizeString(fullText);
  const idx = norm.indexOf(query);
  if (idx === -1) return fullText.slice(0, 80);

  const start = Math.max(0, idx - radius);
  const end = Math.min(fullText.length, idx + query.length + radius);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < fullText.length ? '...' : '';
  return `${prefix}${fullText.slice(start, end).trim()}${suffix}`;
}
