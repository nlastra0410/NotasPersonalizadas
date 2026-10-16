import React, { useState } from 'react';
import {
  Download,
  Copy,
  Printer,
  FileText,
  Check,
  X,
  Share2,
  Image as ImageIcon,
} from 'lucide-react';
import { copyCanvasToClipboard, downloadCanvasAsPng, triggerPrintPdf, sanitizeExportFileName } from '../utils/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  canvasElement: HTMLCanvasElement | null;
  textContent?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  title,
  canvasElement,
  textContent,
}) => {
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyImage = async () => {
    if (!canvasElement) {
      setStatusMessage('No hay lienzo activo para copiar.');
      return;
    }
    const success = await copyCanvasToClipboard(canvasElement);
    if (success) {
      setCopiedImage(true);
      setStatusMessage('¡Imagen PNG copiada al portapapeles!');
      setTimeout(() => setCopiedImage(false), 3000);
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      setStatusMessage('No se pudo copiar directamente. Puedes descargar la imagen.');
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleDownloadPng = () => {
    if (!canvasElement) {
      setStatusMessage('No hay lienzo activo para descargar.');
      return;
    }
    const filename = sanitizeExportFileName(title, 'png');
    downloadCanvasAsPng(canvasElement, filename);
    setStatusMessage(`¡Descargado como "${filename}"!`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handlePrintPdf = () => {
    if (!canvasElement) {
      setStatusMessage('No hay lienzo activo para imprimir.');
      return;
    }
    triggerPrintPdf(title, canvasElement, textContent);
    onClose();
  };

  const handleCopyText = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopiedText(true);
      setStatusMessage('¡Texto copiado al portapapeles!');
      setTimeout(() => setCopiedText(false), 3000);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      setStatusMessage('Error al copiar texto.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Exportar & Compartir</h3>
              <p className="text-[11px] text-slate-500 truncate max-w-xs">{title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          {statusMessage && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-medium text-center">
              {statusMessage}
            </div>
          )}

          {/* Option 1: Copy Image to Clipboard */}
          <button
            type="button"
            onClick={handleCopyImage}
            className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 flex items-center justify-between text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                <Copy className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-800">Copiar Imagen PNG</span>
                <span className="text-[11px] text-slate-500">Pega directamente en documentos, WhatsApp o correos</span>
              </div>
            </div>
            {copiedImage ? <Check className="w-4 h-4 text-emerald-600" /> : null}
          </button>

          {/* Option 2: Download PNG */}
          <button
            type="button"
            onClick={handleDownloadPng}
            className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 flex items-center justify-between text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-800">Descargar Imagen PNG</span>
                <span className="text-[11px] text-slate-500">Guarda el dibujo o diagrama en alta resolución</span>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
          </button>

          {/* Option 3: Print / PDF */}
          <button
            type="button"
            onClick={handlePrintPdf}
            className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 flex items-center justify-between text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-800">Imprimir / Guardar en PDF</span>
                <span className="text-[11px] text-slate-500">Genera vista de página lista para exportar a PDF</span>
              </div>
            </div>
            <Share2 className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
          </button>

          {/* Option 4: Copy text if available */}
          {textContent && (
            <button
              type="button"
              onClick={handleCopyText}
              className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 flex items-center justify-between text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">Copiar Texto & Transcripción</span>
                  <span className="text-[11px] text-slate-500">Copia el contenido escrito y dictado en limpio</span>
                </div>
              </div>
              {copiedText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-right">
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
