import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, PenTool, Mic, CheckSquare, GitBranch, ArrowRight } from 'lucide-react';
import type { NoteItem, TaskItem, ConceptGraph, SearchResultItem, ActiveTab } from '../types';
import { searchAllContent } from '../utils/searchIndex';

interface SpotlightSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: NoteItem[];
  tasks: TaskItem[];
  conceptGraph?: ConceptGraph;
  onSelectResult: (tab: ActiveTab, targetId: string, subTargetId?: string) => void;
}

export const SpotlightSearchModal: React.FC<SpotlightSearchModalProps> = ({
  isOpen,
  onClose,
  notes,
  tasks,
  conceptGraph,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results: SearchResultItem[] = query.trim().length >= 2
    ? searchAllContent(query, { notes, tasks, conceptGraph })
    : [];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        if (results.length > 0 && results[selectedIndex]) {
          e.preventDefault();
          const target = results[selectedIndex];
          onSelectResult(target.targetTab, target.targetId, target.subTargetId);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose, onSelectResult]);

  if (!isOpen) return null;

  const renderIcon = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'note':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'handwriting':
        return <PenTool className="w-4 h-4 text-indigo-500" />;
      case 'audio':
        return <Mic className="w-4 h-4 text-emerald-500" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-amber-500" />;
      case 'diagram':
        return <GitBranch className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const renderBadge = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'note':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Nota</span>;
      case 'handwriting':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">Manuscrito OCR</span>;
      case 'audio':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">Dictado</span>;
      case 'task':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">Tarea</span>;
      case 'diagram':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">Diagrama</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Buscar en notas manuscritas, dictados, tareas o diagramas..."
            className="flex-1 bg-transparent text-slate-800 text-sm focus:outline-none placeholder:text-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results Area */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-50">
          {query.trim().length < 2 ? (
            <div className="py-10 px-4 text-center text-slate-400 text-sm">
              <p className="font-medium text-slate-600 mb-1">Buscador Inteligente Universal</p>
              <p className="text-xs">Escribe al menos 2 letras para buscar en títulos, trazos OCR, audios y nodos de diagramas.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-10 px-4 text-center text-slate-500 text-sm">
              No se encontraron coincidencias para &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectResult(item.targetTab, item.targetId, item.subTargetId);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left p-3 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-blue-50/80 border border-blue-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-white border border-slate-200 shrink-0 shadow-sm mt-0.5">
                      {renderIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-slate-800 truncate">
                          {item.title}
                        </span>
                        {renderBadge(item.type)}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {item.snippet}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-blue-600 translate-x-0.5' : 'text-slate-300'}`} />
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">↑</kbd> <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">↓</kbd> Navegar</span>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">Enter</kbd> Abrir</span>
          </div>
          <span>Búsqueda local instantánea sin nube</span>
        </div>
      </div>
    </div>
  );
};
