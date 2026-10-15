import React, { useState } from 'react';
import { NoteItem, PaperStyle, Stroke } from '../types';
import { HandwritingCanvas } from './HandwritingCanvas';
import {
  Columns2,
  Tag as TagIcon,
  Plus,
  Trash2,
  Sparkles,
  FileText,
  Volume2,
  PanelRightClose,
  PanelRightOpen,
  ChevronRight,
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

  return (
    <div className="flex-1 w-full h-full flex flex-col md:flex-row overflow-hidden bg-slate-100 dark:bg-slate-950 relative">
      {/* Primary Area: Handwriting Canvas */}
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
        {!isRightPaneOpen && (
          <button
            type="button"
            onClick={onToggleRightPane}
            className="absolute top-1/2 -translate-y-1/2 right-0 z-30 bg-white/95 dark:bg-slate-900/95 border border-r-0 border-slate-200 dark:border-slate-800 shadow-md py-3 px-1 rounded-l-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex flex-col items-center gap-1 transition-all"
            title="Abrir panel de texto y notas"
            aria-label="Abrir panel de texto"
          >
            <PanelRightOpen className="w-4 h-4" />
            <span className="text-[10px] [writing-mode:vertical-rl] font-medium tracking-wider">Texto</span>
          </button>
        )}
      </div>

      {/* Side Pane: Typed Markdown & Notes Meta (collapsible) */}
      {isRightPaneOpen && (
        <aside className="w-full md:w-88 lg:w-96 bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 flex flex-col h-72 md:h-full z-20 shadow-lg shrink-0 transition-all duration-200">
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
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex flex-wrap items-center gap-1 mb-2">
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
                placeholder="Añadir etiqueta..."
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
                <span>Nota de Voz Adjunta</span>
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
              placeholder="Escribe texto con el teclado o inserta transcripciones de voz y OCR manuscrito aquí..."
              className="w-full flex-1 resize-none bg-transparent text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none font-sans"
              aria-label="Cuerpo de la nota"
            />
          </div>
        </aside>
      )}
    </div>
  );
};
