import React, { useState } from 'react';
import { NoteItem, PaperStyle, Stroke } from '../types';
import { HandwritingCanvas } from './HandwritingCanvas';
import {
  Tag as TagIcon,
  Sparkles,
  FileText,
  Volume2,
  PanelRightClose,
  PanelRightOpen,
  PenTool,
  Columns2,
  Check,
  ListPlus,
  Network,
} from 'lucide-react';

interface NoteEditorViewProps {
  note: NoteItem;
  onUpdateNote: (updated: Partial<NoteItem>) => void;
  isRightPaneOpen: boolean;
  onToggleRightPane: () => void;
  onConvertToTasks?: (text: string) => void;
  onConvertToConceptMap?: (text: string) => void;
}

export const NoteEditorView: React.FC<NoteEditorViewProps> = ({
  note,
  onUpdateNote,
  isRightPaneOpen,
  onToggleRightPane,
  onConvertToTasks,
  onConvertToConceptMap,
}) => {
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [viewLayout, setViewLayout] = useState<'canvas' | 'split' | 'text'>('split');

  const handleStrokesChange = (strokes: Stroke[]) => {
    onUpdateNote({
      strokes,
      updatedAt: Date.now(),
    });
  };

  const handlePaperStyleChange = (paperStyle: PaperStyle) => {
    onUpdateNote({ paperStyle });
  };

  const handleInsertTextIntoNote = (textToInsert: string) => {
    const updatedContent = note.content
      ? `${note.content}\n\n${textToInsert}`
      : textToInsert;

    onUpdateNote({
      content: updatedContent,
      ocrText: textToInsert,
      updatedAt: Date.now(),
    });
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = newTagInput.trim().replace(/^#/, '');
    if (!tag || note.tags.includes(tag)) return;

    onUpdateNote({
      tags: [...note.tags, tag],
      updatedAt: Date.now(),
    });
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateNote({
      tags: note.tags.filter((t) => t !== tagToRemove),
      updatedAt: Date.now(),
    });
  };

  // Determine if canvas and text are visible based on isRightPaneOpen and viewLayout
  const showCanvas = viewLayout !== 'text';
  const showTextPane = isRightPaneOpen && viewLayout !== 'canvas';

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 relative">
      {/* Sub-header: Quick Layout Controller (Solo Lienzo / Ver Ambos / Solo Texto) */}
      <div className="h-9 px-4 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
            Modo de Trabajo:
          </span>
          <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setViewLayout('canvas');
                if (isRightPaneOpen) onToggleRightPane();
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                !isRightPaneOpen || viewLayout === 'canvas'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Ocultar texto y escribir en pantalla completa"
            >
              <PenTool className="w-3 h-3" />
              <span>Solo Lienzo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewLayout('split');
                if (!isRightPaneOpen) onToggleRightPane();
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                isRightPaneOpen && viewLayout === 'split'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Ver Lienzo y Texto lado a lado"
            >
              <Columns2 className="w-3 h-3" />
              <span>Ver Ambos (Dividido)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewLayout('text');
                if (!isRightPaneOpen) onToggleRightPane();
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                viewLayout === 'text'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Solo notas mecanografiadas y transcripciones"
            >
              <FileText className="w-3 h-3" />
              <span>Solo Texto</span>
            </button>
          </div>
        </div>

        {/* Note quick info */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span>{note.strokes?.length || 0} trazos</span>
          <span>•</span>
          <span>{note.content ? `${note.content.split(/\s+/).filter(Boolean).length} palabras` : '0 palabras'}</span>
        </div>
      </div>

      {/* Main Workspace: Canvas and/or Text Pane */}
      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden relative">
        {/* Primary Area: Handwriting Canvas */}
        {showCanvas && (
          <div className="flex-1 h-full relative overflow-hidden flex flex-col min-w-0">
            <HandwritingCanvas
              strokes={note.strokes}
              onStrokesChange={handleStrokesChange}
              paperStyle={note.paperStyle}
              onPaperStyleChange={handlePaperStyleChange}
              onInsertTextIntoNote={handleInsertTextIntoNote}
              onConvertToTasks={onConvertToTasks}
              onConvertToConceptMap={onConvertToConceptMap}
            />

            {/* Floating edge tab to open text pane when minimized */}
            {!showTextPane && (
              <button
                type="button"
                onClick={() => {
                  setViewLayout('split');
                  onToggleRightPane();
                }}
                className="absolute top-1/2 -translate-y-1/2 right-0 z-30 bg-white/95 dark:bg-slate-900/95 border border-r-0 border-slate-200 dark:border-slate-800 shadow-md py-3 px-1.5 rounded-l-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex flex-col items-center gap-1.5 transition-all"
                title="Abrir panel de texto y notas"
                aria-label="Abrir panel de texto"
              >
                <PanelRightOpen className="w-4 h-4" />
                <span className="text-[10px] [writing-mode:vertical-rl] font-semibold tracking-wider">
                  Abrir Texto
                </span>
              </button>
            )}
          </div>
        )}

        {/* Side Pane: Typed Markdown & Transcriptions (collapsible) */}
        {showTextPane && (
          <aside className={`${showCanvas ? 'w-full md:w-88 lg:w-96' : 'w-full'} bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 flex flex-col h-full z-20 shadow-lg shrink-0 transition-all duration-200`}>
            {/* Header */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                Texto & Transcripciones
              </span>
              <button
                type="button"
                onClick={onToggleRightPane}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Minimizar panel de texto"
                aria-label="Ocultar panel"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>

            {/* Tags bar */}
            <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center gap-1 mb-1.5">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 flex items-center gap-1"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-rose-600"
                      aria-label={`Quitar etiqueta ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <form onSubmit={handleAddTag} className="flex items-center gap-1">
                <TagIcon className="w-3 h-3 text-slate-400" />
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Añadir etiqueta (#idea, #trabajo)..."
                  className="text-[11px] bg-transparent flex-1 focus:outline-none text-slate-800 dark:text-slate-200"
                  aria-label="Nueva etiqueta"
                />
              </form>
            </div>

            {/* Audio Note Transcript Card (if attached) */}
            {note.audioNote && (
              <div className="m-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 mb-1">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Nota de Voz</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed italic">
                  &quot;{note.audioNote.transcript}&quot;
                </p>
              </div>
            )}

            {/* Typed Editor Textarea */}
            <div className="flex-1 p-3 flex flex-col">
              <textarea
                value={note.content}
                onChange={(e) =>
                  onUpdateNote({
                    content: e.target.value,
                    updatedAt: Date.now(),
                  })
                }
                placeholder="Escribe notas aquí o pega dictados por voz y transcripciones..."
                className="w-full flex-1 resize-none bg-transparent text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none font-sans"
                aria-label="Cuerpo de la nota"
              />
            </div>

            {/* Quick Actions Footer */}
            {note.content && (
              <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs">
                {onConvertToTasks && (
                  <button
                    type="button"
                    onClick={() => onConvertToTasks(note.content)}
                    className="px-2 py-1 text-[11px] text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg flex items-center gap-1 font-medium"
                  >
                    <ListPlus className="w-3 h-3" />
                    <span>Extraer Tareas</span>
                  </button>
                )}

                {onConvertToConceptMap && (
                  <button
                    type="button"
                    onClick={() => onConvertToConceptMap(note.content)}
                    className="px-2 py-1 text-[11px] text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg flex items-center gap-1 font-medium"
                  >
                    <Network className="w-3 h-3" />
                    <span>Crear Diagrama</span>
                  </button>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
