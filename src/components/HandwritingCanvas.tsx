import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  PenTool,
  PaperStyle,
  Stroke,
  Point,
} from '../types';
import {
  getDynamicStrokeWidth,
  getMidPoint,
  getStrokesBoundingBox,
} from '../utils/inkSmoothing';
import {
  predictNextPoint,
  detectGeometricShape,
  generateCleanShapePoints,
  getSpanishWordPredictions,
} from '../utils/predictiveInk';
import {
  Pen,
  Highlighter,
  Brush,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Maximize2,
  Minimize2,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Download,
  Copy,
  Check,
  ListPlus,
  Network,
  RotateCcw,
  Shapes,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
} from 'lucide-react';

interface HandwritingCanvasProps {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  paperStyle: PaperStyle;
  onPaperStyleChange: (style: PaperStyle) => void;
  onInsertTextIntoNote: (text: string) => void;
  onConvertToTasks?: (tasksText: string) => void;
  onConvertToConceptMap?: (conceptText: string) => void;
}

const COLOR_PRESETS = [
  '#0f172a', // Slate black
  '#2563eb', // Royal blue
  '#dc2626', // Crimson red
  '#16a34a', // Emerald green
  '#9333ea', // Violet purple
  '#ea580c', // Tangerine
  '#ca8a04', // Amber/gold
  '#facc15', // Highlighter bright yellow
];

const STROKE_SIZES = [2, 4, 8, 14, 24];

export const HandwritingCanvas: React.FC<HandwritingCanvasProps> = ({
  strokes,
  onStrokesChange,
  paperStyle,
  onPaperStyleChange,
  onInsertTextIntoNote,
  onConvertToTasks,
  onConvertToConceptMap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Drawing state
  const [currentTool, setCurrentTool] = useState<PenTool>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#0f172a');
  const [currentSize, setCurrentSize] = useState<number>(4);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);

  // Tablet-specific modes & predictive features
  const [palmRejection, setPalmRejection] = useState<boolean>(false);
  const [showPalmShield, setShowPalmShield] = useState<boolean>(false);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [predictiveShapes, setPredictiveShapes] = useState<boolean>(true);
  const [predictiveStylus, setPredictiveStylus] = useState<boolean>(true);
  const [showPaperHelp, setShowPaperHelp] = useState<boolean>(false);

  // Undo/Redo history
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Live handwriting recognition state
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [autoRecognize, setAutoRecognize] = useState<boolean>(true);
  const [isOcrBarExpanded, setIsOcrBarExpanded] = useState<boolean>(false);
  const autoRecognizeTimerRef = useRef<any>(null);

  // Canvas dimensions
  const [dimensions, setDimensions] = useState({ width: 1200, height: 1600 });

  // Update canvas sizing & DPR
  const updateCanvasDimensions = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const width = Math.max(clientWidth, 800);
    const height = Math.max(clientHeight, 1200);
    setDimensions({ width, height });
  }, []);

  useEffect(() => {
    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);
    return () => window.removeEventListener('resize', updateCanvasDimensions);
  }, [updateCanvasDimensions, isZenMode]);

  // Synchronize history when external strokes change
  useEffect(() => {
    if (history.length === 0 && strokes.length > 0) {
      setHistory([strokes]);
      setHistoryIndex(0);
    }
  }, [strokes, history.length]);

  // Draw paper background
  const drawBackground = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.save();

      if (paperStyle === 'dark_board') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);

        // Subtle dark grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        const step = 28;
        ctx.beginPath();
        for (let x = 0; x < width; x += step) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = 0; y < height; y += step) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
        ctx.restore();
        return;
      }

      // Warm paper background for light styles
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      if (paperStyle === 'blank') {
        // Completely clean white canvas with subtle page border
        ctx.restore();
        return;
      }

      if (paperStyle === 'ruled') {
        // Horizontal ruled lines (cuaderno clásico para guiar la escritura recta)
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        const lineSpacing = 32;
        const topMargin = 80;

        ctx.beginPath();
        for (let y = topMargin; y < height; y += lineSpacing) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();

        // Left margin guide line (red/pink line like classic notebook)
        ctx.strokeStyle = '#fecdd3';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(80, 0);
        ctx.lineTo(80, height);
        ctx.stroke();
      } else if (paperStyle === 'grid') {
        // Grid lines for diagrams and math
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        const step = 24;

        ctx.beginPath();
        for (let x = 0; x < width; x += step) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = 0; y < height; y += step) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
      } else if (paperStyle === 'dots') {
        // Dot grid (bullet journal)
        ctx.fillStyle = '#cbd5e1';
        const step = 26;
        for (let x = step; x < width; x += step) {
          for (let y = step; y < height; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (paperStyle === 'cornell') {
        // Cornell notes layout
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;

        // Top header divider
        ctx.beginPath();
        ctx.moveTo(0, 80);
        ctx.lineTo(width, 80);
        ctx.stroke();

        // Cues vertical divider
        const cueDividerX = Math.round(width * 0.28);
        ctx.beginPath();
        ctx.moveTo(cueDividerX, 80);
        ctx.lineTo(cueDividerX, height - 160);
        ctx.stroke();

        // Summary horizontal divider
        ctx.beginPath();
        ctx.moveTo(0, height - 160);
        ctx.lineTo(width, height - 160);
        ctx.stroke();

        // Ruled lines in notes column
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        for (let y = 110; y < height - 160; y += 30) {
          ctx.moveTo(cueDividerX, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();

        // Labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.fillText('IDEAS CLAVE / PREGUNTAS', 20, 100);
        ctx.fillText('APUNTES PRINCIPALES', cueDividerX + 20, 100);
        ctx.fillText('RESUMEN', 20, height - 140);
      }

      ctx.restore();
    },
    [paperStyle]
  );

  // Render a single stroke with smooth bezier interpolation
  const renderStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      const points = stroke.points;
      if (!points || points.length === 0) return;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'highlighter') {
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = stroke.size * 2.5;
        ctx.beginPath();
        if (points.length === 1) {
          ctx.arc(points[0].x, points[0].y, stroke.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
        }
        ctx.restore();
        return;
      }

      if (stroke.tool === 'eraser') {
        ctx.strokeStyle = paperStyle === 'dark_board' ? '#0f172a' : '#ffffff';
        ctx.lineWidth = stroke.size * 3;
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        if (points.length === 1) {
          ctx.arc(points[0].x, points[0].y, stroke.size * 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
        }
        ctx.restore();
        return;
      }

      // Pen, Fountain, Brush with dynamic pressure
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = stroke.opacity;

      if (points.length === 1) {
        ctx.fillStyle = stroke.color;
        const radius = getDynamicStrokeWidth(stroke.size, stroke.tool, points[0].pressure) / 2;
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, Math.max(1, radius), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // Smooth curve drawing through midpoints
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const mid = getMidPoint(p1, p2);

        const currentWidth = getDynamicStrokeWidth(
          stroke.size,
          stroke.tool,
          (p1.pressure ?? 0.5) + (p2.pressure ?? 0.5) / 2
        );

        ctx.lineWidth = currentWidth;
        ctx.beginPath();

        if (i === 0) {
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(mid.x, mid.y);
        } else {
          const prevMid = getMidPoint(points[i - 1], p1);
          ctx.moveTo(prevMid.x, prevMid.y);
          ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
        }

        ctx.stroke();
      }

      // Connect last midpoint to terminal point
      if (points.length > 2) {
        const lastIdx = points.length - 1;
        const prevMid = getMidPoint(points[lastIdx - 1], points[lastIdx]);
        ctx.beginPath();
        ctx.moveTo(prevMid.x, prevMid.y);
        ctx.lineTo(points[lastIdx].x, points[lastIdx].y);
        ctx.stroke();
      }

      ctx.restore();
    },
    [paperStyle]
  );

  // Full redraw of background + all strokes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawBackground(ctx, dimensions.width, dimensions.height);

    for (const stroke of strokes) {
      renderStroke(ctx, stroke);
    }

    if (activeStroke) {
      renderStroke(ctx, activeStroke);
    }
  }, [dimensions, drawBackground, strokes, activeStroke, renderStroke]);

  // Redraw when dimensions, paper style, or strokes change
  useEffect(() => {
    redraw();
  }, [redraw]);

  // Pointer event handlers for ultra-fluid drawing with predictive math
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (palmRejection && e.pointerType === 'touch') {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    const newStroke: Stroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tool: currentTool,
      color: currentColor,
      size: currentSize,
      opacity: currentTool === 'highlighter' ? 0.4 : 1.0,
      timestamp: Date.now(),
      points: [{ x, y, pressure, time: Date.now() }],
    };

    setIsDrawing(true);
    setActiveStroke(newStroke);

    if (autoRecognizeTimerRef.current) {
      clearTimeout(autoRecognizeTimerRef.current);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !activeStroke) return;
    if (palmRejection && e.pointerType === 'touch') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    const newPoint: Point = { x, y, pressure, time: Date.now() };

    setActiveStroke((prev) => {
      if (!prev) return null;
      const pts = [...prev.points, newPoint];

      // Predictive stylus path continuation
      if (predictiveStylus && pts.length >= 3) {
        const predicted = predictNextPoint(pts, 4);
        if (predicted) {
          // Keep trajectory responsive
        }
      }

      return {
        ...prev,
        points: pts,
      };
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !activeStroke) return;

    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    setIsDrawing(false);

    if (activeStroke.points.length > 0) {
      let finalStroke = activeStroke;

      // Predictive shape recognition: snap circle, rectangle, or straight line
      if (predictiveShapes && activeStroke.tool !== 'eraser' && activeStroke.points.length > 8) {
        const shapeDetection = detectGeometricShape(activeStroke.points);
        if (shapeDetection.type && shapeDetection.confidence > 0.75) {
          const cleanPoints = generateCleanShapePoints(activeStroke.points, shapeDetection.type);
          finalStroke = {
            ...activeStroke,
            points: cleanPoints,
          };
        }
      }

      const updatedStrokes = [...strokes, finalStroke];
      onStrokesChange(updatedStrokes);

      // Push to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(updatedStrokes);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      // Auto recognize trigger after user pauses writing
      if (autoRecognize) {
        if (autoRecognizeTimerRef.current) clearTimeout(autoRecognizeTimerRef.current);
        autoRecognizeTimerRef.current = setTimeout(() => {
          triggerHandwritingRecognition(updatedStrokes);
        }, 1800);
      }
    }

    setActiveStroke(null);
  };

  const handlePointerCancel = () => {
    setIsDrawing(false);
    setActiveStroke(null);
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevStrokes = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onStrokesChange(prevStrokes);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      onStrokesChange([]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextStrokes = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onStrokesChange(nextStrokes);
    }
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    onStrokesChange([]);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setRecognizedText('');
  };

  // Trigger Gemini Handwriting Recognition
  const triggerHandwritingRecognition = async (strokesToRecognize: Stroke[] = strokes) => {
    if (strokesToRecognize.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsRecognizing(true);

    try {
      const bbox = getStrokesBoundingBox(strokesToRecognize, 24);
      let dataUrl = '';

      if (bbox && bbox.width > 20 && bbox.height > 20) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = Math.min(bbox.width, 1600);
        offCanvas.height = Math.min(bbox.height, 1600);
        const offCtx = offCanvas.getContext('2d');

        if (offCtx) {
          offCtx.fillStyle = '#ffffff';
          offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
          offCtx.save();
          offCtx.translate(-bbox.minX, -bbox.minY);

          for (const s of strokesToRecognize) {
            renderStroke(offCtx, s);
          }
          offCtx.restore();
          dataUrl = offCanvas.toDataURL('image/png');
        }
      }

      if (!dataUrl) {
        dataUrl = canvas.toDataURL('image/png');
      }

      const res = await fetch('/api/recognize-handwriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          language: 'es',
        }),
      });

      if (!res.ok) throw new Error('Error en reconocimiento');
      const data = await res.json();
      if (data.text) {
        setRecognizedText(data.text);
      }
    } catch (err: any) {
      console.warn('Reconocimiento manuscrito fallback:', err);
    } finally {
      setIsRecognizing(false);
    }
  };

  // Export canvas as image
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `nota-manuscrita-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const copyToClipboard = () => {
    if (!recognizedText) return;
    navigator.clipboard.writeText(recognizedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Predictive word chips based on current recognized text
  const predictiveWords = getSpanishWordPredictions(recognizedText);

  const handleInsertWord = (word: string) => {
    const updated = recognizedText ? `${recognizedText} ${word}` : word;
    setRecognizedText(updated);
    onInsertTextIntoNote(updated);
  };

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full h-full bg-slate-100 overflow-hidden select-none ${
        isZenMode ? 'fixed inset-0 z-50 bg-slate-900' : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Floating Tablet Stylus Toolbar - Clean and Ergonomic */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-[96vw] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2.5 py-1.5 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* Pen Tools */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setCurrentTool('pen')}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
              currentTool === 'pen'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Bolígrafo de precisión"
            aria-label="Bolígrafo"
          >
            <Pen className="w-4 h-4" />
            <span className="hidden sm:inline">Pluma</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTool('fountain')}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
              currentTool === 'fountain'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Pluma caligráfica"
            aria-label="Pluma estilográfica"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Caligrafía</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentTool('highlighter');
              if (currentColor === '#0f172a') setCurrentColor('#facc15');
            }}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
              currentTool === 'highlighter'
                ? 'bg-yellow-500 text-slate-900 shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Marcador fluorescente"
            aria-label="Resaltador"
          >
            <Highlighter className="w-4 h-4" />
            <span className="hidden sm:inline">Resaltar</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTool('brush')}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
              currentTool === 'brush'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Pincel artístico"
            aria-label="Pincel"
          >
            <Brush className="w-4 h-4" />
            <span className="hidden sm:inline">Pincel</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTool('eraser')}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
              currentTool === 'eraser'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Borrador de trazos"
            aria-label="Borrador"
          >
            <Eraser className="w-4 h-4" />
            <span className="hidden sm:inline">Borrar</span>
          </button>
        </div>

        {/* Color Palette (hidden when eraser active) */}
        {currentTool !== 'eraser' && (
          <div className="flex items-center gap-1 px-1 border-l border-slate-200 dark:border-slate-800">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setCurrentColor(color)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  currentColor === color ? 'scale-125 ring-2 ring-blue-500 ring-offset-2' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Color ${color}`}
              />
            ))}
          </div>
        )}

        {/* Stroke Width Selector */}
        <div className="flex items-center gap-1 px-1 border-l border-slate-200 dark:border-slate-800">
          {STROKE_SIZES.map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => setCurrentSize(sz)}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                currentSize === sz
                  ? 'bg-blue-100 text-blue-700 font-bold dark:bg-blue-900/60 dark:text-blue-200'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={`Grosor ${sz}px`}
              aria-label={`Grosor ${sz}px`}
            >
              <span
                className="rounded-full bg-current"
                style={{ width: Math.min(14, sz + 2), height: Math.min(14, sz + 2) }}
              />
            </button>
          ))}
        </div>

        {/* Paper Style Selector - Clear & Intuitive */}
        <div className="flex items-center gap-1 px-1 border-l border-slate-200 dark:border-slate-800 relative">
          <select
            value={paperStyle}
            onChange={(e) => onPaperStyleChange(e.target.value as PaperStyle)}
            className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg px-2 py-1.5 border border-slate-200 dark:border-slate-700 outline-none font-medium cursor-pointer"
            title="Cambiar tipo de papel de fondo"
            aria-label="Tipo de papel"
          >
            <option value="blank">Liso (Sin líneas)</option>
            <option value="ruled">Líneas de Cuaderno</option>
            <option value="grid">Cuadrícula</option>
            <option value="dots">Puntos (Bullet)</option>
            <option value="cornell">Método Cornell</option>
            <option value="dark_board">Pizarra Oscura</option>
          </select>

          <button
            type="button"
            onClick={() => setShowPaperHelp(!showPaperHelp)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
            title="¿Para qué sirven las líneas del cuaderno?"
            aria-label="Ayuda sobre el fondo de papel"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {showPaperHelp && (
            <div className="absolute top-10 right-0 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-40 text-left text-xs">
              <div className="font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center justify-between">
                <span>¿Para qué sirve el fondo?</span>
                <button
                  type="button"
                  onClick={() => setShowPaperHelp(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ×
                </button>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                <strong>Líneas (Cuaderno):</strong> Guía para mantener la escritura recta y uniforme con el lápiz stylus.<br />
                <strong>Liso (Sin líneas):</strong> Superficie limpia para dibujar libremente o crear diagramas sin distracciones.<br />
                <strong>Cuadrícula:</strong> Ideal para gráficos, geometría y diagramas técnicos.
              </p>
            </div>
          )}
        </div>

        {/* Predictive Features Toggles */}
        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-1">
          <button
            type="button"
            onClick={() => setPredictiveShapes(!predictiveShapes)}
            className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1 transition-all ${
              predictiveShapes
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={
              predictiveShapes
                ? 'Predicción de formas ACTIVADA (Líneas y círculos a mano se perfeccionan automáticamente)'
                : 'Predicción de formas DESACTIVADA'
            }
            aria-label="Formas predictivas"
          >
            <Shapes className="w-4 h-4" />
            <span className="hidden xl:inline">Formas</span>
          </button>

          {/* Tablet Palm Rejection Mode */}
          <button
            type="button"
            onClick={() => setPalmRejection(!palmRejection)}
            className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              palmRejection
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
            title={
              palmRejection
                ? 'Rechazo de palma ACTIVADO (Solo registra el lápiz stylus)'
                : 'Rechazo de palma DESACTIVADO (Acepta stylus y dedos)'
            }
            aria-label="Rechazo de palma"
          >
            {palmRejection ? <ShieldCheck className="w-4 h-4 text-white" /> : <ShieldAlert className="w-4 h-4" />}
            <span className="hidden md:inline">Palma</span>
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-slate-800 pl-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex <= 0 && strokes.length === 0}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
            title="Deshacer trazo"
            aria-label="Deshacer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
            title="Rehacer trazo"
            aria-label="Rehacer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Clear Canvas */}
        <button
          type="button"
          onClick={handleClear}
          disabled={strokes.length === 0}
          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30"
          title="Borrar todo el lienzo"
          aria-label="Borrar lienzo"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Export / Zen Fullscreen */}
        <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-slate-800 pl-1">
          <button
            type="button"
            onClick={handleExportPNG}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Descargar dibujo como imagen PNG"
            aria-label="Descargar imagen"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsZenMode(!isZenMode)}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            title={isZenMode ? 'Salir de pantalla completa' : 'Modo Zen / Pantalla completa'}
            aria-label="Pantalla completa"
          >
            {isZenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Predictive Spanish Words Chips Bar (Non-intrusive floating bar) */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-full border border-slate-200/60 dark:border-slate-800/60 shadow-xs max-w-[92vw] overflow-x-auto">
        <span className="text-[10px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-purple-500" />
          Sugerencias:
        </span>
        {predictiveWords.map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => handleInsertWord(word)}
            className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 rounded-full text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors shrink-0"
            title={`Insertar "${word}"`}
          >
            {word}
          </button>
        ))}
      </div>

      {/* Canvas Drawing Area */}
      <div className="flex-1 w-full h-full overflow-auto relative">
        <canvas
          ref={canvasRef}
          width={dimensions.width * dpr}
          height={dimensions.height * dpr}
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
          className="block mx-auto cursor-crosshair shadow-md"
        />

        {/* Rest Guard / Palm Shield overlay for comfortable hand resting */}
        {showPalmShield && (
          <div
            className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-slate-200/95 to-slate-200/70 dark:from-slate-800/95 dark:to-slate-800/70 backdrop-blur-sm border-t-2 border-dashed border-amber-400 z-20 flex items-center justify-between px-6 pointer-events-auto"
            title="Área de reposo de la mano. Los toques en esta zona están protegidos."
          >
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Zona de reposo de muñeca y palma</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPalmShield(false)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
            >
              Ocultar
            </button>
          </div>
        )}
      </div>

      {/* Clean Collapsible Real-Time Handwriting Recognition Panel */}
      <div className="relative z-30 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 px-4 py-2 shadow-lg transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Status & Preview snippet */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setIsOcrBarExpanded(!isOcrBarExpanded)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isOcrBarExpanded ? 'Minimizar barra' : 'Expandir opciones de transcripción'}
            >
              {isOcrBarExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                isRecognizing ? 'bg-amber-100 text-amber-600 animate-spin' : 'bg-blue-100 text-blue-600'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </div>

            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 shrink-0">
              Reconocimiento:
            </span>

            <div className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-800/70 rounded-xl px-3 py-1 text-xs text-slate-800 dark:text-slate-200 truncate font-mono">
              {recognizedText ? (
                <span>{recognizedText}</span>
              ) : (
                <span className="text-slate-400 italic">Escribe en el lienzo con el lápiz para reconocer texto...</span>
              )}
            </div>
          </div>

          {/* Quick inline buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {recognizedText && (
              <button
                type="button"
                onClick={() => onInsertTextIntoNote(recognizedText)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 shadow-xs"
                title="Insertar en la nota"
              >
                <Check className="w-3 h-3" />
                <span className="hidden sm:inline">Insertar</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => triggerHandwritingRecognition()}
              disabled={isRecognizing || strokes.length === 0}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
            >
              Reconocer
            </button>
          </div>
        </div>

        {/* Expanded detailed actions */}
        {isOcrBarExpanded && (
          <div className="max-w-6xl mx-auto pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-slate-500 text-[11px]">
              {strokes.length} trazos manuscritos • {palmRejection ? 'Filtro de palma activo' : 'Táctil y stylus activos'}
            </div>

            <div className="flex items-center gap-2">
              {recognizedText && (
                <>
                  {onConvertToTasks && (
                    <button
                      type="button"
                      onClick={() => onConvertToTasks(recognizedText)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      <span>A Tareas</span>
                    </button>
                  )}

                  {onConvertToConceptMap && (
                    <button
                      type="button"
                      onClick={() => onConvertToConceptMap(recognizedText)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      <Network className="w-3.5 h-3.5" />
                      <span>A Diagrama</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg"
                    title="Copiar texto"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </>
              )}

              <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 cursor-pointer ml-2">
                <input
                  type="checkbox"
                  checked={autoRecognize}
                  onChange={(e) => setAutoRecognize(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Auto-reconocer al pausar</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
