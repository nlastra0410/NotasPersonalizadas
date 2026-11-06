import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Download, LifeBuoy } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[NotaScribe ErrorBoundary] Error detectado:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleEmergencyBackup = () => {
    try {
      const notes = localStorage.getItem('notascribe_notes') || '[]';
      const tasks = localStorage.getItem('notascribe_tasks') || '[]';
      const notebooks = localStorage.getItem('notascribe_notebooks') || '[]';
      const concept = localStorage.getItem('notascribe_concept_graph') || '{}';

      const backupData = {
        version: 1,
        date: new Date().toISOString(),
        notes: JSON.parse(notes),
        tasks: JSON.parse(tasks),
        notebooks: JSON.parse(notebooks),
        conceptGraph: JSON.parse(concept),
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notascribe_respaldo_emergencia_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('No se pudo generar la copia automática: ' + (err as any)?.message);
    }
  };

  handleResetState = () => {
    if (window.confirm('¿Deseas restablecer la memoria temporal? Tus notas principales guardadas no se borrarán si tienes respaldo.')) {
      try {
        sessionStorage.clear();
        localStorage.removeItem('notascribe_active_note_id');
      } catch {}
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-screen h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-6">
          <div className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">
              Se detectó un problema en la vista
            </h2>

            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Para evitar perder tus notas, NotaScribe ha protegido tus datos y evitado que la aplicación se cierre abruptamente.
            </p>

            {this.state.error?.message && (
              <div className="bg-slate-950/60 p-3 rounded-xl mb-6 text-left border border-slate-700/50">
                <span className="text-[11px] font-mono text-red-300 block break-words">
                  {this.state.error.message}
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar y Continuar
              </button>

              <button
                type="button"
                onClick={this.handleEmergencyBackup}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar Respaldo
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700/60">
              <button
                type="button"
                onClick={this.handleResetState}
                className="text-xs text-slate-400 hover:text-slate-200 underline flex items-center justify-center gap-1.5 mx-auto"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                Limpiar sesión temporal
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
