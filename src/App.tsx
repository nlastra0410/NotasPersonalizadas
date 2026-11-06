import React, { useState, useEffect } from 'react';
import {
  NoteItem,
  Notebook,
  TaskItem,
  ConceptGraph,
  ActiveTab,
  PaperStyle,
} from './types';
import { initialNotebooks, initialNotes, initialTasks, initialConceptGraph } from './data/initialData';
import { TabletNavbar } from './components/TabletNavbar';
import { OrganizerSidebar } from './components/OrganizerSidebar';
import { NoteEditorView } from './components/NoteEditorView';
import { ConceptMapCanvas } from './components/ConceptMapCanvas';
import { TodoList } from './components/TodoList';
import { VoiceAudioRecorder } from './components/VoiceAudioRecorder';
import { SpotlightSearchModal } from './components/SpotlightSearchModal';
import { BackupModal } from './components/BackupModal';
import { ExportModal } from './components/ExportModal';
import { extractTasksFromText } from './utils/taskManager';
import { textLinesToConceptNodes } from './utils/conceptMap';
import { PanelLeftOpen } from 'lucide-react';

// Helper to safely write to localStorage without throwing QuotaExceededError or crashing React
function safeSaveToStorage(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err: any) {
    console.warn(`[NotaScribe] Advertencia de almacenamiento para ${key}:`, err);
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      try {
        if (key === 'notascribe_notes' && Array.isArray(data)) {
          // Prune older stroke arrays to fit within mobile/tablet quota
          const streamlined = data.map((n: NoteItem) => ({
            ...n,
            strokes: (n.strokes || []).slice(-200),
          }));
          localStorage.setItem(key, JSON.stringify(streamlined));
        }
      } catch (inner) {
        console.warn('[NotaScribe] Quota de almacenamiento al límite. Los datos siguen activos en memoria de sesión.');
      }
    }
  }
}

export default function App() {
  // Local-only state, initialized strictly with error protection
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('notascribe_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((n: any) => n && typeof n === 'object' && n.id);
          if (valid.length > 0) return valid;
        }
      }
    } catch (e) {
      console.warn('[NotaScribe] Error inicializando notas:', e);
    }
    return initialNotes;
  });

  const [notebooks, setNotebooks] = useState<Notebook[]>(() => {
    try {
      const saved = localStorage.getItem('notascribe_notebooks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('[NotaScribe] Error inicializando cuadernos:', e);
    }
    return initialNotebooks;
  });

  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('notascribe_active_note_id');
      if (saved && notes.some((n) => n.id === saved)) return saved;
    } catch {}
    return notes[0]?.id || initialNotes[0]?.id || '';
  });

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem('notascribe_tasks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('[NotaScribe] Error inicializando tareas:', e);
    }
    return initialTasks;
  });

  const [conceptGraph, setConceptGraph] = useState<ConceptGraph>(() => {
    try {
      const saved = localStorage.getItem('notascribe_concept_graph');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.warn('[NotaScribe] Error inicializando mapa conceptual:', e);
    }
    return initialConceptGraph;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('canvas');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isRightPaneOpen, setIsRightPaneOpen] = useState<boolean>(false);
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState<boolean>(false);

  // New Modals: Spotlight Search, Backup, and Export
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced persistence effects to prevent blocking drawing loops and avoid QuotaExceeded
  useEffect(() => {
    const timer = setTimeout(() => {
      safeSaveToStorage('notascribe_notes', notes);
    }, 400);
    return () => clearTimeout(timer);
  }, [notes]);

  useEffect(() => {
    safeSaveToStorage('notascribe_notebooks', notebooks);
  }, [notebooks]);

  useEffect(() => {
    try {
      localStorage.setItem('notascribe_active_note_id', activeNoteId);
    } catch {}
  }, [activeNoteId]);

  useEffect(() => {
    safeSaveToStorage('notascribe_tasks', tasks);
  }, [tasks]);

  useEffect(() => {
    safeSaveToStorage('notascribe_concept_graph', conceptGraph);
  }, [conceptGraph]);

  // Active note object
  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0] || null;

  // Note actions
  const handleUpdateActiveNote = (updates: Partial<NoteItem>) => {
    if (!activeNote) return;
    setNotes((prevNotes) =>
      prevNotes.map((n) => (n.id === activeNote.id ? { ...n, ...updates } : n))
    );
  };

  const handleCreateNote = (notebookId?: string) => {
    const targetNotebook = notebookId || notebooks[0]?.id || 'nb-general';
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      title: 'Nueva Hoja Blanca',
      content: '',
      strokes: [],
      pages: [[]],
      activePageIndex: 0,
      paperStyle: 'blank', // Blank paper by default as requested
      notebookId: targetNotebook,
      tags: [],
      isPinned: false,
      isArchived: false,
      isDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newNote.id);
    setActiveTab('canvas');
  };

  const handleDeleteNote = (id: string) => {
    setNotes(notes.filter((n) => n.id !== id));
    if (activeNoteId === id) {
      const remaining = notes.filter((n) => n.id !== id);
      if (remaining.length > 0) {
        setActiveNoteId(remaining[0].id);
      } else {
        handleCreateNote();
      }
    }
  };

  const handleTogglePinNote = (id: string) => {
    setNotes(
      notes.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n))
    );
  };

  const handleCreateNotebook = (name: string, color: string) => {
    const newNb: Notebook = {
      id: `nb-${Date.now()}`,
      name,
      color,
      icon: 'Folder',
    };
    setNotebooks([...notebooks, newNb]);
  };

  // Cross-feature connections
  const handleConvertToTasks = (text: string) => {
    const extracted = extractTasksFromText(text, 'medium');
    if (extracted.length > 0) {
      setTasks((prev) => [...extracted, ...prev]);
    } else {
      const singleTask: TaskItem = {
        id: `task-${Date.now()}`,
        text: text.slice(0, 100),
        completed: false,
        priority: 'medium',
        createdAt: Date.now(),
      };
      setTasks((prev) => [singleTask, ...prev]);
    }
    setActiveTab('tasks');
  };

  const handleConvertToConceptMap = (text: string) => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const title = lines[0]?.slice(0, 40) || activeNote?.title || 'Concepto';
    const children = lines.slice(1, 7);

    const { nodes, edges } = textLinesToConceptNodes(
      title,
      children.length > 0 ? children : ['Subconcepto 1', 'Subconcepto 2']
    );

    setConceptGraph({
      id: `graph-${Date.now()}`,
      title,
      nodes,
      edges,
    });
    setActiveTab('concept');
  };

  const handleInsertTextIntoActiveNote = (text: string) => {
    if (!activeNote) return;
    const updatedContent = activeNote.content
      ? `${activeNote.content}\n\n${text}`
      : text;

    handleUpdateActiveNote({
      content: updatedContent,
      ocrText: text,
      updatedAt: Date.now(),
    });
  };

  const handleSelectSearchResult = (tab: ActiveTab, targetId: string) => {
    setActiveTab(tab);
    if (tab === 'canvas') {
      setActiveNoteId(targetId);
    }
  };

  const handleApplyRestoredData = (data: {
    notes: NoteItem[];
    notebooks: Notebook[];
    tasks: TaskItem[];
    conceptGraphs: ConceptGraph[];
  }) => {
    setNotes(data.notes);
    setNotebooks(data.notebooks);
    setTasks(data.tasks);
    if (data.conceptGraphs.length > 0) {
      setConceptGraph(data.conceptGraphs[0]);
    }
    if (data.notes[0]?.id) {
      setActiveNoteId(data.notes[0].id);
    }
  };

  const handleResetAsNew = () => {
    if (window.confirm('¿Deseas dejar la app como nueva? Se limpiarán todas las notas y tareas locales.')) {
      localStorage.removeItem('notascribe_notes');
      localStorage.removeItem('notascribe_notebooks');
      localStorage.removeItem('notascribe_active_note_id');
      localStorage.removeItem('notascribe_tasks');
      localStorage.removeItem('notascribe_concept_graph');
      setNotes(initialNotes);
      setNotebooks(initialNotebooks);
      setActiveNoteId(initialNotes[0].id);
      setTasks(initialTasks);
      setConceptGraph(initialConceptGraph);
      setActiveTab('canvas');
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100">
      {/* Top Tablet Navigation */}
      <TabletNavbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeNote={activeNote}
        onNoteTitleChange={(title) => handleUpdateActiveNote({ title, updatedAt: Date.now() })}
        notebooks={notebooks}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isRightPaneOpen={isRightPaneOpen}
        onToggleRightPane={() => setIsRightPaneOpen(!isRightPaneOpen)}
        onOpenVoiceRecorder={() => setIsVoiceRecorderOpen(true)}
        onExportNote={() => setIsExportModalOpen(true)}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
      />

      {/* Main Workspace: Sidebar & Main View */}
      <div className="flex-1 w-full flex overflow-hidden relative">
        <OrganizerSidebar
          notes={notes}
          notebooks={notebooks}
          activeNoteId={activeNoteId}
          onSelectNote={(id) => {
            setActiveNoteId(id);
            setActiveTab('canvas');
          }}
          onCreateNote={handleCreateNote}
          onDeleteNote={handleDeleteNote}
          onTogglePinNote={handleTogglePinNote}
          onCreateNotebook={handleCreateNotebook}
          onResetAsNew={handleResetAsNew}
          onOpenSearch={() => setIsSearchModalOpen(true)}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Floating edge tab to open left sidebar when minimized */}
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-1/2 -translate-y-1/2 left-0 z-30 bg-white/95 dark:bg-slate-900/95 border border-l-0 border-slate-200 dark:border-slate-800 shadow-md py-3 px-1.5 rounded-r-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex flex-col items-center gap-1.5 transition-all select-none"
            title="Abrir menú de cuadernos y organizador"
            aria-label="Abrir menú"
          >
            <PanelLeftOpen className="w-4 h-4" />
            <span className="text-[10px] [writing-mode:vertical-rl] font-semibold tracking-wider">
              Menú
            </span>
          </button>
        )}

        {/* View Router */}
        <main className="flex-1 h-full flex flex-col overflow-hidden relative">
          {activeTab === 'canvas' && (
            activeNote ? (
              <NoteEditorView
                note={activeNote}
                onUpdateNote={handleUpdateActiveNote}
                onDeleteNote={handleDeleteNote}
                isRightPaneOpen={isRightPaneOpen}
                onToggleRightPane={() => setIsRightPaneOpen(!isRightPaneOpen)}
                onConvertToTasks={handleConvertToTasks}
                onConvertToConceptMap={handleConvertToConceptMap}
                onOpenInFullDiagramsTab={(diagramGraph) => {
                  setConceptGraph(diagramGraph);
                  setActiveTab('concept');
                }}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                <div>
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                    No hay ninguna nota seleccionada
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleCreateNote()}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold"
                  >
                    Crear Nueva Hoja
                  </button>
                </div>
              </div>
            )
          )}

          {activeTab === 'concept' && (
            <ConceptMapCanvas
              graph={conceptGraph}
              onGraphChange={setConceptGraph}
              currentNoteText={activeNote?.content || activeNote?.ocrText}
              onExportToNote={handleInsertTextIntoActiveNote}
            />
          )}

          {activeTab === 'tasks' && (
            <TodoList
              tasks={tasks}
              notebooks={notebooks}
              onTasksChange={setTasks}
              onOpenVoiceForTask={() => setIsVoiceRecorderOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Voice Audio Transcription Modal */}
      <VoiceAudioRecorder
        isOpen={isVoiceRecorderOpen}
        onClose={() => setIsVoiceRecorderOpen(false)}
        onInsertIntoNote={handleInsertTextIntoActiveNote}
        onConvertToTasks={handleConvertToTasks}
        onConvertToConceptMap={handleConvertToConceptMap}
      />

      {/* Spotlight Universal Search Modal (Ctrl+K) */}
      <SpotlightSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        notes={notes}
        tasks={tasks}
        conceptGraph={conceptGraph}
        onSelectResult={handleSelectSearchResult}
      />

      {/* Local Offline Backup & Restore Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        notes={notes}
        notebooks={notebooks}
        tasks={tasks}
        conceptGraph={conceptGraph}
        onRestore={handleApplyRestoredData}
      />

      {/* Export & Print Modal for Active Note */}
      {activeNote && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          title={activeNote.title}
          canvasElement={document.querySelector('canvas')}
          textContent={activeNote.content || activeNote.ocrText}
        />
      )}
    </div>
  );
}
