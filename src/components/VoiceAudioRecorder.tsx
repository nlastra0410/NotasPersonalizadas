import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Check,
  Copy,
  ListPlus,
  Network,
  FileText,
  Volume2,
  X,
  Loader2,
} from 'lucide-react';

interface VoiceAudioRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertIntoNote: (text: string) => void;
  onConvertToTasks: (text: string) => void;
  onConvertToConceptMap: (text: string) => void;
}

export const VoiceAudioRecorder: React.FC<VoiceAudioRecorderProps> = ({
  isOpen,
  onClose,
  onInsertIntoNote,
  onConvertToTasks,
  onConvertToConceptMap,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number[]>(new Array(16).fill(10));
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  // References
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const animFrameRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Initialize SpeechRecognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-ES'; // Spanish

      recognition.onresult = (event: any) => {
        let interim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentFinal += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (currentFinal) {
          setFinalTranscript((prev) => (prev ? prev + ' ' + currentFinal : currentFinal));
        }
        setLiveTranscript(interim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition warning/error:', event.error);
      };

      recognition.onend = () => {
        if (isRecording) {
          // Restart if still marked as recording
          try {
            recognition.start();
          } catch {
            // ignore
          }
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [isRecording]);

  // Start recording voice
  const startRecording = async () => {
    setLiveTranscript('');
    setRecordingSeconds(0);

    // 1. Start Web Speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.log('Recognition start note:', e);
      }
    }

    // 2. Start MediaRecorder & Audio Visualizer
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;

      // Audio visualizer setup
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateWave = () => {
        analyser.getByteFrequencyData(dataArray);
        // sample 16 bars
        const bars: number[] = [];
        for (let i = 0; i < 16; i++) {
          const val = dataArray[i * 2] || 0;
          bars.push(Math.max(12, Math.min(80, (val / 255) * 80)));
        }
        setAudioLevel(bars);
        animFrameRef.current = requestAnimationFrame(updateWave);
      };
      updateWave();
    } catch (err) {
      console.warn('MediaRecorder / Mic stream access:', err);
    }

    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  };

  // Stop recording voice
  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }

    // Reset visualizer bars
    setAudioLevel(new Array(16).fill(10));
  };

  // Format seconds mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Combined full transcript text
  const fullText = (finalTranscript + ' ' + liveTranscript).trim();

  // Gemini AI Refinement
  const handleRefineWithAI = async () => {
    if (!fullText) return;
    setIsRefining(true);

    try {
      const res = await fetch('/api/refine-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText, type: 'clean' }),
      });

      if (!res.ok) throw new Error('Error en el servidor');
      const data = await res.json();
      if (data.refinedText) {
        setFinalTranscript(data.refinedText);
        setLiveTranscript('');
      }
    } catch (e: any) {
      console.warn('AI Refine error:', e);
    } finally {
      setIsRefining(false);
    }
  };

  const handleCopy = () => {
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Transcripción por Audio
              </h2>
              <p className="text-[11px] text-slate-500">
                Habla en español con naturalidad; convertimos tu voz a texto en tiempo real.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Audio Visualizer & Record Button */}
        <div className="p-6 text-center bg-slate-50 dark:bg-slate-950/50 flex flex-col items-center">
          {/* Waveform Bars */}
          <div className="h-20 flex items-end justify-center gap-1.5 mb-5 px-6">
            {audioLevel.map((height, idx) => (
              <div
                key={idx}
                className={`w-2 rounded-full transition-all duration-75 ${
                  isRecording ? 'bg-blue-600 shadow-sm' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                style={{ height: `${height}px` }}
              />
            ))}
          </div>

          {/* Record Toggle Button */}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isRecording
                ? 'bg-rose-600 text-white hover:bg-rose-700 animate-pulse ring-8 ring-rose-200 dark:ring-rose-950/60'
                : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 ring-8 ring-blue-100 dark:ring-blue-950/60'
            }`}
            aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
          >
            {isRecording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          </button>

          <div className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            {isRecording ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                <span>Grabando ({formatTime(recordingSeconds)}) • Pulsa para detener</span>
              </>
            ) : (
              <span>Pulsa el micrófono para comenzar a hablar</span>
            )}
          </div>
        </div>

        {/* Real-time Transcript Display */}
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Texto Transcrito
            </span>
            {fullText && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRefineWithAI}
                  disabled={isRefining}
                  className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Corregir puntuación y estructurar con Gemini"
                  aria-label="Refinar con Gemini"
                >
                  {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  <span>Refinar con IA</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Copiar texto"
                  aria-label="Copiar texto"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          <div className="min-h-[120px] max-h-[180px] p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs md:text-sm text-slate-800 dark:text-slate-100 leading-relaxed overflow-y-auto">
            {fullText ? (
              <p>
                {finalTranscript}
                <span className="text-blue-600 dark:text-blue-400 font-medium"> {liveTranscript}</span>
              </p>
            ) : (
              <p className="text-slate-400 italic">
                La transcripción aparecerá aquí en vivo mientras hablas...
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons to Insert Text */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => {
              if (fullText) {
                onInsertIntoNote(fullText);
                onClose();
              }
            }}
            disabled={!fullText}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
            aria-label="Pegar en nota"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Pegar en Nota</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (fullText) {
                onConvertToTasks(fullText);
                onClose();
              }
            }}
            disabled={!fullText}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
            aria-label="Crear tareas"
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>Crear Tareas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (fullText) {
                onConvertToConceptMap(fullText);
                onClose();
              }
            }}
            disabled={!fullText}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
            aria-label="Generar mapa"
          >
            <Network className="w-3.5 h-3.5" />
            <span>Generar Mapa</span>
          </button>
        </div>
      </div>
    </div>
  );
};
