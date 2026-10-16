import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
  ShieldCheck,
  Database,
} from 'lucide-react';
import type { NoteItem, Notebook, TaskItem, ConceptGraph, AppBackupData } from '../types';
import {
  generateBackupFileName,
  serializeAppData,
  validateBackupData,
  restoreAppData,
} from '../utils/backupRestore';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: NoteItem[];
  notebooks: Notebook[];
  tasks: TaskItem[];
  conceptGraph: ConceptGraph;
  onRestore: (data: {
    notes: NoteItem[];
    notebooks: Notebook[];
    tasks: TaskItem[];
    conceptGraphs: ConceptGraph[];
  }) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  notes,
  notebooks,
  tasks,
  conceptGraph,
  onRestore,
}) => {
  const [incomingBackup, setIncomingBackup] = useState<AppBackupData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportBackup = () => {
    try {
      const jsonContent = serializeAppData({
        notes,
        notebooks,
        tasks,
        conceptGraph,
      });

      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = generateBackupFileName();

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMessage(`¡Copia de seguridad descargada con éxito como "${filename}"!`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch {
      setErrorMessage('Error al generar el archivo de respaldo.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = validateBackupData(content);
      if (result.valid && result.data) {
        setIncomingBackup(result.data);
      } else {
        setErrorMessage(result.error || 'Archivo de copia de seguridad no válido.');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Error al leer el archivo seleccionado.');
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleApplyRestore = (mode: 'replace' | 'merge') => {
    if (!incomingBackup) return;

    const restored = restoreAppData(
      incomingBackup,
      {
        notes,
        notebooks,
        tasks,
        conceptGraphs: [conceptGraph],
      },
      mode
    );

    onRestore(restored);
    setSuccessMessage(
      mode === 'replace'
        ? 'Se reemplazaron todos los datos con la copia de seguridad.'
        : 'Se fusionaron los datos de la copia sin duplicar elementos.'
    );
    setIncomingBackup(null);
    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Copia de Seguridad y Restauración</h3>
              <p className="text-xs text-slate-500">100% privado y offline, guardado en tu propio dispositivo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Export */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-sm text-slate-800 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Exportar Respaldo Completo
              </h4>
              <p className="text-xs text-slate-500">
                Guarda tus notas manuscritas, transcripciones, tareas y diagramas en un archivo .json local.
              </p>
              <div className="mt-2 text-[11px] text-slate-400 font-mono">
                {notes.length} notas &bull; {tasks.length} tareas &bull; {conceptGraph.nodes.length} nodos
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportBackup}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all shrink-0"
            >
              <Download className="w-4 h-4" />
              Descargar
            </button>
          </div>

          {/* Section 2: Import */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
            <h4 className="font-semibold text-sm text-slate-800 mb-1 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-blue-600" /> Restaurar desde Archivo
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Selecciona un archivo .json previamente descargado para recuperar tus notas.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />

            {!incomingBackup ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl text-xs font-semibold text-slate-600 flex items-center justify-center gap-2 transition-all"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                Seleccionar archivo .json
              </button>
            ) : (
              <div className="p-3 bg-white border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">Copia encontrada:</span>
                  <span className="text-slate-500 text-[11px]">
                    {new Date(incomingBackup.exportedAt).toLocaleDateString('es')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="block font-bold text-slate-800">{incomingBackup.notes.length}</span>
                    <span className="text-[10px] text-slate-500">Notas</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="block font-bold text-slate-800">{incomingBackup.tasks.length}</span>
                    <span className="text-[10px] text-slate-500">Tareas</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="block font-bold text-slate-800">{incomingBackup.conceptGraphs.length}</span>
                    <span className="text-[10px] text-slate-500">Diagramas</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleApplyRestore('merge')}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Fusionar con actuales
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyRestore('replace')}
                    className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Reemplazar todo
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomingBackup(null)}
                    className="py-2 px-2.5 text-slate-500 hover:bg-slate-100 rounded-lg text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
