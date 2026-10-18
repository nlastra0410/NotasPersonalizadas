import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ConceptGraph,
  ConceptNode,
  ConceptEdge,
  NodeShape,
  Stroke,
  Point,
} from '../types';
import {
  calculateBoundingBox,
  calculatePathLength,
  detectGeometricShapeDetailed,
  detectConnectingArrow,
  isPointInsideNode,
  isPointNearNode,
} from '../utils/smartDiagramRecognizer';
import { purgeOrphanEdges, autoLayoutNodes, graphToMarkdown } from '../utils/conceptMap';
import { recognizeHandwritingInstant } from '../utils/instantHandwritingRecognizer';
import {
  Sparkles,
  RotateCcw,
  Trash2,
  Share2,
  FileText,
  Grid,
  Pen,
  Eraser,
  Move,
  Type,
  Maximize2,
  Download,
  Info,
  Zap,
} from 'lucide-react';

interface FloatingTextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

interface SmartDiagramStudioProps {
  initialGraph?: ConceptGraph;
  noteTitle: string;
  onSaveGraph: (graph: ConceptGraph) => void;
  onExportToNoteContent?: (markdownText: string) => void;
  onOpenInFullDiagramsTab?: (graph: ConceptGraph) => void;
}

const INK_COLORS = [
  { name: 'Azul', value: '#2563eb' },
  { name: 'Esmeralda', value: '#059669' },
  { name: 'Púrpura', value: '#7c3aed' },
  { name: 'Ámbar', value: '#d97706' },
  { name: 'Rojo', value: '#dc2626' },
  { name: 'Negro', value: '#0f172a' },
];

export const SmartDiagramStudio: React.FC<SmartDiagramStudioProps> = ({
  initialGraph,
  noteTitle,
  onSaveGraph,
  onExportToNoteContent,
  onOpenInFullDiagramsTab,
}) => {
  // Graph State: Nodes and Edges
  const [graph, setGraph] = useState<ConceptGraph>(() => {
    if (initialGraph && initialGraph.nodes && initialGraph.nodes.length > 0) {
      return initialGraph;
    }
    return {
      id: `diag-${Date.now()}`,
      title: noteTitle || 'Lienzo Predictivo',
      diagramType: 'flowchart',
      nodes: [],
      edges: [],
    };
  });

  // Floating text blocks created by writing with the pencil
  const [floatingTexts, setFloatingTexts] = useState<FloatingTextItem[]>([]);

  // History for Undo
  const [history, setHistory] = useState<{ graph: ConceptGraph; texts: FloatingTextItem[] }[]>([
    { graph, texts: [] },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Active Tool: 'pen' (Predictive: auto shapes, auto arrows, auto handwriting to text), 'eraser', 'select'
  const [tool, setTool] = useState<'pen' | 'eraser' | 'select'>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#2563eb');
  const [strokeSize, setStrokeSize] = useState<number>(3);
  const [predictionSpeed, setPredictionSpeed] = useState<number>(120); // 120ms ultra-fast instant speed

  // Active Selection & Dragging
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Direct In-Place Text Editing (Double-click or tap to edit with keyboard)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [tempEditText, setTempEditText] = useState<string>('');

  // Live Drawing Canvas & Active Ink Clustering
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const currentPointsRef = useRef<Point[]>([]);

  // Predictive Handwriting Ink Cluster: collects strokes while writing words
  const pendingInkStrokesRef = useRef<Stroke[]>([]);
  const handwritingDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isRecognizingText, setIsRecognizingText] = useState<boolean>(false);

  // Visual Toast Feedback
  const [toast, setToast] = useState<{ message: string; sub?: string } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, sub?: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, sub });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

  // Push to history
  const commitSnapshot = useCallback(
    (newGraph: ConceptGraph, newTexts: FloatingTextItem[]) => {
      const cleanEdges = purgeOrphanEdges(newGraph.nodes, newGraph.edges);
      const cleanedGraph = { ...newGraph, edges: cleanEdges };

      setGraph(cleanedGraph);
      setFloatingTexts(newTexts);
      onSaveGraph(cleanedGraph);

      const nextHist = history.slice(0, historyIndex + 1);
      nextHist.push({ graph: cleanedGraph, texts: newTexts });
      if (nextHist.length > 25) nextHist.shift();
      setHistory(nextHist);
      setHistoryIndex(nextHist.length - 1);
    },
    [history, historyIndex, onSaveGraph]
  );

  const handleUndo = useCallback(() => {
    // 1. If user is in the middle of writing pending strokes, remove the last stroke
    if (pendingInkStrokesRef.current.length > 0) {
      if (handwritingDebounceTimerRef.current) {
        clearTimeout(handwritingDebounceTimerRef.current);
        handwritingDebounceTimerRef.current = null;
      }
      pendingInkStrokesRef.current.pop();
      redrawInkOverlay();
      showToast('Trazo deshecho');
      return;
    }

    // 2. Undo from snapshot history
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setGraph(prev.graph);
      setFloatingTexts(prev.texts);
      setHistoryIndex(historyIndex - 1);
      onSaveGraph(prev.graph);
      showToast('Deshecho');
      return;
    }

    // 3. Fallback: if at history 0 but items exist, remove the last item
    if (floatingTexts.length > 0) {
      const nextTexts = floatingTexts.slice(0, -1);
      setFloatingTexts(nextTexts);
      showToast('Texto deshecho');
    } else if (graph.nodes.length > 0) {
      const nextNodes = graph.nodes.slice(0, -1);
      const nextEdges = purgeOrphanEdges(nextNodes, graph.edges);
      const nextGraph = { ...graph, nodes: nextNodes, edges: nextEdges };
      setGraph(nextGraph);
      onSaveGraph(nextGraph);
      showToast('Figura deshecha');
    }
  }, [history, historyIndex, graph, floatingTexts, onSaveGraph]);

  // Listen to global undo event from NoteEditorView
  useEffect(() => {
    const onGlobalUndo = () => {
      handleUndo();
    };
    window.addEventListener('notascribe:undo_smart_diagram', onGlobalUndo);
    return () => {
      window.removeEventListener('notascribe:undo_smart_diagram', onGlobalUndo);
    };
  }, [handleUndo]);

  // Redraw the in-progress canvas ink (user strokes)
  const redrawInkOverlay = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render pending handwriting strokes while user is writing
    for (const stroke of pendingInkStrokesRef.current) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }

    // Render current active stroke being drawn
    if (currentPointsRef.current.length >= 2) {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = strokeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(currentPointsRef.current[0].x, currentPointsRef.current[0].y);
      for (let i = 1; i < currentPointsRef.current.length; i++) {
        ctx.lineTo(currentPointsRef.current[i].x, currentPointsRef.current[i].y);
      }
      ctx.stroke();
    }
  };

  // Convert client coordinate to local container coordinates
  const getLocalCoords = (clientX: number, clientY: number): Point => {
    if (!containerRef.current) return { x: clientX, y: clientY };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // Process completed cluster of handwriting strokes into digital keyboard text INSTANTLY (< 2ms)
  const processHandwritingCluster = () => {
    const strokes = [...pendingInkStrokesRef.current];
    pendingInkStrokesRef.current = [];
    redrawInkOverlay();

    if (strokes.length === 0) return;

    // Calculate cluster bounding box
    const allPoints = strokes.flatMap((s) => s.points);
    const bbox = calculateBoundingBox(allPoints);

    // Check if the writing occurred inside an existing shape
    const targetNode = graph.nodes.find((n) => isPointInsideNode(allPoints[0], n));

    // 1. INSTANT LOCAL CONVERSION (0ms!)
    const instantWord = recognizeHandwritingInstant(strokes, targetNode ? 'node' : 'canvas');
    const createdId = `text-${Date.now()}`;
    applyRecognizedDigitalText(instantWord, bbox, targetNode, createdId);

    // 2. NON-BLOCKING ASYNC AI BACKGROUND REFINEMENT
    // Does not block the UI for a single millisecond
    try {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = Math.max(120, Math.round(bbox.width + 40));
      offCanvas.height = Math.max(70, Math.round(bbox.height + 40));
      const ctx = offCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const stroke of strokes) {
          if (stroke.points.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x - bbox.minX + 20, stroke.points[0].y - bbox.minY + 20);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x - bbox.minX + 20, stroke.points[i].y - bbox.minY + 20);
          }
          ctx.stroke();
        }

        const base64 = offCanvas.toDataURL('image/png');
        fetch('/api/recognize-handwriting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mode: 'word' }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data || !data.text) return;
            const refined = data.text.trim().split('\n')[0];
            if (refined && !refined.startsWith('Nota manuscrita') && refined !== instantWord) {
              if (targetNode) {
                setGraph((prev) => ({
                  ...prev,
                  nodes: prev.nodes.map((n) => (n.id === targetNode.id ? { ...n, label: refined } : n)),
                }));
              } else {
                setFloatingTexts((prev) =>
                  prev.map((t) => (t.id === createdId ? { ...t, text: refined } : t))
                );
              }
            }
          })
          .catch(() => {});
      }
    } catch {}
  };

  const applyRecognizedDigitalText = (
    word: string,
    bbox: any,
    targetNode?: ConceptNode,
    createdId?: string
  ) => {
    if (targetNode) {
      // Update the node's digital label
      const updatedNodes = graph.nodes.map((n) =>
        n.id === targetNode.id
          ? {
              ...n,
              label: n.label && n.label !== 'Elemento' && n.label !== 'Nuevo' && n.label !== 'Círculo' && n.label !== 'Rectángulo'
                ? `${n.label} ${word}`
                : word,
            }
          : n
      );
      commitSnapshot({ ...graph, nodes: updatedNodes }, floatingTexts);
      showToast(`¡Texto en figura! "${word}"`);
    } else {
      // Place a new digital text block right where written
      const newText: FloatingTextItem = {
        id: createdId || `text-${Date.now()}`,
        text: word,
        x: Math.round(bbox.minX),
        y: Math.round(bbox.minY),
        fontSize: Math.max(14, Math.min(26, Math.round(bbox.height * 0.75))),
        color: currentColor,
      };
      commitSnapshot(graph, [...floatingTexts, newText]);
      showToast(`¡Palabra digitalizada! "${word}"`);
    }
  };

  // Pointer event handlers for drawing and predictive recognition
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'select') return;
    if (e.button !== 0) return;

    if (tool === 'eraser') {
      const pt = getLocalCoords(e.clientX, e.clientY);
      const clickedNode = graph.nodes.find((n) => isPointInsideNode(pt, n) || isPointNearNode(pt, n, 20));
      if (clickedNode) {
        const updatedNodes = graph.nodes.filter((n) => n.id !== clickedNode.id);
        const updatedEdges = purgeOrphanEdges(updatedNodes, graph.edges);
        commitSnapshot({ ...graph, nodes: updatedNodes, edges: updatedEdges }, floatingTexts);
        showToast('Figura borrada');
        return;
      }
      const clickedText = floatingTexts.find((t) => Math.hypot(t.x - pt.x, t.y - pt.y) < 45);
      if (clickedText) {
        commitSnapshot(graph, floatingTexts.filter((t) => t.id !== clickedText.id));
        showToast('Texto borrado');
        return;
      }
      return;
    }

    isDrawingRef.current = true;
    const pt = getLocalCoords(e.clientX, e.clientY);
    currentPointsRef.current = [pt];

    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const pt = getLocalCoords(e.clientX, e.clientY);
    currentPointsRef.current.push(pt);
    redrawInkOverlay();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    }

    const points = currentPointsRef.current;
    currentPointsRef.current = [];

    if (points.length < 3) {
      redrawInkOverlay();
      return;
    }

    const bbox = calculateBoundingBox(points);
    const pathLength = calculatePathLength(points);
    const distStartEnd = Math.hypot(
      points[points.length - 1].x - points[0].x,
      points[points.length - 1].y - points[0].y
    );

    // 1. PREDICTIVE ARROW / CONNECTOR CHECK
    // If the stroke connects two existing shapes:
    const arrow = detectConnectingArrow(points, graph.nodes);
    if (arrow) {
      // If there were pending handwriting strokes, clear them
      pendingInkStrokesRef.current = [];
      redrawInkOverlay();

      const exists = graph.edges.some(
        (ed) => ed.sourceId === arrow.sourceId && ed.targetId === arrow.targetId
      );

      if (!exists) {
        const newEdge: ConceptEdge = {
          id: `edge-${Date.now()}`,
          sourceId: arrow.sourceId,
          targetId: arrow.targetId,
          label: '',
        };
        commitSnapshot({ ...graph, edges: [...graph.edges, newEdge] }, floatingTexts);
        showToast(
          `¡Flecha digitalizada!`,
          `${arrow.sourceNode.label || 'Figura'} ➔ ${arrow.targetNode.label || 'Figura'}`
        );
      } else {
        showToast('Las figuras ya estaban unidas con flecha');
      }
      return;
    }

    // 2. PREDICTIVE GEOMETRIC SHAPE CHECK
    // A closed loop with substantial size -> Perfect digitized geometric shape
    const isClosedLoop = distStartEnd < pathLength * 0.42 && bbox.width >= 35 && bbox.height >= 35;
    if (isClosedLoop) {
      const shapeResult = detectGeometricShapeDetailed(points);
      const recognizedShape: NodeShape = shapeResult ? shapeResult.shape : 'rectangle';

      // Clear any pending handwriting strokes
      pendingInkStrokesRef.current = [];
      redrawInkOverlay();

      // Create perfect digitized node
      const newNode: ConceptNode = {
        id: `node-${Date.now()}`,
        label:
          recognizedShape === 'circle'
            ? 'Círculo'
            : recognizedShape === 'diamond'
            ? 'Decisión'
            : recognizedShape === 'triangle'
            ? 'Triángulo'
            : recognizedShape === 'cylinder'
            ? 'Base de Datos'
            : 'Rectángulo',
        x: Math.round(bbox.cx),
        y: Math.round(bbox.cy),
        color: currentColor,
        shape: recognizedShape,
        width: Math.max(120, Math.round(bbox.width)),
        height: Math.max(60, Math.round(bbox.height)),
      };

      commitSnapshot({ ...graph, nodes: [...graph.nodes, newNode] }, floatingTexts);
      setSelectedNodeId(newNode.id);
      showToast(
        `¡Figura perfecta digitalizada!`,
        `${recognizedShape === 'circle' ? 'Círculo' : recognizedShape === 'diamond' ? 'Rombo' : recognizedShape === 'triangle' ? 'Triángulo' : recognizedShape === 'cylinder' ? 'Cilindro' : 'Rectángulo'} vectorizado`
      );
      return;
    }

    // 3. PREDICTIVE HANDWRITING TO TEXT CHECK
    // The stroke is neither a closed shape nor a connector between shapes:
    // It is handwriting!
    const newStroke: Stroke = {
      id: `stroke-${Date.now()}`,
      points,
      tool: 'pen',
      color: currentColor,
      size: strokeSize,
      opacity: 1,
      timestamp: Date.now(),
    };

    pendingInkStrokesRef.current.push(newStroke);
    redrawInkOverlay();

    // Reset handwriting cluster debounce timer (200ms ultra-fast speed)
    if (handwritingDebounceTimerRef.current) {
      clearTimeout(handwritingDebounceTimerRef.current);
    }
    handwritingDebounceTimerRef.current = setTimeout(() => {
      processHandwritingCluster();
    }, predictionSpeed);
  };

  // Node Dragging handlers
  const handleNodePointerDown = (e: React.PointerEvent, node: ConceptNode) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setSelectedTextId(null);

    const pt = getLocalCoords(e.clientX, e.clientY);
    setDraggingNodeId(node.id);
    setDragOffset({
      x: pt.x - node.x,
      y: pt.y - node.y,
    });
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (draggingNodeId) {
      const pt = getLocalCoords(e.clientX, e.clientY);
      const newX = Math.round(pt.x - dragOffset.x);
      const newY = Math.round(pt.y - dragOffset.y);

      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n
        ),
      }));
    }
  };

  const handleContainerPointerUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
      commitSnapshot(graph, floatingTexts);
    }
  };

  // Node text editing
  const startEditingNodeText = (node: ConceptNode) => {
    setEditingNodeId(node.id);
    setTempEditText(node.label);
  };

  const saveEditingNodeText = () => {
    if (!editingNodeId) return;
    const updated = graph.nodes.map((n) =>
      n.id === editingNodeId ? { ...n, label: tempEditText.trim() || n.label } : n
    );
    commitSnapshot({ ...graph, nodes: updated }, floatingTexts);
    setEditingNodeId(null);
  };

  // Floating text editing
  const startEditingFloatingText = (textItem: FloatingTextItem) => {
    setEditingTextId(textItem.id);
    setTempEditText(textItem.text);
  };

  const saveEditingFloatingText = () => {
    if (!editingTextId) return;
    const updated = floatingTexts.map((t) =>
      t.id === editingTextId ? { ...t, text: tempEditText.trim() || t.text } : t
    );
    commitSnapshot(graph, updated);
    setEditingTextId(null);
  };

  // Delete selection
  const deleteSelected = () => {
    if (selectedNodeId) {
      const updatedNodes = graph.nodes.filter((n) => n.id !== selectedNodeId);
      const updatedEdges = purgeOrphanEdges(updatedNodes, graph.edges);
      commitSnapshot({ ...graph, nodes: updatedNodes, edges: updatedEdges }, floatingTexts);
      setSelectedNodeId(null);
      showToast('Figura eliminada');
    } else if (selectedEdgeId) {
      const updatedEdges = graph.edges.filter((e) => e.id !== selectedEdgeId);
      commitSnapshot({ ...graph, edges: updatedEdges }, floatingTexts);
      setSelectedEdgeId(null);
      showToast('Flecha eliminada');
    } else if (selectedTextId) {
      const updatedTexts = floatingTexts.filter((t) => t.id !== selectedTextId);
      commitSnapshot(graph, updatedTexts);
      setSelectedTextId(null);
      showToast('Texto eliminado');
    }
  };

  // Clear All Canvas contents with instant Undo support
  const handleClearAll = () => {
    if (graph.nodes.length === 0 && floatingTexts.length === 0 && pendingInkStrokesRef.current.length === 0) {
      showToast('El lienzo ya está vacío');
      return;
    }

    pendingInkStrokesRef.current = [];
    currentPointsRef.current = [];
    if (handwritingDebounceTimerRef.current) {
      clearTimeout(handwritingDebounceTimerRef.current);
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    commitSnapshot({ ...graph, nodes: [], edges: [] }, []);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelectedTextId(null);
    showToast('Lienzo borrado por completo', 'Pulsa Deshacer (↩) si deseas recuperarlo');
  };

  // Sync canvas size
  useEffect(() => {
    const updateSize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redrawInkOverlay();
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden relative select-none">
      {/* Predictive Canvas Header Toolbar */}
      <div className="h-11 px-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 z-30 shrink-0 shadow-xs">
        {/* Left: Pen, Eraser, Move */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTool('pen')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              tool === 'pen'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Lápiz Predictivo: escribe palabras para convertirlas a texto, dibuja figuras o une con flechas"
          >
            <Pen className="w-3.5 h-3.5" />
            <span>Lápiz Predictivo</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          <button
            type="button"
            onClick={() => setTool('eraser')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
              tool === 'eraser'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Borrador: toca cualquier figura o texto para eliminarlo"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Borrador</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('select')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
              tool === 'select'
                ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Mover figuras y texto"
          >
            <Move className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mover</span>
          </button>

          {/* Color palette for the pen */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-2 shrink-0">
            {INK_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setCurrentColor(c.value);
                  if (selectedNodeId) {
                    const updated = graph.nodes.map((n) =>
                      n.id === selectedNodeId ? { ...n, color: c.value } : n
                    );
                    commitSnapshot({ ...graph, nodes: updated }, floatingTexts);
                  }
                }}
                className={`w-5 h-5 rounded-full transition-transform ${
                  currentColor === c.value
                    ? 'scale-125 ring-2 ring-offset-2 ring-blue-500'
                    : 'hover:scale-110 opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Center: Recognition speed toggle & status */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = predictionSpeed === 120 ? 250 : 120;
              setPredictionSpeed(next);
              showToast(`Velocidad predictiva: ${next === 120 ? '⚡ Instantáneo (120ms)' : '⏱️ Rápido (250ms)'}`);
            }}
            className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 text-[11px] font-bold flex items-center gap-1 transition-all shadow-2xs"
            title="Pulsa para alternar la velocidad predictiva (120ms ultra-rápido instantáneo)"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>{predictionSpeed === 120 ? '⚡ Instantáneo (120ms)' : '⏱️ Rápido (250ms)'}</span>
          </button>

          <span className="text-[11px] text-slate-400 hidden xl:inline">
            Figuras y flechas instantáneas (0ms)
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Auto Layout */}
          <button
            type="button"
            onClick={() => {
              const organized = autoLayoutNodes(graph.nodes, 400, 260, 210);
              commitSnapshot({ ...graph, nodes: organized }, floatingTexts);
              showToast('Diagrama organizado');
            }}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Auto-organizar diagrama simétricamente"
          >
            <Grid className="w-3.5 h-3.5 text-blue-500" />
          </button>

          {/* Flecha de Volver Atrás / Deshacer */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={
              historyIndex <= 0 &&
              graph.nodes.length === 0 &&
              floatingTexts.length === 0 &&
              pendingInkStrokesRef.current.length === 0
            }
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            title="Volver atrás / Deshacer última figura, flecha o palabra puesta por error"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Deshacer</span>
          </button>

          {/* Delete selected */}
          {(selectedNodeId || selectedEdgeId || selectedTextId) && (
            <button
              type="button"
              onClick={deleteSelected}
              className="p-1.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 hover:bg-red-100 transition-colors"
              title="Eliminar elemento seleccionado"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Botón Borrar Todo */}
          <button
            type="button"
            onClick={handleClearAll}
            className="px-2.5 py-1.5 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 transition-all flex items-center gap-1.5 text-xs font-bold border border-red-200 dark:border-red-900/80 active:scale-95 shadow-2xs"
            title="Borrar todo el contenido del lienzo predictivo (figuras, flechas y texto)"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Borrar Todo</span>
          </button>

          {/* Export to Note Content */}
          {onExportToNoteContent && (
            <button
              type="button"
              onClick={() => {
                const md = graphToMarkdown(graph);
                onExportToNoteContent(md);
                showToast('¡Diagrama insertado en la nota!');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-semibold flex items-center gap-1 hover:bg-blue-100 transition-colors"
              title="Insertar esquema y relaciones en el texto de la nota"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">A la Nota</span>
            </button>
          )}

          {/* Transfer to Concept Maps Tab */}
          {onOpenInFullDiagramsTab && (
            <button
              type="button"
              onClick={() => onOpenInFullDiagramsTab(graph)}
              className="px-2.5 py-1.5 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300 text-xs font-semibold flex items-center gap-1 hover:bg-purple-100 transition-colors"
              title="Abrir este diagrama en la pestaña global Diagramas & Mapas"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">En Diagramas</span>
            </button>
          )}
        </div>
      </div>

      {/* Predictive Instructions Banner */}
      <div className="px-4 py-1.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-purple-50/80 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 border-b border-blue-100/60 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none]">
          <span className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Lienzo Predictivo Activo:
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">1</span>
            Escribe palabras con el lápiz y se transforman en <strong>texto de teclado</strong>.
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="flex items-center gap-1 shrink-0">
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">2</span>
            Dibuja cuadros, círculos o figuras y se convierten en <strong>figuras perfectas</strong>.
          </span>
          <span className="text-slate-300 hidden md:inline">•</span>
          <span className="flex items-center gap-1 shrink-0">
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">3</span>
            Traza flechas o líneas para <strong>unirlas digitalmente</strong>.
          </span>
        </div>

        <div className="text-[10px] text-slate-400 font-medium shrink-0">
          {graph.nodes.length} figuras • {graph.edges.length} flechas • {floatingTexts.length} textos
        </div>
      </div>

      {/* Main Interactive Drawing & Diagram Surface */}
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        className="flex-1 w-full h-full relative overflow-hidden bg-white dark:bg-slate-950 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] touch-none cursor-crosshair"
      >
        {/* SVG Layer for Digitized Connections (Edges) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <marker
              id="pred-arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
            </marker>
            <marker
              id="pred-arrowhead-selected"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />
            </marker>
          </defs>

          {graph.edges.map((edge) => {
            const sourceNode = graph.nodes.find((n) => n.id === edge.sourceId);
            const targetNode = graph.nodes.find((n) => n.id === edge.targetId);
            if (!sourceNode || !targetNode) return null;

            const isSelected = selectedEdgeId === edge.id;
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const angle = Math.atan2(dy, dx);

            const sourceRadius = Math.min(sourceNode.width || 140, sourceNode.height || 70) / 2;
            const targetRadius = Math.min(targetNode.width || 140, targetNode.height || 70) / 2;

            const startX = sourceNode.x + Math.cos(angle) * sourceRadius;
            const startY = sourceNode.y + Math.sin(angle) * sourceRadius;
            const endX = targetNode.x - Math.cos(angle) * targetRadius;
            const endY = targetNode.y - Math.sin(angle) * targetRadius;

            // Curved line
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const ctrlX = midX - Math.sin(angle) * 12;
            const ctrlY = midY + Math.cos(angle) * 12;

            return (
              <g key={edge.id} className="pointer-events-auto cursor-pointer">
                <path
                  d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
                  fill="none"
                  stroke={isSelected ? '#2563eb' : '#64748b'}
                  strokeWidth={isSelected ? '3.5' : '2.5'}
                  markerEnd={`url(#${isSelected ? 'pred-arrowhead-selected' : 'pred-arrowhead'})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                    setSelectedTextId(null);
                  }}
                  className="transition-colors hover:stroke-blue-500"
                />
                {edge.label && (
                  <text
                    x={ctrlX}
                    y={ctrlY - 8}
                    textAnchor="middle"
                    fill={isSelected ? '#2563eb' : '#64748b'}
                    fontSize="11"
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* HTML / React Digitized Nodes Layer (Perfect Shapes) */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {graph.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const nodeW = node.width || 140;
            const nodeH = node.height || 70;
            const shape = node.shape || 'rectangle';

            return (
              <div
                key={node.id}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                onDoubleClick={() => startEditingNodeText(node)}
                className={`absolute pointer-events-auto cursor-move transition-shadow flex items-center justify-center p-3 select-none ${
                  isSelected ? 'ring-4 ring-blue-500/50 shadow-xl' : 'shadow-md hover:shadow-lg'
                } bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm`}
                style={{
                  left: `${node.x - nodeW / 2}px`,
                  top: `${node.y - nodeH / 2}px`,
                  width: `${nodeW}px`,
                  height: `${nodeH}px`,
                  borderColor: node.color,
                  borderWidth: '2.5px',
                  borderRadius:
                    shape === 'circle'
                      ? '9999px'
                      : shape === 'diamond'
                      ? '12px'
                      : shape === 'cylinder'
                      ? '26px'
                      : shape === 'rounded'
                      ? '16px'
                      : '8px',
                  transform: shape === 'diamond' ? 'rotate(45deg)' : 'none',
                }}
              >
                {/* Node Digital Typography / Keyboard Text Content */}
                <div
                  className={`w-full h-full flex flex-col items-center justify-center text-center p-1 overflow-hidden ${
                    shape === 'diamond' ? '-rotate-45' : ''
                  }`}
                >
                  {editingNodeId === node.id ? (
                    <input
                      type="text"
                      value={tempEditText}
                      onChange={(e) => setTempEditText(e.target.value)}
                      onBlur={saveEditingNodeText}
                      onKeyDown={(e) => e.key === 'Enter' && saveEditingNodeText()}
                      autoFocus
                      className="w-full text-center text-xs font-bold bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 py-0.5 focus:outline-none"
                    />
                  ) : (
                    <>
                      <div
                        className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate w-full"
                        style={{ color: node.color }}
                      >
                        {node.label}
                      </div>
                      {node.description && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full mt-0.5">
                          {node.description}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Connection points on selected shape */}
                {isSelected && (
                  <>
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-500 ring-2 ring-white" />
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-500 ring-2 ring-white" />
                    <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 ring-2 ring-white" />
                    <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 ring-2 ring-white" />
                  </>
                )}
              </div>
            );
          })}

          {/* Floating Digitized Text Blocks (written anywhere on the canvas) */}
          {floatingTexts.map((item) => {
            const isSelected = selectedTextId === item.id;
            return (
              <div
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTextId(item.id);
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
                onDoubleClick={() => startEditingFloatingText(item)}
                className={`absolute pointer-events-auto cursor-pointer p-1 rounded-md transition-all ${
                  isSelected ? 'ring-2 ring-blue-500 bg-blue-50/80 dark:bg-blue-950/60' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
                style={{
                  left: `${item.x}px`,
                  top: `${item.y}px`,
                  color: item.color,
                  fontSize: `${item.fontSize}px`,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: 600,
                }}
              >
                {editingTextId === item.id ? (
                  <input
                    type="text"
                    value={tempEditText}
                    onChange={(e) => setTempEditText(e.target.value)}
                    onBlur={saveEditingFloatingText}
                    onKeyDown={(e) => e.key === 'Enter' && saveEditingFloatingText()}
                    autoFocus
                    className="text-xs font-bold bg-white dark:bg-slate-800 border border-blue-500 rounded px-1.5 py-0.5 focus:outline-none"
                  />
                ) : (
                  <span>{item.text}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Live Drawing Canvas for Natural Pen/Stylus Input */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`absolute inset-0 w-full h-full z-20 ${
            tool === 'select' ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
          style={{ touchAction: 'none' }}
        />

        {/* Floating Toast Feedback for Transformation */}
        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl bg-slate-900/95 text-white text-xs shadow-xl backdrop-blur-md flex items-center gap-2.5 animate-bounce border border-slate-700">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-slate-100">{toast.message}</div>
              {toast.sub && <div className="text-[10px] text-slate-400">{toast.sub}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
