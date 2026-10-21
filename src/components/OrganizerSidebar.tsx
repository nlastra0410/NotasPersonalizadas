import React, { useState, useRef } from 'react';
import { Notebook, NoteItem } from '../types';
import { filterNotes, sortNotes, getTagsSummary } from '../utils/organizer';
import {
  BookOpen,
  Plus,
  Search,
  Star,
  Archive,
  Trash2,
  Tag,
  PenTool as PenIcon,
  Mic,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Layers,
  FileText,
  Pin,
  Download,
  Upload,
  RotateCcw,
} from 'lucide-react';

interface OrganizerSidebarProps {
  notes: NoteItem[];
  notebooks: Notebook[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: (notebookId?: string) => void;
  onDeleteNote: (id: string) => void;
  onTogglePinNote: (id: string) => void;
  onCreateNotebook: (name: string, color: string) => void;
  onExportBackup?: () => void;
  onImportBackup?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetAsNew?: () => void;
  onOpenSearch?: () => void;
  onOpenBackupModal?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const OrganizerSidebar: React.FC<OrganizerSidebarProps> = ({
  notes,
  notebooks,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onTogglePinNote,
  onCreateNotebook,
  onExportBackup,
  onImportBackup,
  onResetAsNew,
  onOpenSearch,
  onOpenBackupModal,
  isOpen,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'active' | 'pinned' | 'archived' | 'trash'>('active');
  const [noteToDelete, setNoteToDelete] = useState<NoteItem | null>(null);

  // Notebook creation modal
  const [isCreatingNotebook, setIsCreatingNotebook] = useState<boolean>(false);
  const [newNotebookName, setNewNotebookName] = useState<string>('');
  const [newNotebookColor, setNewNotebookColor] = useState<string>('#3b82f6');

  const NOTEBOOK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  const filteredNotes = filterNotes(notes, {
    notebookId: selectedNotebookId,
    tag: selectedTag,
    searchQuery,
    filterMode,
  });

  const sortedNotesList = sortNotes(filteredNotes, 'updatedAt', 'desc', true);
  const tagsSummary = getTagsSummary(notes);

  const handleCreateNotebookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebookName.trim()) return;
    onCreateNotebook(newNotebookName.trim(), newNotebookColor);
    setNewNotebookName('');
    setIsCreatingNotebook(false);
  };

  if (!isOpen) return null;

  return (
    <aside
      className="fixed md:relative inset-y-0 left-0 z-40 w-80 md:w-88 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 shadow-lg md:shadow-none transition-all duration-200"
    >
      {/* Top Header: App Branding & Close / New Note Buttons */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            N
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
              NotaScribe Tablet
            </h1>
            <span className="text-[10px] text-slate-400 font-medium">Lápiz Stylus & OCR</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onCreateNote(selectedNotebookId || undefined)}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
            aria-label="Nueva nota"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Encoger menú"
            aria-label="Ocultar menú"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </div>

      {/* Instant Search Bar */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar títulos, texto u OCR..."
            className="w-full text-xs pl-9 pr-14 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Buscar notas"
          />
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500 hover:text-blue-600 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 shadow-2xs"
              title="Abrir búsqueda global rápida (Ctrl+K)"
            >
              Ctrl+K
            </button>
          )}
        </div>
      </div>

      {/* Navigation & Notebooks List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Quick Filters */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => {
              setFilterMode('active');
              setSelectedNotebookId(null);
              setSelectedTag(null);
            }}
            className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
              filterMode === 'active' && !selectedNotebookId && !selectedTag
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Todas las Notas</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">
              {notes.filter((n) => !n.isDeleted && !n.isArchived).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterMode('pinned');
              setSelectedNotebookId(null);
            }}
            className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
              filterMode === 'pinned'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Star className="w-4 h-4 text-amber-500" />
              <span>Favoritas / Fijadas</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">
              {notes.filter((n) => n.isPinned && !n.isDeleted).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterMode('trash');
              setSelectedNotebookId(null);
            }}
            className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
              filterMode === 'trash'
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Papelera</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">
              {notes.filter((n) => n.isDeleted).length}
            </span>
          </button>
        </div>

        {/* Notebooks / Folders Section */}
        <div>
          <div className="flex items-center justify-between px-3 py-1 mb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Cuadernos
            </span>
            <button
              type="button"
              onClick={() => setIsCreatingNotebook(true)}
              className="text-slate-400 hover:text-blue-600 p-1"
              title="Crear nuevo cuaderno"
              aria-label="Nuevo cuaderno"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* New Notebook Inline Form */}
          {isCreatingNotebook && (
            <form
              onSubmit={handleCreateNotebookSubmit}
              className="p-2.5 mb-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2"
            >
              <input
                type="text"
                value={newNotebookName}
                onChange={(e) => setNewNotebookName(e.target.value)}
                placeholder="Nombre del cuaderno..."
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {NOTEBOOK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewNotebookColor(c)}
                      className={`w-4 h-4 rounded-full ${
                        newNotebookColor === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNotebook(false)}
                    className="text-[10px] px-2 py-1 text-slate-500 hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="text-[10px] px-2.5 py-1 bg-blue-600 text-white rounded-md font-semibold"
                  >
                    Crear
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-0.5">
            {notebooks.map((nb) => {
              const count = notes.filter((n) => n.notebookId === nb.id && !n.isDeleted).length;
              const isSelected = selectedNotebookId === nb.id;

              return (
                <button
                  key={nb.id}
                  type="button"
                  onClick={() => {
                    setSelectedNotebookId(isSelected ? null : nb.id);
                    setFilterMode('active');
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: nb.color }}
                    />
                    <span className="truncate">{nb.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags Section */}
        {Object.keys(tagsSummary).length > 0 && (
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-3 py-1 mb-1">
              Etiquetas
            </span>
            <div className="flex flex-wrap gap-1 px-3">
              {Object.entries(tagsSummary).map(([tagName, count]) => {
                const isSelected = selectedTag === tagName;
                return (
                  <button
                    key={tagName}
                    type="button"
                    onClick={() => setSelectedTag(isSelected ? null : tagName)}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <span>#{tagName}</span>
                    <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes Cards List */}
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-3 py-1 mb-1">
            Notas ({sortedNotesList.length})
          </span>

          <div className="space-y-1.5">
            {sortedNotesList.map((note) => {
              const isActive = activeNoteId === note.id;
              const hasDrawing = note.strokes && note.strokes.length > 0;
              const hasAudio = Boolean(note.audioNote?.transcript);
              const notebook = notebooks.find((n) => n.id === note.notebookId);

              return (
                <div
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className={`group p-3 rounded-2xl cursor-pointer transition-all border text-left ${
                    isActive
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate flex-1">
                      {note.title || 'Nota sin título'}
                    </h4>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePinNote(note.id);
                        }}
                        className={`p-1 rounded-md transition-colors ${
                          note.isPinned
                            ? 'text-amber-500'
                            : 'text-slate-300 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 hover:text-amber-500'
                        }`}
                        title={note.isPinned ? 'Desfijar' : 'Fijar nota'}
                        aria-label="Fijar nota"
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNoteToDelete(note);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                        title="Eliminar esta nota"
                        aria-label="Eliminar nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Snippet */}
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2">
                    {note.ocrText || note.content || 'Nota vacía...'}
                  </p>

                  {/* Badges / Indicators */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      {notebook && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: notebook.color }}
                          title={notebook.name}
                        />
                      )}
                      <span>
                        {new Date(note.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasDrawing && (
                        <span title="Contiene trazos con lápiz">
                          <PenIcon className="w-3 h-3 text-blue-500" />
                        </span>
                      )}
                      {hasAudio && (
                        <span title="Contiene nota de voz">
                          <Mic className="w-3 h-3 text-rose-500" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer: Local Data & Software Status */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Almacenamiento Local
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            En tu Tablet
          </span>
        </div>

        {onOpenBackupModal && (
          <button
            type="button"
            onClick={onOpenBackupModal}
            className="w-full mb-2 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Copia de Seguridad & Restauración</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          {onExportBackup && (
            <button
              type="button"
              onClick={onExportBackup}
              className="px-2 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
              title="Descargar copia de seguridad de todas las notas en archivo JSON"
            >
              <Download className="w-3 h-3 text-blue-600" />
              <span>Respaldar</span>
            </button>
          )}

          {onImportBackup && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={onImportBackup}
                accept=".json"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                title="Restaurar copia de seguridad desde archivo JSON"
              >
                <Upload className="w-3 h-3 text-purple-600" />
                <span>Restaurar</span>
              </button>
            </>
          )}
        </div>

        {onResetAsNew && (
          <button
            type="button"
            onClick={onResetAsNew}
            className="w-full mt-2 py-1 text-[10px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors flex items-center justify-center gap-1"
            title="Dejar la app limpia como recién instalada"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Dejar como nueva (limpiar todo)</span>
          </button>
        )}
      </div>

      {/* Delete Note Confirmation Modal */}
      {noteToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  ¿Eliminar esta nota?
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  "{noteToDelete.title || 'Nota sin título'}"
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Esta acción eliminará de forma permanente los trazos manuscritos, textos y diagramas contenidos en esta nota.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteNote(noteToDelete.id);
                  setNoteToDelete(null);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
