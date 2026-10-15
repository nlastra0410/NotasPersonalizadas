import React, { useState, useEffect } from 'react';
import {
  NoteItem,
  Notebook,
  TaskItem,
  ConceptGraph,
  ActiveTab,
  PaperStyle,
} from './types';
import {
  initialNotes,
  initialNotebooks,
  initialTasks,
  initialConceptGraph,
} from './data/initialData';
import { TabletNavbar } from './components/TabletNavbar';
import { OrganizerSidebar } from './components/OrganizerSidebar';
import { NoteEditorView } from './components/NoteEditorView';
import { ConceptMapCanvas } from './components/ConceptMapCanvas';
import { TodoList } from './components/TodoList';
import { VoiceAudioRecorder } from './components/VoiceAudioRecorder';
import { extractTasksFromText } from './utils/taskManager';
import { textLinesToConceptNodes } from './utils/conceptMap';

export default function App() {
  // State with LocalStorage persistence & clean start check
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    const saved = localStorage.getItem('notascribe_notes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // If old mock notes were present, reset to clean blank state
        if (Array.isArray(parsed) && parsed.some((n: any) => n.title?.includes('Arquitectura de App') || n.title?.includes('Biología Celular'))) {
          localStorage.removeItem('notascribe_notes');
          return initialNotes;
        }
        return parsed;
      } catch {}
    }
    return initialNotes;
  });

  const [notebooks, setNotebooks] = useState<Notebook[]>(() => {
    const saved = localStorage.getItem('notascribe_notebooks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((nb: any) => nb.id === 'nb-estudio' || nb.id === 'nb-ideas')) {
          localStorage.removeItem('notascribe_notebooks');
          return initialNotebooks;
        }
        return parsed;
      } catch {}
    }
    return initialNotebooks;
  });

  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    const saved = localStorage.getItem('notascribe_active_note_id');
    if (saved && notes.some((n) => n.id === saved)) return saved;
    return notes[0]?.id || initialNotes[0]?.id || '';
  });

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    const saved = localStorage.getItem('notascribe_tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((t: any) => t.id === 'task-1' || t.text?.includes('sensibilidad'))) {
          localStorage.removeItem('notascribe_tasks');
          return initialTasks;
        }
        return parsed;
      } catch {}
    }
    return initialTasks;
  });

  const [conceptGraph, setConceptGraph] = useState<ConceptGraph>(() => {
    const saved = localStorage.getItem('notascribe_concept_graph');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.nodes.some((n: any) => n.id === 'node-core')) {
          localStorage.removeItem('notascribe_concept_graph');
          return initialConceptGraph;
        }
        return parsed;
      } catch {}
    }
    return initialConceptGraph;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('canvas');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isRightPaneOpen, setIsRightPaneOpen] = useState<boolean>(false);
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState<boolean>(false);

  // Persistence effects
  useEffect(() => {
    localStorage.setItem('notascribe_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('notascribe_notebooks', JSON.stringify(notebooks));
  }, [notebooks]);

  useEffect(() => {
    localStorage.setItem('notascribe_active_note_id', activeNoteId);
  }, [activeNoteId]);

  useEffect(() => {
    localStorage.setItem('notascribe_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('notascribe_concept_graph', JSON.stringify(conceptGraph));
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
    const targetNotebook = notebookId || notebooks[0]?.id || 'nb-personal';
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      title: 'Nueva Nota Manuscrita',
      content: '',
      strokes: [],
      paperStyle: 'ruled',
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
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isDeleted: true, updatedAt: Date.now() } : n))
    );
  };

  const handleTogglePinNote = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n))
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

  // Cross-feature connections:
  // Convert OCR or Voice text to Tasks
  const handleConvertToTasks = (text: string) => {
    const extracted = extractTasksFromText(text, 'medium');
    if (extracted.length > 0) {
      setTasks((prev) => [...extracted, ...prev]);
    } else {
      // Create single task from line
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

  // Convert OCR or Voice text to Concept Map
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

  // Insert text into note from Voice or Concept Map
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

  // Export note as text file or print
  const handleExportNote = () => {
    if (!activeNote) return;
    const blob = new Blob([`${activeNote.title}\n\n${activeNote.content}`], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeNote.title || 'nota'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Local JSON Backup Export
  const handleExportBackup = () => {
    const backupData = {
      notes,
      notebooks,
      tasks,
      conceptGraph,
      version: 1,
      exportedAt: Date.now(),
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notascribe-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Local JSON Backup Import
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.notes && Array.isArray(imported.notes)) {
          setNotes(imported.notes);
          if (imported.notebooks) setNotebooks(imported.notebooks);
          if (imported.tasks) setTasks(imported.tasks);
          if (imported.conceptGraph) setConceptGraph(imported.conceptGraph);
          if (imported.notes[0]?.id) setActiveNoteId(imported.notes[0].id);
        }
      } catch (err) {
        console.error('Error importando copia de seguridad:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reset to brand new software state
  const handleResetAsNew = () => {
    if (window.confirm('¿Deseas dejar la app como nueva? Se limpiarán todas las notas y tareas locales de prueba.')) {
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
        onExportNote={handleExportNote}
      />

      {/* Main Tablet Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Organizer Sidebar */}
        <OrganizerSidebar
          notes={notes}
          notebooks={notebooks}
          activeNoteId={activeNoteId}
          onSelectNote={(id) => {
            setActiveNoteId(id);
            setActiveTab('canvas');
            // On small mobile viewports, auto-close sidebar on select
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          onCreateNote={handleCreateNote}
          onDeleteNote={handleDeleteNote}
          onTogglePinNote={handleTogglePinNote}
          onCreateNotebook={handleCreateNotebook}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onResetAsNew={handleResetAsNew}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* View Router */}
        <main className="flex-1 h-full flex flex-col overflow-hidden relative">
          {activeTab === 'canvas' && (
            activeNote ? (
              <NoteEditorView
                note={activeNote}
                onUpdateNote={handleUpdateActiveNote}
                isRightPaneOpen={isRightPaneOpen}
                onToggleRightPane={() => setIsRightPaneOpen(!isRightPaneOpen)}
                onConvertToTasks={handleConvertToTasks}
                onConvertToConceptMap={handleConvertToConceptMap}
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
                    Crear Nueva Nota
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
    </div>
  );
}
