import React from 'react';
import { ActiveTab, Notebook, NoteItem } from '../types';
import {
  Menu,
  PenTool,
  Network,
  CheckCircle2,
  Mic,
  Share2,
  Columns2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Database,
} from 'lucide-react';

interface TabletNavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  activeNote: NoteItem | null;
  onNoteTitleChange: (newTitle: string) => void;
  notebooks: Notebook[];
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isRightPaneOpen: boolean;
  onToggleRightPane: () => void;
  onOpenVoiceRecorder: () => void;
  onExportNote: () => void;
  onOpenSearch?: () => void;
  onOpenBackup?: () => void;
}

export const TabletNavbar: React.FC<TabletNavbarProps> = ({
  activeTab,
  onTabChange,
  activeNote,
  onNoteTitleChange,
  notebooks,
  isSidebarOpen,
  onToggleSidebar,
  isRightPaneOpen,
  onToggleRightPane,
  onOpenVoiceRecorder,
  onExportNote,
  onOpenSearch,
  onOpenBackup,
}) => {
  const currentNotebook = notebooks.find((n) => n.id === activeNote?.notebookId);

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 md:px-5 flex items-center justify-between gap-3 z-30 select-none">
      {/* Left: Sidebar Toggle & Note Title */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold ${
            isSidebarOpen
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={isSidebarOpen ? 'Ocultar menú izquierdo' : 'Mostrar menú izquierdo (Organizador)'}
          aria-label={isSidebarOpen ? 'Ocultar menú' : 'Mostrar menú'}
        >
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          <span className="hidden xl:inline">{isSidebarOpen ? 'Ocultar Menú' : 'Ver Menú'}</span>
        </button>

        {activeNote && (
          <div className="flex items-center gap-2 truncate">
            {currentNotebook && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: currentNotebook.color }}
                title={`Cuaderno: ${currentNotebook.name}`}
              />
            )}
            <input
              type="text"
              value={activeNote.title}
              onChange={(e) => onNoteTitleChange(e.target.value)}
              placeholder="Título de la nota..."
              className="text-sm font-bold text-slate-800 dark:text-slate-100 bg-transparent truncate border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none max-w-sm md:max-w-xl"
              aria-label="Título de la nota"
            />
          </div>
        )}
      </div>

      {/* Center: Tablet Mode Selector */}
      <nav className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
        <button
          type="button"
          onClick={() => onTabChange('canvas')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'canvas'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          aria-label="Pestaña Cuaderno"
        >
          <PenTool className="w-4 h-4" />
          <span className="hidden sm:inline">Lápiz & Notas</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('concept')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'concept'
              ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          aria-label="Pestaña Diagramas y Mapas"
        >
          <Network className="w-4 h-4" />
          <span className="hidden sm:inline">Diagramas & Mapas</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('tasks')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'tasks'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          aria-label="Pestaña Lista de Tareas"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span className="hidden sm:inline">Tareas</span>
        </button>
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* Search button (Spotlight Ctrl+K) */}
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-medium"
            title="Buscar en notas manuscritas, voz, tareas y diagramas (Ctrl + K)"
            aria-label="Buscar"
          >
            <Search className="w-4 h-4" />
            <kbd className="hidden lg:inline px-1.5 py-0.5 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
              Ctrl+K
            </kbd>
          </button>
        )}

        {/* Local Backup button */}
        {onOpenBackup && (
          <button
            type="button"
            onClick={onOpenBackup}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Copia de Seguridad y Restauración (100% offline)"
            aria-label="Copia de seguridad"
          >
            <Database className="w-4 h-4" />
          </button>
        )}

        {/* Toggle Right Text Pane (only in Canvas mode) */}
        {activeTab === 'canvas' && (
          <button
            type="button"
            onClick={onToggleRightPane}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isRightPaneOpen
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={isRightPaneOpen ? 'Minimizar texto (Solo Lienzo)' : 'Ver Ambos (Lienzo + Texto lado a lado)'}
            aria-label={isRightPaneOpen ? 'Minimizar texto' : 'Ver ambos'}
          >
            {isRightPaneOpen ? <PanelRightClose className="w-4 h-4" /> : <Columns2 className="w-4 h-4" />}
            <span className="hidden lg:inline">{isRightPaneOpen ? 'Solo Lienzo' : 'Ver Ambos'}</span>
          </button>
        )}

        {/* Voice dictation button */}
        <button
          type="button"
          onClick={onOpenVoiceRecorder}
          className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/60 transition-colors shadow-xs"
          title="Transcripción de voz a texto"
          aria-label="Dictar por voz"
        >
          <Mic className="w-4 h-4" />
          <span className="hidden md:inline">Voz</span>
        </button>

        {/* Export / Share */}
        <button
          type="button"
          onClick={onExportNote}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Exportar nota / imprimir"
          aria-label="Exportar nota"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
