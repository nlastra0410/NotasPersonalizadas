import React, { useState } from 'react';
import { NoteItem, PaperStyle, Stroke, NoteViewLayout, ConceptGraph } from '../types';
import { HandwritingCanvas } from './HandwritingCanvas';
import { DictationStudio } from './DictationStudio';
import { SmartDiagramStudio } from './SmartDiagramStudio';
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
  Mic,
  Wand2,
  Undo2,
} from 'lucide-react';
import {
  getNotePages,
  getCurrentPageStrokes,
  updateNotePageStrokes,
  addPageToNote,
  deletePageFromNote,
} from '../utils/multipageNote';
import { purgeOrphanEdges } from '../utils/conceptMap';

interface NoteEditorViewProps {
  note: NoteItem;
  onUpdateNote: (updated: Partial<NoteItem>) => void;
  isRightPaneOpen: boolean;
  onToggleRightPane: () => void;
  onConvertToTasks?: (text: string) => void;
  onConvertToConceptMap?: (text: string) => void;
  onOpenInFullDiagramsTab?: (graph: ConceptGraph) => void;
}

export const NoteEditorView: React.FC<NoteEditorViewProps> = ({
  note,
  onUpdateNote,
  isRightPaneOpen,
  onToggleRightPane,
  onConvertToTasks,
  onConvertToConceptMap,
  onOpenInFullDiagramsTab,
}) => {
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [viewLayout, setViewLayout] = useState<NoteViewLayout>('canvas');

  // Text undo history for the typed notes editor
  const [textHistory, setTextHistory] = useState<string[]>([note.content || '']);
  const [textHistoryIndex, setTextHistoryIndex] = useState<number>(0);

  const currentPageIndex = note.activePageIndex ?? 0;
  const pages = getNotePages(note);
  const currentStrokes = getCurrentPageStrokes(note, currentPageIndex);

  const handleStrokesChange = (newStrokes: Stroke[]) => {
    const updated = updateNotePageStrokes(note, currentPageIndex, newStrokes);
    onUpdateNote(updated);
  };

  const handleUpdateTextWithHistory = (newContent: string) => {
    onUpdateNote({ content: newContent, updatedAt: Date.now() });
    setTextHistory((prev) => {
      const next = prev.slice(0, textHistoryIndex + 1);
      next.push(newContent);
      if (next.length > 25) next.shift();
      return next;
    });
    setTextHistoryIndex((prev) => Math.min(prev + 1, 24));
  };

  const handleUndoText = () => {
    if (textHistoryIndex > 0) {
      const prevContent = textHistory[textHistoryIndex - 1];
      setTextHistoryIndex(textHistoryIndex - 1);
      onUpdateNote({ content: prevContent, updatedAt: Date.now() });
    }
  };

  // Universal Undo Action across all options:
  // - In Solo Lienzo / Ver Ambos: removes last stroke
  // - In Solo Texto: reverts last typed text change
  // - In Dictado & Voz: dispatches event to DictationStudio
  // - In Lienzo Predictivo: dispatches event to SmartDiagramStudio
  const handleGlobalUndo = () => {
    if (viewLayout === 'smart_diagram') {
      window.dispatchEvent(new CustomEvent('notascribe:undo_smart_diagram'));
    } else if (viewLayout === 'dictation') {
      window.dispatchEvent(new CustomEvent('notascribe:undo_dictation'));
    } else if (viewLayout === 'text') {
      handleUndoText();
    } else {
      // Solo Lienzo o Ver Ambos: deshacer el último trazo del lápiz
      if (currentStrokes.length > 0) {
        handleStrokesChange(currentStrokes.slice(0, -1));
      }
    }
  };

  const handlePageChange = (idx: number) => {
    onUpdateNote({ activePageIndex: idx });
  };

  const handleAddPage = () => {
    onUpdateNote(addPageToNote(note));
  };

  const handleDeletePage = (idx: number) => {
    onUpdateNote(deletePageFromNote(note, idx));
  };

  const handlePaperStyleChange = (paperStyle: PaperStyle) => {
    onUpdateNote({ paperStyle });
  };

  const handleInsertTextIntoNote = (textToInsert: string) => {
    const updatedContent = note.content
      ? `${note.content}\n\n${textToInsert}`
      : textToInsert;

    handleUpdateTextWithHistory(updatedContent);
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

  const showDictation = viewLayout === 'dictation';
  const showSmartDiagram = viewLayout === 'smart_diagram';
  const showCanvas = !showDictation && !showSmartDiagram && viewLayout !== 'text';
  const showTextPane = !showDictation && !showSmartDiagram && ((isRightPaneOpen && viewLayout !== 'canvas') || viewLayout === 'text');

  const totalStrokes = pages.reduce((acc, p) => acc + p.length, 0);

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 relative">
      {/* Sub-header: Quick Layout Controller (Solo Lienzo / Ver Ambos / Solo Texto / Dictado & Voz / Lápiz a Diagrama) */}
      <div className="h-9 px-4 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs shrink-0 select-none">
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
            Modo:
          </span>
          <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => {
                setViewLayout('canvas');
                if (isRightPaneOpen) onToggleRightPane();
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                viewLayout === 'canvas' && !isRightPaneOpen
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Mostrar únicamente la hoja en blanco / cuaderno con lápiz stylus"
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
                viewLayout === 'split' && isRightPaneOpen
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Ver el lienzo a la izquierda y el texto/transcripciones a la derecha"
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
              title="Mostrar únicamente el editor de texto y transcripción"
            >
              <FileText className="w-3 h-3" />
              <span>Solo Texto</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewLayout('dictation');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                viewLayout === 'dictation'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs ring-1 ring-rose-200 dark:ring-rose-900/60'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Estudio de dictado en vivo y transcripción automática de conversaciones"
            >
              <Mic className="w-3 h-3 text-rose-500" />
              <span>Dictado & Voz</span>
            </button>

            {/* Nueva Opción: Lienzo Predictivo */}
            <button
              type="button"
              onClick={() => {
                setViewLayout('smart_diagram');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                viewLayout === 'smart_diagram'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs ring-1 ring-indigo-200 dark:ring-indigo-900/60 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Lienzo Predictivo: escribe palabras que se transforman en texto digital, figuras que se convierten en formas perfectas y trazos que unen con flechas"
            >
              <Wand2 className="w-3 h-3 text-indigo-500" />
              <span>Lienzo Predictivo</span>
            </button>
          </div>

          {/* Flecha de Volver Atrás (Deshacer) Universal para todas las opciones */}
          <button
            type="button"
            onClick={handleGlobalUndo}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all active:scale-95 shrink-0"
            title="Volver atrás / Deshacer lo último puesto por error (trazo, figura, texto o dictado)"
          >
            <Undo2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Deshacer</span>
          </button>
        </div>

        {/* Note quick info */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span>{pages.length} {pages.length === 1 ? 'página' : 'páginas'}</span>
          <span>•</span>
          <span>{totalStrokes} trazos</span>
          <span>•</span>
          <span>{note.content ? `${note.content.split(/\s+/).filter(Boolean).length} palabras` : '0 palabras'}</span>
        </div>
      </div>

      {/* Main Workspace: Canvas, Text Pane, Dictation Studio, or Smart Diagram Studio */}
      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden relative">
        {showSmartDiagram ? (
          <SmartDiagramStudio
            initialGraph={note.diagramGraph}
            noteTitle={note.title}
            onSaveGraph={(graph) => {
              onUpdateNote({ diagramGraph: graph, updatedAt: Date.now() });
            }}
            onExportToNoteContent={handleInsertTextIntoNote}
            onOpenInFullDiagramsTab={onOpenInFullDiagramsTab}
          />
        ) : showDictation ? (
          <DictationStudio
            initialText={note.content}
            onUpdateNoteContent={(newContent) => onUpdateNote({ content: newContent, updatedAt: Date.now() })}
            onAppendToNoteContent={(textToAppend) => {
              const updatedContent = note.content ? `${note.content}\n\n${textToAppend}` : textToAppend;
              onUpdateNote({ content: updatedContent, updatedAt: Date.now() });
            }}
            onConvertToTasks={onConvertToTasks}
            onConvertToConceptMap={onConvertToConceptMap}
            noteTitle={note.title}
          />
        ) : (
          <>
            {/* Primary Area: Handwriting Canvas */}
            {showCanvas && (
          <div className="flex-1 h-full relative overflow-hidden flex flex-col min-w-0">
            <HandwritingCanvas
              strokes={currentStrokes}
              onStrokesChange={handleStrokesChange}
              paperStyle={note.paperStyle}
              onPaperStyleChange={handlePaperStyleChange}
              onInsertTextIntoNote={handleInsertTextIntoNote}
              onConvertToTasks={onConvertToTasks}
              onConvertToConceptMap={onConvertToConceptMap}
              pages={pages}
              currentPageIndex={currentPageIndex}
              onPageChange={handlePageChange}
              onAddPage={handleAddPage}
              onDeletePage={handleDeletePage}
              noteTitle={note.title}
              noteContent={note.content}
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
                      className="hover:text-rose-500 font-bold ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddTag} className="flex items-center gap-1.5">
                <TagIcon className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Agregar etiqueta y presiona Enter..."
                  className="flex-1 text-xs bg-transparent focus:outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </form>
            </div>

            {/* Audio Note Transcript Box if recorded */}
            {note.audioNote && (
              <div className="m-3 p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between text-rose-700 dark:text-rose-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4" /> Dictado por Voz
                  </span>
                  <span className="text-[10px] font-normal text-rose-500">
                    {new Date(note.audioNote.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-200 text-xs italic bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-rose-100 dark:border-rose-950">
                  &ldquo;{note.audioNote.transcript}&rdquo;
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleInsertTextIntoNote(note.audioNote!.transcript)}
                    className="text-[11px] font-semibold text-rose-700 hover:underline"
                  >
                    + Agregar al texto
                  </button>
                  {onConvertToTasks && (
                    <button
                      type="button"
                      onClick={() => onConvertToTasks(note.audioNote!.transcript)}
                      className="text-[11px] font-semibold text-amber-700 hover:underline"
                    >
                      + Convertir a tareas
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Typed Textarea */}
            <div className="flex-1 p-3 flex flex-col">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">Contenido Escrito</span>
                  <button
                    type="button"
                    onClick={handleUndoText}
                    disabled={textHistoryIndex <= 0}
                    className="p-1 rounded text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 flex items-center gap-1 text-[11px] font-medium transition-colors"
                    title="Deshacer última modificación de texto"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Deshacer</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setViewLayout('dictation')}
                  className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="Abrir estudio de dictado en vivo para transcribir voz"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Dictar por Voz</span>
                </button>
              </div>
              <textarea
                value={note.content}
                onChange={(e) => handleUpdateTextWithHistory(e.target.value)}
                placeholder="Escribe tus notas en limpio aquí, o transfiere tus apuntes manuscritos y dictados de voz..."
                className="w-full flex-1 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans"
              />
            </div>

            {/* Quick Actions Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400">
                Guardado automático local
              </span>
              <div className="flex items-center gap-1.5">
                {onConvertToTasks && note.content && (
                  <button
                    type="button"
                    onClick={() => onConvertToTasks(note.content)}
                    className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[11px] font-medium flex items-center gap-1"
                    title="Extraer tareas pendientes del texto"
                  >
                    <ListPlus className="w-3 h-3" /> Tareas
                  </button>
                )}
                {onConvertToConceptMap && note.content && (
                  <button
                    type="button"
                    onClick={() => onConvertToConceptMap(note.content)}
                    className="px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-[11px] font-medium flex items-center gap-1"
                    title="Generar diagrama conceptual a partir del texto"
                  >
                    <Network className="w-3 h-3" /> Diagrama
                  </button>
                )}
              </div>
            </div>
          </aside>
        )}
          </>
        )}
      </div>
    </div>
  );
};
