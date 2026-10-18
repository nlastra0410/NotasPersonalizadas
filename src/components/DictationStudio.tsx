import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Check,
  Copy,
  Trash2,
  Download,
  ListPlus,
  Network,
  FileText,
  Volume2,
  RefreshCw,
  MessageSquare,
  Wand2,
  AlertCircle,
  Clock,
  Play,
  Square,
  Undo2,
} from 'lucide-react';
import { predictPunctuation } from '../utils/predictiveInk';

interface DictationStudioProps {
  initialText: string;
  onUpdateNoteContent: (newContent: string) => void;
  onAppendToNoteContent: (textToAppend: string) => void;
  onConvertToTasks?: (text: string) => void;
  onConvertToConceptMap?: (text: string) => void;
  noteTitle?: string;
}

type DictationMode = 'continuous' | 'conversation';

export const DictationStudio: React.FC<DictationStudioProps> = ({
  initialText,
  onUpdateNoteContent,
  onAppendToNoteContent,
  onConvertToTasks,
  onConvertToConceptMap,
  noteTitle = 'Nota',
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcriptText, setTranscriptText] = useState<string>(initialText || '');
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([initialText || '']);
  const [transcriptHistoryIndex, setTranscriptHistoryIndex] = useState<number>(0);
  const [interimText, setInterimText] = useState<string>('');
  const [dictationMode, setDictationMode] = useState<DictationMode>('continuous');
  const [autoSyncWithNote, setAutoSyncWithNote] = useState<boolean>(true);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [refinementStatus, setRefinementStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const commitTranscriptChange = useCallback(
    (newText: string) => {
      setTranscriptText(newText);
      setTranscriptHistory((prev) => {
        const next = prev.slice(0, transcriptHistoryIndex + 1);
        next.push(newText);
        if (next.length > 25) next.shift();
        return next;
      });
      setTranscriptHistoryIndex((prev) => Math.min(prev + 1, 24));
    },
    [transcriptHistoryIndex]
  );

  const handleUndo = useCallback(() => {
    if (transcriptHistoryIndex > 0) {
      const prev = transcriptHistory[transcriptHistoryIndex - 1];
      setTranscriptHistoryIndex(transcriptHistoryIndex - 1);
      setTranscriptText(prev);
      if (autoSyncWithNote) {
        onUpdateNoteContent(prev);
      }
    } else if (transcriptText) {
      setTranscriptText('');
      if (autoSyncWithNote) {
        onUpdateNoteContent('');
      }
    }
  }, [transcriptHistory, transcriptHistoryIndex, transcriptText, autoSyncWithNote, onUpdateNoteContent]);

  useEffect(() => {
    const onGlobalUndo = () => {
      handleUndo();
    };
    window.addEventListener('notascribe:undo_dictation', onGlobalUndo);
    return () => {
      window.removeEventListener('notascribe:undo_dictation', onGlobalUndo);
    };
  }, [handleUndo]);

  // References
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  isListeningRef.current = isListening;

  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);

  // Auto-sync callback to note
  const syncToNote = useCallback(
    (text: string) => {
      if (autoSyncWithNote) {
        onUpdateNoteContent(text);
      }
    },
    [autoSyncWithNote, onUpdateNoteContent]
  );

  // Stop visualizer and audio stream
  const stopAudioVisualizer = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    const canvas = visualizerCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // Start real-time audio visualizer with Web Audio API
  const startAudioVisualizer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const canvas = visualizerCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!isListeningRef.current) return;
        animFrameRef.current = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const barWidth = (width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.85;

          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          gradient.addColorStop(0, '#3b82f6');
          gradient.addColorStop(0.5, '#8b5cf6');
          gradient.addColorStop(1, '#ec4899');

          ctx.fillStyle = gradient;
          const y = (height - barHeight) / 2;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(x, y, barWidth - 2, Math.max(4, barHeight), 3) : ctx.rect(x, y, barWidth - 2, Math.max(4, barHeight));
          ctx.fill();

          x += barWidth;
        }
      };

      draw();
    } catch (err: any) {
      console.warn('Visualizador de audio no disponible:', err);
    }
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(
        'El reconocimiento de voz directo no está disponible en este navegador. Puedes usar Chrome o Safari para dictado en tiempo real.'
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';

    recognition.onresult = (event: any) => {
      let interim = '';
      let confirmedNewText = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          confirmedNewText += item[0].transcript + ' ';
        } else {
          interim += item[0].transcript;
        }
      }

      if (confirmedNewText.trim()) {
        const cleaned = predictPunctuation(confirmedNewText.trim());

        setTranscriptText((prev) => {
          let updated = '';
          if (dictationMode === 'conversation') {
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const line = `\n[${nowTime}] ${cleaned}\n`;
            updated = prev ? prev.trim() + '\n' + line : line;
          } else {
            updated = prev ? `${prev.trim()} ${cleaned}` : cleaned;
          }
          syncToNote(updated);
          return updated;
        });
      }

      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.warn('Error en reconocimiento de voz:', event.error);
      if (event.error === 'not-allowed') {
        setErrorMessage('Permiso de micrófono denegado. Permite el acceso al micrófono para dictar.');
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        // Automatically restart to keep listening continuously without pausing
        try {
          recognition.start();
        } catch {
          // ignore already started error
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
      stopAudioVisualizer();
    };
  }, [dictationMode, syncToNote, stopAudioVisualizer]);

  // Handle Recording Timer
  useEffect(() => {
    if (isListening) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isListening]);

  // Toggle listening
  const toggleListening = async () => {
    setErrorMessage(null);

    if (isListening) {
      setIsListening(false);
      isListeningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {}
      stopAudioVisualizer();
      setInterimText('');
    } else {
      if (!recognitionRef.current) {
        setErrorMessage('Reconocimiento de voz no inicializado.');
        return;
      }
      try {
        await startAudioVisualizer();
        recognitionRef.current.start();
        setIsListening(true);
        isListeningRef.current = true;
      } catch (err: any) {
        console.error('Error iniciando dictado:', err);
        setErrorMessage('No se pudo acceder al micrófono: ' + err.message);
      }
    }
  };

  // AI Refinement functions
  const handleRefine = async (type: 'clean' | 'summary' | 'tasks') => {
    if (!transcriptText.trim()) return;

    setIsRefining(true);
    setRefinementStatus(
      type === 'clean'
        ? 'Limpiando muletillas y corrigiendo puntuación...'
        : type === 'summary'
        ? 'Elaborando resumen ejecutivo estructurado...'
        : 'Extrayendo tareas pendientes...'
    );

    try {
      const res = await fetch('/api/refine-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcriptText,
          type,
        }),
      });

      if (!res.ok) throw new Error('Error en el servidor');
      const data = await res.json();

      if (data.refinedText) {
        if (type === 'clean') {
          setTranscriptText(data.refinedText);
          onUpdateNoteContent(data.refinedText);
        } else if (type === 'summary') {
          const appended = `${transcriptText}\n\n### 📋 Resumen de la Conversación\n${data.refinedText}`;
          setTranscriptText(appended);
          onUpdateNoteContent(appended);
        } else if (type === 'tasks' && onConvertToTasks) {
          onConvertToTasks(data.refinedText);
        }
      }
    } catch (err: any) {
      console.warn('Fallo en refinamiento:', err);
    } finally {
      setIsRefining(false);
      setRefinementStatus('');
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (!transcriptText) return;
    navigator.clipboard.writeText(transcriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clear dictation
  const handleClear = () => {
    if (!transcriptText) return;
    if (window.confirm('¿Deseas vaciar el texto del dictado?')) {
      setTranscriptText('');
      setInterimText('');
      onUpdateNoteContent('');
    }
  };

  // Download transcript
  const handleDownload = () => {
    if (!transcriptText) return;
    const blob = new Blob([transcriptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${noteTitle.replace(/[^a-z0-9_-]/gi, '_')}_dictado.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const wordCount = transcriptText.split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Studio Header & Mode Selector */}
      <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-center text-rose-600">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Estudio de Dictado & Conversación
              </h2>
              {isListening ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white flex items-center gap-1 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  GRABANDO EN VIVO
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Micrófono en Espera
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Habla con naturalidad: la app transcribirá y redactará todo automáticamente en tu nota.
            </p>
          </div>
        </div>

        {/* Style Selector & Auto-sync */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setDictationMode('continuous')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                dictationMode === 'continuous'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Dictado corrido para documentos y apuntes"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Modo Documento</span>
            </button>

            <button
              type="button"
              onClick={() => setDictationMode('conversation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                dictationMode === 'conversation'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Registra intervenciones por hora para reuniones y entrevistas"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Modo Conversación</span>
            </button>
          </div>

          <label
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
            title="Actualiza el texto de la nota automáticamente mientras hablas"
          >
            <input
              type="checkbox"
              checked={autoSyncWithNote}
              onChange={(e) => setAutoSyncWithNote(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>Sincronizar Nota</span>
          </label>
        </div>
      </div>

      {/* Main Studio Interactive Panel */}
      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden">
        {/* Left / Top: Interactive Mic & Visualizer Controller */}
        <div className="w-full md:w-80 lg:w-96 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            {/* Big Mic Button & Waveform */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center relative overflow-hidden">
              {/* Audio Visualizer Canvas */}
              <canvas
                ref={visualizerCanvasRef}
                width={260}
                height={50}
                className="w-full h-12 mb-3 rounded-lg"
              />

              {/* Pulsing Mic Circle Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`relative w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all transform active:scale-95 shadow-lg ${
                  isListening
                    ? 'bg-rose-600 text-white shadow-rose-500/40 animate-pulse ring-8 ring-rose-100 dark:ring-rose-950/60'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'
                }`}
                title={isListening ? 'Detener dictado' : 'Comenzar a dictar'}
              >
                {isListening ? (
                  <>
                    <Square className="w-7 h-7 fill-current" />
                    <span className="text-[10px] font-bold mt-1">Pausar</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-8 h-8" />
                    <span className="text-[10px] font-bold mt-1">Dictar</span>
                  </>
                )}
              </button>

              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{isListening ? formatSeconds(recordingSeconds) : '00:00'}</span>
                <span className="text-slate-400">•</span>
                <span>{wordCount} palabras</span>
              </div>
            </div>

            {/* Error Message if any */}
            {errorMessage && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>{errorMessage}</p>
              </div>
            )}

            {/* AI Enhancement Section */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Asistente de Redacción IA:
              </span>

              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleRefine('clean')}
                  disabled={isRefining || !transcriptText.trim()}
                  className="w-full px-3 py-2 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-semibold flex items-center justify-between disabled:opacity-40 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-blue-600" />
                    Limpiar y Puntuar
                  </span>
                  <span className="text-[10px] text-blue-500 font-normal">Quita muletillas</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRefine('summary')}
                  disabled={isRefining || !transcriptText.trim()}
                  className="w-full px-3 py-2 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-semibold flex items-center justify-between disabled:opacity-40 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    Resumen Ejecutivo
                  </span>
                  <span className="text-[10px] text-purple-500 font-normal">Puntos clave</span>
                </button>

                {onConvertToTasks && (
                  <button
                    type="button"
                    onClick={() => handleRefine('tasks')}
                    disabled={isRefining || !transcriptText.trim()}
                    className="w-full px-3 py-2 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-semibold flex items-center justify-between disabled:opacity-40 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ListPlus className="w-4 h-4 text-amber-600" />
                      Extraer Tareas
                    </span>
                    <span className="text-[10px] text-amber-500 font-normal">Compromisos</span>
                  </button>
                )}

                {onConvertToConceptMap && (
                  <button
                    type="button"
                    onClick={() => onConvertToConceptMap(transcriptText)}
                    disabled={isRefining || !transcriptText.trim()}
                    className="w-full px-3 py-2 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-between disabled:opacity-40 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-emerald-600" />
                      Crear Mapa Conceptual
                    </span>
                    <span className="text-[10px] text-emerald-500 font-normal">Diagrama</span>
                  </button>
                )}
              </div>

              {isRefining && (
                <div className="p-2 bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 rounded-xl text-xs flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{refinementStatus}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Transfer Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <button
              type="button"
              onClick={() => onAppendToNoteContent(`\n\n### 🎙️ Dictado de Voz\n${transcriptText}`)}
              disabled={!transcriptText.trim()}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40 shadow-xs transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Guardar en el Texto de la Nota</span>
            </button>
          </div>
        </div>

        {/* Right / Center: Real-time Transcript Editor */}
        <div className="flex-1 h-full flex flex-col overflow-hidden bg-white dark:bg-slate-900">
          {/* Editor Action Bar */}
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Texto Transcrito en Tiempo Real
              </span>
              {autoSyncWithNote && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Sincronizado
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Flecha de Volver Atrás / Deshacer */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={transcriptHistoryIndex <= 0 && !transcriptText}
                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                title="Volver atrás / Deshacer última frase o edición de texto puesta por error"
              >
                <Undo2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Deshacer</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                disabled={!transcriptText}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 flex items-center gap-1"
                title="Copiar texto al portapapeles"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[11px] font-medium hidden sm:inline">Copiar</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={!transcriptText}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 flex items-center gap-1"
                title="Descargar como archivo .txt"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium hidden sm:inline">Descargar</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                disabled={!transcriptText}
                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30"
                title="Borrar texto del dictado"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Transcript Content Area */}
          <div className="flex-1 p-6 flex flex-col overflow-y-auto">
            <textarea
              value={transcriptText}
              onChange={(e) => {
                const val = e.target.value;
                setTranscriptText(val);
                syncToNote(val);
              }}
              placeholder={
                isListening
                  ? 'Habla ahora... tus palabras se escribirán aquí de forma automática.'
                  : 'Pulsa el botón circular "Dictar" para comenzar a hablar, o escribe aquí tus anotaciones...'
              }
              className="w-full flex-1 bg-transparent resize-none focus:outline-none text-sm md:text-base text-slate-800 dark:text-slate-100 leading-relaxed font-sans placeholder:text-slate-400 placeholder:italic"
            />

            {/* Interim live speech preview banner (active words spoken right now) */}
            {interimText && (
              <div className="mt-3 p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 text-sm italic flex items-center gap-2 animate-pulse">
                <Mic className="w-4 h-4 shrink-0 text-blue-600 animate-bounce" />
                <span>&ldquo;{interimText}&rdquo;</span>
              </div>
            )}
          </div>

          {/* Footer Guide for Tablet Users */}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              💡 Puedes editar directamente el texto con el teclado o stylus en cualquier momento.
            </span>
            <span>Español (España / Latinoamérica)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
