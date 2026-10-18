import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  PenTool,
  PaperStyle,
  ToolbarPosition,
  Stroke,
  Point,
} from '../types';
import {
  getDynamicStrokeWidth,
  getMidPoint,
  getStrokesBoundingBox,
} from '../utils/inkSmoothing';
import {
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
  Zap,
  ChevronLeft,
  ChevronRight,
  Plus,
  Share2,
  PanelTop,
  PanelLeft,
  PanelRight,
  Move,
  Dock,
} from 'lucide-react';
import { ExportModal } from './ExportModal';

interface HandwritingCanvasProps {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  paperStyle: PaperStyle;
  onPaperStyleChange: (style: PaperStyle) => void;
  onInsertTextIntoNote: (text: string) => void;
  onConvertToTasks?: (tasksText: string) => void;
  onConvertToConceptMap?: (conceptText: string) => void;
  // Multipage props
  pages?: Stroke[][];
  currentPageIndex?: number;
  onPageChange?: (index: number) => void;
  onAddPage?: () => void;
  onDeletePage?: (index: number) => void;
  noteTitle?: string;
  noteContent?: string;
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

const STROKE_SIZES = [1.5, 2.5, 4, 7, 12];

export const HandwritingCanvas: React.FC<HandwritingCanvasProps> = ({
  strokes,
  onStrokesChange,
  paperStyle,
  onPaperStyleChange,
  onInsertTextIntoNote,
  onConvertToTasks,
  onConvertToConceptMap,
  pages = [],
  currentPageIndex = 0,
  onPageChange,
  onAddPage,
  onDeletePage,
  noteTitle = 'Nota Manuscrita',
  noteContent = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Drawing state
  const [currentTool, setCurrentTool] = useState<PenTool>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#0f172a');
  const [currentSize, setCurrentSize] = useState<number>(2.5); // Calibrado para escritura natural con stylus
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lastPressureRef = useRef<number>(0.5);

  // Laser Pointer state (fading neon trail for presentations)
  const laserPointsRef = useRef<Array<{ x: number; y: number; time: number }>>([]);
  const laserAnimRef = useRef<number | null>(null);

  // Tablet-specific modes & stylus state
  const [palmRejection, setPalmRejection] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notascribe_palm_rejection');
      if (saved !== null) return saved === 'true';
    }
    return true; // Rechazo de palma inteligente activo por defecto
  });
  const [stylusOnlyMode, setStylusOnlyMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notascribe_stylus_only');
      if (saved !== null) return saved === 'true';
    }
    return false;
  });
  const [isStylusDetected, setIsStylusDetected] = useState<boolean>(false);
  const [showPalmShield, setShowPalmShield] = useState<boolean>(false);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [predictiveStylus, setPredictiveStylus] = useState<boolean>(false);
  const [showPaperHelp, setShowPaperHelp] = useState<boolean>(false);
  const [showWordSuggestions, setShowWordSuggestions] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const strokesRef = useRef<Stroke[]>(strokes);
  strokesRef.current = strokes;

  const isDrawingRef = useRef<boolean>(false);
  const activePointerTypeRef = useRef<string | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notascribe_toolbar_pos');
      if (saved === 'top' || saved === 'left' || saved === 'right' || saved === 'floating') {
        return saved as ToolbarPosition;
      }
    }
    return 'top'; // Fija como menú superior por defecto (sin tapar la hoja)
  });
  const [showDockMenu, setShowDockMenu] = useState<boolean>(false);
  const [showPaperMenuVertical, setShowPaperMenuVertical] = useState<boolean>(false);

  const changeToolbarPosition = (pos: ToolbarPosition) => {
    setToolbarPosition(pos);
    if (typeof window !== 'undefined') {
      localStorage.setItem('notascribe_toolbar_pos', pos);
    }
    setShowDockMenu(false);
  };

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
    setHistory([strokes]);
    setHistoryIndex(0);
  }, [currentPageIndex]);

  // Draw paper background
  const drawBackground = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.save();

      if (paperStyle === 'dark_board') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }

      if (paperStyle === 'blank') {
        ctx.restore();
        return;
      }

      if (paperStyle === 'ruled') {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        const lineHeight = 32;
        const startY = 80;

        for (let y = startY; y < height; y += lineHeight) {
          ctx.beginPath();
          ctx.moveTo(40, y);
          ctx.lineTo(width - 40, y);
          ctx.stroke();
        }

        ctx.strokeStyle = '#fecaca';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(80, 0);
        ctx.lineTo(80, height);
        ctx.stroke();
      } else if (paperStyle === 'grid') {
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        const gridSize = 24;

        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else if (paperStyle === 'dots') {
        ctx.fillStyle = '#cbd5e1';
        const dotSpacing = 24;

        for (let x = 24; x < width; x += dotSpacing) {
          for (let y = 24; y < height; y += dotSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (paperStyle === 'cornell') {
        const cueDividerX = Math.round(width * 0.28);
        const summaryDividerY = height - 160;

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        const lineHeight = 28;
        for (let y = 90; y < summaryDividerY; y += lineHeight) {
          ctx.beginPath();
          ctx.moveTo(cueDividerX + 16, y);
          ctx.lineTo(width - 40, y);
          ctx.stroke();
        }

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cueDividerX, 80);
        ctx.lineTo(cueDividerX, summaryDividerY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(20, summaryDividerY);
        ctx.lineTo(width - 20, summaryDividerY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(20, 80);
        ctx.lineTo(width - 20, 80);
        ctx.stroke();

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

  // Render a single stroke
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

      // Pen, Fountain, Brush
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

      if (stroke.tool === 'fountain' || stroke.tool === 'brush') {
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const mid = getMidPoint(p1, p2);

          const currentWidth = getDynamicStrokeWidth(
            stroke.size,
            stroke.tool,
            ((p1.pressure ?? 0.5) + (p2.pressure ?? 0.5)) / 2
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

        if (points.length > 2) {
          const lastIdx = points.length - 1;
          const prevMid = getMidPoint(points[lastIdx - 1], points[lastIdx]);
          ctx.beginPath();
          ctx.moveTo(prevMid.x, prevMid.y);
          ctx.lineTo(points[lastIdx].x, points[lastIdx].y);
          ctx.stroke();
        }
      } else {
        // Standard pen: single continuous path with quadratic smoothing for 120Hz zero-lag ink
        ctx.lineWidth = stroke.size;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
          const mid = getMidPoint(points[i], points[i + 1]);
          ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();
      }

      ctx.restore();
    },
    [paperStyle]
  );

  // Render fading laser pointer trail
  const renderLaserTrail = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const pts = laserPointsRef.current;
      if (pts.length < 2) return;

      const now = Date.now();
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const age = now - p2.time;
        if (age > 1200) continue;

        const opacity = Math.max(0, 1 - age / 1200);

        // Outer neon glow
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#ef4444';
        ctx.strokeStyle = `rgba(239, 68, 68, ${opacity * 0.8})`;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Inner white/bright core
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#ffffff';
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Draw glowing head dot
      const last = pts[pts.length - 1];
      if (last && now - last.time < 500) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#ef4444';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
    []
  );

  // Full redraw of background + all strokes + active stroke + laser trail
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawBackground(ctx, dimensions.width, dimensions.height);

    for (const stroke of strokes) {
      renderStroke(ctx, stroke);
    }

    if (activeStroke && activeStroke.tool !== 'laser') {
      renderStroke(ctx, activeStroke);
    }

    if (laserPointsRef.current.length > 0) {
      renderLaserTrail(ctx);
    }
  }, [dimensions, drawBackground, strokes, activeStroke, renderStroke, renderLaserTrail]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Laser animation loop that fades out points
  const scheduleLaserFade = useCallback(() => {
    if (laserAnimRef.current) cancelAnimationFrame(laserAnimRef.current);

    const step = () => {
      const now = Date.now();
      laserPointsRef.current = laserPointsRef.current.filter((p) => now - p.time < 1200);

      redraw();

      if (laserPointsRef.current.length > 0) {
        laserAnimRef.current = requestAnimationFrame(step);
      } else {
        laserAnimRef.current = null;
      }
    };

    laserAnimRef.current = requestAnimationFrame(step);
  }, [redraw]);

  // Helper to configure stroke context styling
  const applyStrokeStyle = (
    ctx: CanvasRenderingContext2D,
    tool: PenTool,
    color: string,
    size: number,
    pressure: number
  ) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'highlighter') {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = size * 2.5;
    } else if (tool === 'eraser') {
      ctx.strokeStyle = paperStyle === 'dark_board' ? '#0f172a' : '#ffffff';
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = size * 3.0;
    } else {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = getDynamicStrokeWidth(size, tool, pressure);
    }
  };

  // Centralized stroke commitment helper: saves stroke without any shape distortion
  const commitCurrentStroke = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawing(false);
    activePointerIdRef.current = null;
    activePointerTypeRef.current = null;

    if (currentTool === 'laser') {
      scheduleLaserFade();
      return;
    }

    const currentStroke = activeStrokeRef.current;
    if (currentStroke && currentStroke.points.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pts = currentStroke.points;

      // Close remaining segment to last point
      if (ctx && pts.length > 2) {
        const lastIdx = pts.length - 1;
        const prevMid = getMidPoint(pts[lastIdx - 1], pts[lastIdx]);
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        applyStrokeStyle(
          ctx,
          currentTool,
          currentColor,
          currentSize,
          pts[lastIdx].pressure ?? 0.5
        );
        ctx.beginPath();
        ctx.moveTo(prevMid.x, prevMid.y);
        ctx.lineTo(pts[lastIdx].x, pts[lastIdx].y);
        ctx.stroke();
        ctx.restore();
      }

      // PURE HANDWRITING GUARANTEE: Never transform handwriting into shapes!
      // The user's handwriting is sacred and remains 100% natural, unaltered ink.
      const newStrokes = [...strokesRef.current, currentStroke];
      onStrokesChange(newStrokes);

      setHistory((prev) => {
        const newHist = prev.slice(0, historyIndex + 1);
        newHist.push(newStrokes);
        return newHist;
      });
      setHistoryIndex((prev) => prev + 1);

      // Reconcile canvas once stroke is committed
      redraw();

      if (autoRecognize) {
        if (autoRecognizeTimerRef.current) {
          clearTimeout(autoRecognizeTimerRef.current);
        }
        autoRecognizeTimerRef.current = setTimeout(() => {
          triggerHandwritingRecognition(newStrokes);
        }, 4500);
      }
    }

    activeStrokeRef.current = null;
    setActiveStroke(null);
  }, [
    currentTool,
    currentColor,
    currentSize,
    historyIndex,
    onStrokesChange,
    redraw,
    autoRecognize,
    scheduleLaserFade,
  ]);

  // High-performance pointer handlers with Coalesced Stylus Events & Smart Palm Prioritization
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const isPen = e.pointerType === 'pen';

    if (isPen) {
      setIsStylusDetected(true);
      // Stylus takes absolute priority: if an accidental palm touch was active, commit it and give control to the pen
      if (isDrawingRef.current && activeStrokeRef.current) {
        commitCurrentStroke();
      }
      activePointerIdRef.current = e.pointerId;
      activePointerTypeRef.current = 'pen';
    } else {
      // If user enabled "Solo Stylus" mode, completely ignore fingers and palms
      if (stylusOnlyMode) {
        return;
      }
      // If stylus is currently writing, ignore secondary palm touches
      if (isDrawingRef.current && activePointerTypeRef.current === 'pen') {
        return;
      }
      // Palm geometry rejection: large contact patch (> 35px) is a resting palm
      if (palmRejection && (e.width > 35 || e.height > 35)) {
        return;
      }
      // If already drawing with another touch, commit previous stroke first to avoid blocking the canvas
      if (isDrawingRef.current && activeStrokeRef.current) {
        commitCurrentStroke();
      }
      activePointerIdRef.current = e.pointerId;
      activePointerTypeRef.current = e.pointerType || 'touch';
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture fallback
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rawPressure = typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5;
    lastPressureRef.current = rawPressure;

    if (currentTool === 'laser') {
      laserPointsRef.current.push({ x, y, time: Date.now() });
      isDrawingRef.current = true;
      setIsDrawing(true);
      scheduleLaserFade();
      return;
    }

    const newStroke: Stroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tool: currentTool,
      color: currentColor,
      size: currentSize,
      opacity: currentTool === 'highlighter' ? 0.35 : 1.0,
      timestamp: Date.now(),
      points: [{ x, y, pressure: rawPressure, time: Date.now() }],
    };

    activeStrokeRef.current = newStroke;
    isDrawingRef.current = true;
    setIsDrawing(true);

    // Draw initial dot immediately onto canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      applyStrokeStyle(ctx, currentTool, currentColor, currentSize, rawPressure);
      ctx.beginPath();
      const dotRadius = Math.max(1, (ctx.lineWidth || currentSize) / 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (autoRecognizeTimerRef.current) {
      clearTimeout(autoRecognizeTimerRef.current);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    if (currentTool === 'laser') {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      laserPointsRef.current.push({ x, y, time: Date.now() });
      scheduleLaserFade();
      return;
    }

    // Safely capture coalesced events emitted by Lenovo Tab Pen / S-Pen for 120-240Hz fidelity
    let coalescedList: Array<{ clientX: number; clientY: number; pressure?: number }> = [e];
    const nativeEvt = e.nativeEvent as any;
    if (nativeEvt && typeof nativeEvt.getCoalescedEvents === 'function') {
      try {
        const events = nativeEvt.getCoalescedEvents();
        if (events && events.length > 0) {
          coalescedList = events;
        }
      } catch {
        coalescedList = [e];
      }
    }

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    for (const item of coalescedList) {
      const x = item.clientX - rect.left;
      const y = item.clientY - rect.top;
      const rawPressure = typeof item.pressure === 'number' && item.pressure > 0 ? item.pressure : 0.5;

      // Smooth pressure curve to prevent sudden blobs
      const smoothedPressure = lastPressureRef.current * 0.3 + rawPressure * 0.7;
      lastPressureRef.current = smoothedPressure;

      const newPoint: Point = { x, y, pressure: smoothedPressure, time: Date.now() };
      const pts = activeStrokeRef.current.points;
      pts.push(newPoint);

      // Draw direct incremental Bézier segment on canvas (Zero latency, no React re-render lag)
      if (ctx && pts.length >= 2) {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        applyStrokeStyle(ctx, currentTool, currentColor, currentSize, smoothedPressure);

        const len = pts.length;
        if (len === 2) {
          const mid = getMidPoint(pts[0], pts[1]);
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          ctx.lineTo(mid.x, mid.y);
          ctx.stroke();
        } else {
          const prevMid = getMidPoint(pts[len - 3], pts[len - 2]);
          const mid = getMidPoint(pts[len - 2], pts[len - 1]);
          ctx.beginPath();
          ctx.moveTo(prevMid.x, prevMid.y);
          ctx.quadraticCurveTo(pts[len - 2].x, pts[len - 2].y, mid.x, mid.y);
          ctx.stroke();
        }

        ctx.restore();
      }
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    if (e && activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    commitCurrentStroke();
  };

  const handlePointerCancel = () => {
    // If Android or browser emits cancel, commit whatever was drawn so nothing is erased!
    commitCurrentStroke();
  };

  // Prevent tablet gesture scrolling on canvas and guarantee global pointer cleanup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventTouchDefault = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('touchstart', preventTouchDefault, { passive: false });
    canvas.addEventListener('touchmove', preventTouchDefault, { passive: false });

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (isDrawingRef.current && activePointerIdRef.current !== null && e.pointerId === activePointerIdRef.current) {
        commitCurrentStroke();
      }
    };

    const handleGlobalPointerCancel = (e: PointerEvent) => {
      if (isDrawingRef.current && activePointerIdRef.current !== null && e.pointerId === activePointerIdRef.current) {
        commitCurrentStroke();
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerCancel);

    return () => {
      canvas.removeEventListener('touchstart', preventTouchDefault);
      canvas.removeEventListener('touchmove', preventTouchDefault);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel);
    };
  }, [commitCurrentStroke]);

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevStrokes = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onStrokesChange(prevStrokes);
    } else if (historyIndex === 0 && strokes.length > 0) {
      setHistoryIndex(-1);
      onStrokesChange([]);
    } else if (strokes.length > 0) {
      onStrokesChange(strokes.slice(0, -1));
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

  const copyToClipboard = () => {
    if (!recognizedText) return;
    navigator.clipboard.writeText(recognizedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const predictiveWords = getSpanishWordPredictions(recognizedText);

  const handleInsertWord = (word: string) => {
    const updated = recognizedText ? `${recognizedText} ${word}` : word;
    setRecognizedText(updated);
    onInsertTextIntoNote(updated);
  };

  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const totalPages = Math.max(1, pages.length);

  const renderDockButton = (isVertical = false, side: 'left' | 'right' = 'left') => (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowDockMenu(!showDockMenu)}
        className={`p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-all ${
          showDockMenu ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200' : ''
        }`}
        title="Cambiar posición de la barra: Fija arriba, anclada izquierda, anclada derecha o flotante"
        aria-label="Posición de la barra de herramientas"
      >
        {toolbarPosition === 'top' && <PanelTop className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
        {toolbarPosition === 'left' && <PanelLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
        {toolbarPosition === 'right' && <PanelRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
        {toolbarPosition === 'floating' && <Move className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
        {!isVertical && (
          <span className="hidden xl:inline text-xs font-semibold text-slate-700 dark:text-slate-300">
            {toolbarPosition === 'top'
              ? 'Fija Arriba'
              : toolbarPosition === 'left'
              ? 'Izquierda'
              : toolbarPosition === 'right'
              ? 'Derecha'
              : 'Flotante'}
          </span>
        )}
      </button>

      {showDockMenu && (
        <div
          className={`absolute ${
            isVertical
              ? side === 'left'
                ? 'left-full ml-2 top-0'
                : 'right-full mr-2 top-0'
              : 'right-0 top-full mt-1.5'
          } w-56 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 text-xs`}
        >
          <div className="px-2 py-1 font-bold text-slate-400 text-[10px] uppercase tracking-wider">
            Posición de la barra
          </div>
          <button
            type="button"
            onClick={() => changeToolbarPosition('top')}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
              toolbarPosition === 'top'
                ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-300'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <PanelTop className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <div className="font-semibold">Fija Arriba (Menú Superior)</div>
              <div className="text-[10px] text-slate-400">No flota, nunca tapa la hoja</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => changeToolbarPosition('left')}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
              toolbarPosition === 'left'
                ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-300'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <PanelLeft className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <div className="font-semibold">Anclada a la Izquierda</div>
              <div className="text-[10px] text-slate-400">Barra lateral vertical (ideal diestros)</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => changeToolbarPosition('right')}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
              toolbarPosition === 'right'
                ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-300'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <PanelRight className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <div className="font-semibold">Anclada a la Derecha</div>
              <div className="text-[10px] text-slate-400">Barra lateral vertical (ideal zurdos)</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => changeToolbarPosition('floating')}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
              toolbarPosition === 'floating'
                ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-300'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Move className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <div className="font-semibold">Flotante</div>
              <div className="text-[10px] text-slate-400">Flota sobre la hoja de papel</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );

  const renderHorizontalToolbar = () => (
    <div
      className={
        toolbarPosition === 'top'
          ? 'w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center justify-between gap-1.5 shrink-0 z-30 shadow-xs overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
          : 'absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-[96vw] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2.5 py-1.5 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
      }
    >
      {/* Pen Tools */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl shrink-0">
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

        {/* Laser Pointer (Presentation Mode) */}
        <button
          type="button"
          onClick={() => setCurrentTool('laser')}
          className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
            currentTool === 'laser'
              ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/50'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          title="Puntero Láser de Presentación: se desvanece a los 2 segundos, no ensucia la nota"
          aria-label="Puntero Láser"
        >
          <Sparkles className="w-4 h-4 text-rose-300" />
          <span className="hidden sm:inline">Láser</span>
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

      {/* Color Palette */}
      {currentTool !== 'eraser' && currentTool !== 'laser' && (
        <div className="flex items-center gap-1 px-1 border-l border-slate-200 dark:border-slate-800 shrink-0">
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
      {currentTool !== 'laser' && (
        <div className="flex items-center gap-1 px-1 border-l border-slate-200 dark:border-slate-800 shrink-0">
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
      )}

      {/* Paper Style Selector */}
      <div className="flex items-center gap-1 px-1 border-l border-slate-200 dark:border-slate-800 relative shrink-0">
        <select
          value={paperStyle}
          onChange={(e) => onPaperStyleChange(e.target.value as PaperStyle)}
          className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg px-2 py-1.5 border border-slate-200 dark:border-slate-700 outline-none font-medium cursor-pointer"
          title="Cambiar tipo de papel de fondo"
          aria-label="Tipo de papel"
        >
          <option value="blank">Blanco Liso (Sin líneas)</option>
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
              <strong>Blanco Liso:</strong> Hoja limpia perfecta para dibujar, esquemas o escribir sin ninguna línea.<br />
              <strong>Líneas:</strong> Guía para mantener la escritura uniforme con el lápiz stylus.<br />
              <strong>Cuadrícula:</strong> Ideal para gráficos, geometría y diagramas técnicos.
            </p>
          </div>
        )}
      </div>

      {/* Tablet Stylus & Palm Rejection Controls */}
      <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-1 shrink-0">
        {isStylusDetected && (
          <span
            className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center gap-1 border border-blue-200/60 dark:border-blue-800/60"
            title="Lápiz stylus detectado y calibrado"
          >
            <Pen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Stylus Activo</span>
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            const next = !stylusOnlyMode;
            setStylusOnlyMode(next);
            if (next) setPalmRejection(true);
            if (typeof window !== 'undefined') {
              localStorage.setItem('notascribe_stylus_only', String(next));
            }
          }}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            stylusOnlyMode
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
          title={
            stylusOnlyMode
              ? 'Modo Solo Stylus ACTIVO: Solo dibuja el lápiz stylus. Puedes apoyar toda la mano en la pantalla sin problemas.'
              : 'Modo Lápiz + Dedo: Dibuja tanto con el lápiz como con los dedos.'
          }
          aria-label="Modo de lápiz"
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="hidden sm:inline">{stylusOnlyMode ? 'Solo Stylus (Mano apoyada)' : 'Lápiz + Dedo'}</span>
        </button>
      </div>

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-slate-800 pl-1 shrink-0">
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
        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 shrink-0"
        title="Borrar todo el lienzo"
        aria-label="Borrar lienzo"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Export Modal / Zen Fullscreen / Dock Selector */}
      <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-slate-800 pl-1 shrink-0">
        <button
          type="button"
          onClick={() => setIsExportModalOpen(true)}
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          title="Exportar imagen PNG o imprimir PDF"
          aria-label="Exportar"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden xl:inline text-xs font-semibold">Exportar</span>
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

        {/* Dock position toggle button */}
        {renderDockButton(false)}
      </div>
    </div>
  );

  const renderVerticalToolbar = (side: 'left' | 'right') => (
    <div
      className={`w-14 sm:w-16 h-full bg-white dark:bg-slate-900 ${
        side === 'left' ? 'border-r' : 'border-l'
      } border-slate-200 dark:border-slate-800 py-2.5 px-1 flex flex-col items-center justify-between gap-2 shrink-0 z-30 shadow-xs overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
    >
      {/* Top section: Dock changer + Pen tools */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Dock changer */}
        {renderDockButton(true, side)}

        <div className="w-8 h-px bg-slate-200 dark:bg-slate-800 my-1" />

        {/* Pen Tools in vertical column */}
        <div className="flex flex-col items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-full">
          <button
            type="button"
            onClick={() => setCurrentTool('pen')}
            className={`p-2 rounded-lg transition-all w-full flex justify-center ${
              currentTool === 'pen'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Bolígrafo de precisión"
            aria-label="Bolígrafo"
          >
            <Pen className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setCurrentTool('fountain')}
            className={`p-2 rounded-lg transition-all w-full flex justify-center ${
              currentTool === 'fountain'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Pluma caligráfica"
            aria-label="Pluma estilográfica"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentTool('highlighter');
              if (currentColor === '#0f172a') setCurrentColor('#facc15');
            }}
            className={`p-2 rounded-lg transition-all w-full flex justify-center ${
              currentTool === 'highlighter'
                ? 'bg-yellow-500 text-slate-900 shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Marcador fluorescente"
            aria-label="Resaltador"
          >
            <Highlighter className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setCurrentTool('brush')}
            className={`p-2 rounded-lg transition-all w-full flex justify-center ${
              currentTool === 'brush'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Pincel artístico"
            aria-label="Pincel"
          >
            <Brush className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setCurrentTool('laser')}
            className={`p-2 rounded-lg transition-all w-full flex justify-center ${
              currentTool === 'laser'
                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/50'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Puntero Láser (se desvanece a los 2s)"
            aria-label="Puntero Láser"
          >
            <Sparkles className="w-4 h-4 text-rose-300" />
          </button>

          <button
            type="button"
            onClick={() => setCurrentTool('eraser')}
            className={`p-2 rounded-lg transition-all w-full flex justify-center ${
              currentTool === 'eraser'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Borrador de trazos"
            aria-label="Borrador"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Color Palette (2 cols) */}
        {currentTool !== 'eraser' && currentTool !== 'laser' && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl my-1">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setCurrentColor(color)}
                className={`w-4 h-4 rounded-full transition-transform ${
                  currentColor === color ? 'scale-125 ring-2 ring-blue-500 ring-offset-1' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Color ${color}`}
              />
            ))}
          </div>
        )}

        {/* Stroke Sizes */}
        {currentTool !== 'laser' && (
          <div className="flex flex-col items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full">
            {STROKE_SIZES.map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setCurrentSize(sz)}
                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                  currentSize === sz
                    ? 'bg-blue-100 text-blue-700 font-bold dark:bg-blue-900/60 dark:text-blue-200'
                    : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title={`Grosor ${sz}px`}
                aria-label={`Grosor ${sz}px`}
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: Math.min(12, sz + 2), height: Math.min(12, sz + 2) }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Paper Style Popover Button */}
        <div className="relative my-1">
          <button
            type="button"
            onClick={() => setShowPaperMenuVertical(!showPaperMenuVertical)}
            className={`p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 ${
              showPaperMenuVertical ? 'bg-blue-100 text-blue-700' : ''
            }`}
            title="Cambiar tipo de papel (Blanco, Cuaderno, Cuadrícula...)"
            aria-label="Tipo de papel"
          >
            <FileText className="w-4 h-4" />
          </button>

          {showPaperMenuVertical && (
            <div
              className={`absolute ${
                side === 'left' ? 'left-full ml-2' : 'right-full mr-2'
              } top-0 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 text-xs`}
            >
              <div className="px-2 py-1 font-bold text-slate-400 text-[10px] uppercase">
                Fondo de Papel
              </div>
              {[
                { id: 'blank', label: 'Blanco Liso (Sin líneas)' },
                { id: 'ruled', label: 'Líneas de Cuaderno' },
                { id: 'grid', label: 'Cuadrícula' },
                { id: 'dots', label: 'Puntos (Bullet)' },
                { id: 'cornell', label: 'Método Cornell' },
                { id: 'dark_board', label: 'Pizarra Oscura' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onPaperStyleChange(opt.id as PaperStyle);
                    setShowPaperMenuVertical(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors ${
                    paperStyle === opt.id
                      ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stylus & Palm Rejection Mode */}
        <button
          type="button"
          onClick={() => {
            const next = !stylusOnlyMode;
            setStylusOnlyMode(next);
            if (next) setPalmRejection(true);
            if (typeof window !== 'undefined') {
              localStorage.setItem('notascribe_stylus_only', String(next));
            }
          }}
          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
            stylusOnlyMode
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
          title={
            stylusOnlyMode
              ? 'Solo Stylus ACTIVO: Solo dibuja el lápiz stylus. Puedes apoyar la mano en la pantalla.'
              : 'Modo Lápiz + Dedo'
          }
          aria-label="Modo Stylus"
        >
          <ShieldCheck className={`w-4 h-4 ${stylusOnlyMode ? 'text-white' : ''}`} />
        </button>
      </div>

      {/* Bottom section: Undo/Redo, Trash, Export, Zen */}
      <div className="flex flex-col items-center gap-1 w-full pt-1 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex <= 0 && strokes.length === 0}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
            title="Deshacer"
            aria-label="Deshacer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
            title="Rehacer"
            aria-label="Rehacer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleClear}
          disabled={strokes.length === 0}
          className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30"
          title="Borrar lienzo"
          aria-label="Borrar lienzo"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsExportModalOpen(true)}
          className="p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Exportar imagen PNG o imprimir PDF"
          aria-label="Exportar"
        >
          <Share2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsZenMode(!isZenMode)}
          className="p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          title={isZenMode ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-label="Pantalla completa"
        >
          {isZenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex ${
        toolbarPosition === 'left' || toolbarPosition === 'right' ? 'flex-row' : 'flex-col'
      } w-full h-full bg-slate-100 overflow-hidden select-none ${
        isZenMode ? 'fixed inset-0 z-50 bg-slate-900' : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Backdrop for closing popups */}
      {(showDockMenu || showPaperMenuVertical) && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => {
            setShowDockMenu(false);
            setShowPaperMenuVertical(false);
          }}
        />
      )}

      {/* Render toolbar according to selected position */}
      {toolbarPosition === 'left' && renderVerticalToolbar('left')}
      {toolbarPosition === 'top' && renderHorizontalToolbar()}
      {toolbarPosition === 'floating' && renderHorizontalToolbar()}

      {/* Main Canvas + Content Container */}
      <div className="flex-1 w-full h-full flex flex-col overflow-hidden relative">
        {/* Suggestions Bar (Hidden by default to give 100% clean paper area) */}
        {showWordSuggestions && toolbarPosition !== 'floating' && predictiveWords.length > 0 && (
          <div className="w-full bg-slate-50/95 dark:bg-slate-900/90 border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-1 flex items-center gap-1.5 shrink-0 z-20 overflow-x-auto [scrollbar-width:none]">
            <span className="text-[10px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-500" />
              Sugerencias:
            </span>
            {predictiveWords.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => handleInsertWord(word)}
                className="px-2.5 py-0.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 rounded-full text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70 transition-colors shrink-0"
                title={`Insertar "${word}"`}
              >
                {word}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowWordSuggestions(false)}
              className="ml-auto p-1 text-slate-400 hover:text-slate-600 text-xs font-bold"
              title="Cerrar sugerencias"
            >
              ✕
            </button>
          </div>
        )}

        {/* Floating suggestions bar if toolbar is floating */}
        {showWordSuggestions && toolbarPosition === 'floating' && predictiveWords.length > 0 && (
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
            <button
              type="button"
              onClick={() => setShowWordSuggestions(false)}
              className="ml-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        )}

        {/* Canvas Drawing Area with full gesture isolation */}
        <div className="flex-1 w-full h-full overflow-auto relative touch-none select-none">
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
          onLostPointerCapture={handlePointerUp}
          className="block mx-auto cursor-crosshair shadow-md touch-none"
        />

        {/* Palm Rest Shield overlay for comfortable hand resting */}
        {showPalmShield && (
          <div
            className="absolute bottom-0 left-0 right-0 h-48 bg-slate-400/10 border-t-2 border-dashed border-slate-300 backdrop-blur-xs flex items-center justify-between px-6 z-20 pointer-events-auto"
            style={{ touchAction: 'none' }}
          >
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Zona de descanso de muñeca activa (los toques aquí no dibujan)
            </span>
            <button
              type="button"
              onClick={() => setShowPalmShield(false)}
              className="px-3 py-1 bg-white text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold shadow-xs border border-slate-200"
            >
              Ocultar zona
            </button>
          </div>
        )}
      </div>

      {/* Multipage Notebook Navigator Bar (Bottom Center) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-2 text-xs select-none">
        <button
          type="button"
          onClick={() => onPageChange?.(Math.max(0, currentPageIndex - 1))}
          disabled={currentPageIndex <= 0}
          className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Página anterior"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="font-bold text-slate-800 dark:text-slate-100 text-xs px-1">
          Hoja {currentPageIndex + 1} de {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange?.(Math.min(totalPages - 1, currentPageIndex + 1))}
          disabled={currentPageIndex >= totalPages - 1}
          className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Página siguiente"
          aria-label="Página siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={onAddPage}
          className="px-2 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 rounded-lg font-semibold flex items-center gap-1 transition-colors"
          title="Agregar nueva página al cuaderno"
          aria-label="Nueva Hoja"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva Hoja</span>
        </button>

        {totalPages > 1 && (
          <button
            type="button"
            onClick={() => onDeletePage?.(currentPageIndex)}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Eliminar esta hoja"
            aria-label="Eliminar hoja"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating OCR Recognition Bar */}
      <div className="absolute bottom-16 sm:bottom-4 left-3 sm:left-4 z-20 max-w-[280px] sm:max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden transition-all duration-200">
        <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Texto Detectado (OCR)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => triggerHandwritingRecognition()}
              disabled={isRecognizing || strokes.length === 0}
              className="px-2 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md text-[11px] font-semibold disabled:opacity-40 transition-colors"
            >
              {isRecognizing ? 'Analizando...' : 'Reconocer'}
            </button>
            <button
              type="button"
              onClick={() => setIsOcrBarExpanded(!isOcrBarExpanded)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              aria-label={isOcrBarExpanded ? 'Colapsar barra OCR' : 'Expandir barra OCR'}
            >
              {isOcrBarExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {isOcrBarExpanded && (
          <div className="p-3 text-xs space-y-2">
            {recognizedText ? (
              <>
                <p className="text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 max-h-32 overflow-y-auto leading-relaxed">
                  {recognizedText}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onInsertTextIntoNote(recognizedText)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-[11px] flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" /> Insertar en Nota
                  </button>
                  {onConvertToTasks && (
                    <button
                      type="button"
                      onClick={() => onConvertToTasks(recognizedText)}
                      className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg font-medium text-[11px] flex items-center gap-1"
                    >
                      <ListPlus className="w-3 h-3" /> Crear Tareas
                    </button>
                  )}
                  {onConvertToConceptMap && (
                    <button
                      type="button"
                      onClick={() => onConvertToConceptMap(recognizedText)}
                      className="px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg font-medium text-[11px] flex items-center gap-1"
                    >
                      <Network className="w-3 h-3" /> Crear Diagrama
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="p-1 text-slate-500 hover:text-slate-800 rounded-md"
                    title="Copiar texto"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                Escribe en el lienzo con el lápiz para reconocer el texto automáticamente...
              </p>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Right-docked vertical toolbar if selected */}
      {toolbarPosition === 'right' && renderVerticalToolbar('right')}

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={noteTitle}
        canvasElement={canvasRef.current}
        textContent={noteContent || recognizedText}
      />
    </div>
  );
};
