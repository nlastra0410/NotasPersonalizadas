import React, { useState, useRef, useEffect } from 'react';
import { ConceptGraph, ConceptNode, ConceptEdge, NodeShape, DiagramType } from '../types';
import { autoLayoutNodes, purgeOrphanEdges, graphToMarkdown } from '../utils/conceptMap';
import {
  Plus,
  Sparkles,
  Trash2,
  Check,
  Copy,
  Edit2,
  Link as LinkIcon,
  RotateCcw,
  Square,
  Circle,
  Diamond,
  Database,
  Cloud,
  Layers,
  ArrowRight,
  GitBranch,
  Server,
  Workflow,
} from 'lucide-react';

interface ConceptMapCanvasProps {
  graph: ConceptGraph;
  onGraphChange: (graph: ConceptGraph) => void;
  currentNoteText?: string;
  onExportToNote?: (markdownOutline: string) => void;
}

const NODE_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#64748b', // Slate
];

export const ConceptMapCanvas: React.FC<ConceptMapCanvasProps> = ({
  graph,
  onGraphChange,
  currentNoteText,
  onExportToNote,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Diagram type (mindmap, flowchart, architecture)
  const currentDiagramType: DiagramType = graph.diagramType || 'flowchart';

  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Connection creation mode
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);

  // Selected node for editing
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // AI generation loading
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedOutline, setCopiedOutline] = useState<boolean>(false);

  // Canvas pan & zoom
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Edge relationship editing
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Auto clean orphan edges on mount or graph update
  useEffect(() => {
    const cleanEdges = purgeOrphanEdges(graph.nodes, graph.edges);
    if (cleanEdges.length !== graph.edges.length) {
      onGraphChange({ ...graph, edges: cleanEdges });
    }
  }, [graph.nodes, graph.edges]);

  // Handle pointer down on a node to drag
  const handleNodePointerDown = (e: React.PointerEvent, node: ConceptNode) => {
    e.stopPropagation();

    // If we're in connecting mode, click to create connection
    if (connectingSourceId) {
      if (connectingSourceId !== node.id) {
        const defaultLabel =
          currentDiagramType === 'flowchart'
            ? 'siguiente'
            : currentDiagramType === 'architecture'
            ? 'conecta con'
            : 'se relaciona con';

        const newEdge: ConceptEdge = {
          id: `edge-${Date.now()}`,
          sourceId: connectingSourceId,
          targetId: node.id,
          label: defaultLabel,
        };
        onGraphChange({
          ...graph,
          edges: [...graph.edges, newEdge],
        });
      }
      setConnectingSourceId(null);
      return;
    }

    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);
    setDragOffset({
      x: e.clientX / zoom - node.x,
      y: e.clientY / zoom - node.y,
    });
  };

  // Dragging nodes or panning container
  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingNodeId) {
      const newX = Math.round(e.clientX / zoom - dragOffset.x);
      const newY = Math.round(e.clientY / zoom - dragOffset.y);

      const updatedNodes = graph.nodes.map((node) => {
        if (node.id === draggingNodeId) {
          return { ...node, x: newX, y: newY };
        }
        return node;
      });

      onGraphChange({ ...graph, nodes: updatedNodes });
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handlePointerUp = () => {
    setDraggingNodeId(null);
    setIsPanning(false);
  };

  // Canvas background drag to pan
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectingSourceId(null);
      setIsPanning(true);
      setPanStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
    }
  };

  // Add new node with default shape per diagram type
  const handleAddNode = (shapeOverride?: NodeShape) => {
    const id = `node-${Date.now()}`;
    const defaultShape: NodeShape =
      shapeOverride ||
      (currentDiagramType === 'flowchart'
        ? 'rectangle'
        : currentDiagramType === 'architecture'
        ? 'rectangle'
        : 'rounded');

    const defaultLabel =
      defaultShape === 'diamond'
        ? '¿Condición?'
        : defaultShape === 'cylinder'
        ? 'Base de Datos'
        : defaultShape === 'cloud'
        ? 'Servicio Cloud'
        : defaultShape === 'circle'
        ? 'Inicio / Fin'
        : 'Nuevo Bloque';

    const newNode: ConceptNode = {
      id,
      label: defaultLabel,
      description: '',
      x: Math.round(400 - pan.x / zoom),
      y: Math.round(250 - pan.y / zoom),
      color: NODE_COLORS[graph.nodes.length % NODE_COLORS.length],
      shape: defaultShape,
    };

    onGraphChange({
      ...graph,
      nodes: [...graph.nodes, newNode],
    });
    setSelectedNodeId(id);
  };

  // Quick preset templates for rapid diagramming
  const handleLoadPreset = (type: DiagramType) => {
    if (type === 'flowchart') {
      const nodes: ConceptNode[] = [
        { id: 'fc-1', label: 'Inicio', description: 'Comienza el proceso', x: 450, y: 100, color: '#10b981', shape: 'circle' },
        { id: 'fc-2', label: 'Ingresar Datos', description: 'Usuario escribe notas con stylus', x: 450, y: 220, color: '#3b82f6', shape: 'rectangle' },
        { id: 'fc-3', label: '¿Reconocer Texto?', description: '¿Tiene trazos manuscritos?', x: 450, y: 350, color: '#f59e0b', shape: 'diamond' },
        { id: 'fc-4', label: 'Procesar con IA (OCR)', description: 'Transcribe a texto digital', x: 680, y: 350, color: '#8b5cf6', shape: 'rectangle' },
        { id: 'fc-5', label: 'Guardar en Tablet', description: 'Almacenamiento local seguro', x: 450, y: 490, color: '#10b981', shape: 'circle' },
      ];
      const edges: ConceptEdge[] = [
        { id: 'fe-1', sourceId: 'fc-1', targetId: 'fc-2', label: 'inicia' },
        { id: 'fe-2', sourceId: 'fc-2', targetId: 'fc-3', label: 'envía' },
        { id: 'fe-3', sourceId: 'fc-3', targetId: 'fc-4', label: 'Sí' },
        { id: 'fe-4', sourceId: 'fc-3', targetId: 'fc-5', label: 'No' },
        { id: 'fe-5', sourceId: 'fc-4', targetId: 'fc-5', label: 'completa' },
      ];
      onGraphChange({ ...graph, title: 'Diagrama de Flujo', diagramType: 'flowchart', nodes, edges });
    } else if (type === 'architecture') {
      const nodes: ConceptNode[] = [
        { id: 'arch-1', label: 'Tablet Android (Cliente)', description: 'Interfaz React + Stylus Canvas', x: 220, y: 280, color: '#3b82f6', shape: 'rectangle' },
        { id: 'arch-2', label: 'Servidor API (Node.js)', description: 'Express + Controladores', x: 500, y: 280, color: '#8b5cf6', shape: 'rectangle' },
        { id: 'arch-3', label: 'Almacenamiento Local', description: 'localStorage en dispositivo', x: 220, y: 440, color: '#10b981', shape: 'cylinder' },
        { id: 'arch-4', label: 'Gemini AI Vision & Audio', description: 'Reconocimiento Multimodal', x: 780, y: 280, color: '#06b6d4', shape: 'cloud' },
      ];
      const edges: ConceptEdge[] = [
        { id: 'ae-1', sourceId: 'arch-1', targetId: 'arch-3', label: 'guarda local' },
        { id: 'ae-2', sourceId: 'arch-1', targetId: 'arch-2', label: 'peticiones HTTP' },
        { id: 'ae-3', sourceId: 'arch-2', targetId: 'arch-4', label: 'OCR & Voz' },
      ];
      onGraphChange({ ...graph, title: 'Diagrama de Arquitectura', diagramType: 'architecture', nodes, edges });
    } else {
      const nodes: ConceptNode[] = [
        { id: 'mm-1', label: 'Idea Central', description: 'Tema principal', x: 450, y: 280, color: '#3b82f6', shape: 'rounded' },
        { id: 'mm-2', label: 'Aspecto 1', description: 'Puntos clave', x: 250, y: 160, color: '#10b981', shape: 'rounded' },
        { id: 'mm-3', label: 'Aspecto 2', description: 'Detalles', x: 650, y: 160, color: '#f59e0b', shape: 'rounded' },
        { id: 'mm-4', label: 'Aspecto 3', description: 'Conclusiones', x: 450, y: 440, color: '#8b5cf6', shape: 'rounded' },
      ];
      const edges: ConceptEdge[] = [
        { id: 'me-1', sourceId: 'mm-1', targetId: 'mm-2', label: 'incluye' },
        { id: 'me-2', sourceId: 'mm-1', targetId: 'mm-3', label: 'desarrolla' },
        { id: 'me-3', sourceId: 'mm-1', targetId: 'mm-4', label: 'concluye en' },
      ];
      onGraphChange({ ...graph, title: 'Mapa Mental', diagramType: 'mindmap', nodes, edges });
    }
  };

  // Delete node
  const handleDeleteNode = (id: string) => {
    const updatedNodes = graph.nodes.filter((n) => n.id !== id);
    const updatedEdges = purgeOrphanEdges(updatedNodes, graph.edges);
    onGraphChange({ ...graph, nodes: updatedNodes, edges: updatedEdges });
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  // Delete edge
  const handleDeleteEdge = (id: string) => {
    const updatedEdges = graph.edges.filter((e) => e.id !== id);
    onGraphChange({ ...graph, edges: updatedEdges });
    if (selectedEdgeId === id) setSelectedEdgeId(null);
  };

  // Auto layout / Tidy up
  const handleAutoLayout = () => {
    if (currentDiagramType === 'flowchart') {
      // Top-to-bottom layout
      const spacingY = 120;
      const startY = 100;
      const centerX = 450;
      const updated = graph.nodes.map((node, idx) => ({
        ...node,
        x: centerX + (idx % 2 === 0 ? 0 : 30),
        y: startY + idx * spacingY,
      }));
      onGraphChange({ ...graph, nodes: updated });
    } else {
      // Radial or balanced layout
      const laidOut = autoLayoutNodes(graph.nodes, 450, 300, 220);
      onGraphChange({ ...graph, nodes: laidOut });
    }
  };

  // Generate with AI
  const handleGenerateWithAI = async () => {
    const textToUse = currentNoteText || graph.title || 'Flujo de proceso y arquitectura';
    setIsGenerating(true);

    try {
      const res = await fetch('/api/generate-concept-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToUse,
          title: graph.title || 'Diagrama Generado',
        }),
      });

      if (!res.ok) throw new Error('Error generando diagrama');
      const data = await res.json();

      if (data.nodes && data.nodes.length > 0) {
        onGraphChange({
          id: graph.id,
          title: data.title || graph.title,
          diagramType: currentDiagramType,
          nodes: data.nodes,
          edges: data.edges || [],
        });
      }
    } catch (err: any) {
      console.warn('Error en generación de diagrama:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Export outline as markdown
  const handleCopyOutline = () => {
    const md = graphToMarkdown(graph);
    navigator.clipboard.writeText(md);
    setCopiedOutline(true);
    setTimeout(() => setCopiedOutline(false), 2000);
    if (onExportToNote) onExportToNote(md);
  };

  const activeNode = graph.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-50/80 dark:bg-slate-950 overflow-hidden select-none cursor-grab active:cursor-grabbing bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      {/* Top Diagram Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Title & Diagram Mode Selector */}
        <div className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={graph.title}
            onChange={(e) => onGraphChange({ ...graph, title: e.target.value })}
            className="font-bold text-xs md:text-sm text-slate-800 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-32 md:w-44 truncate"
            placeholder="Título del Diagrama"
            aria-label="Título del diagrama"
          />

          {/* Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => onGraphChange({ ...graph, diagramType: 'flowchart' })}
              className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1 font-medium ${
                currentDiagramType === 'flowchart'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Modo Diagrama de Flujo (procesos y decisiones)"
            >
              <Workflow className="w-3 h-3" />
              <span className="hidden sm:inline">Flujo</span>
            </button>
            <button
              type="button"
              onClick={() => onGraphChange({ ...graph, diagramType: 'architecture' })}
              className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1 font-medium ${
                currentDiagramType === 'architecture'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Modo Diagrama de Arquitectura (sistemas, clientes, servidores, bases de datos)"
            >
              <Server className="w-3 h-3" />
              <span className="hidden sm:inline">Arquitectura</span>
            </button>
            <button
              type="button"
              onClick={() => onGraphChange({ ...graph, diagramType: 'mindmap' })}
              className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1 font-medium ${
                currentDiagramType === 'mindmap'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Modo Mapa Mental (conceptos e ideas)"
            >
              <GitBranch className="w-3 h-3" />
              <span className="hidden sm:inline">Mental</span>
            </button>
          </div>
        </div>

        {/* Right: Shape insertion & Actions */}
        <div className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-800 flex items-center gap-1">
          {/* Quick Shapes Palette */}
          <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => handleAddNode('rectangle')}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Añadir Proceso / Bloque (Rectángulo)"
              aria-label="Rectángulo"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('diamond')}
              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
              title="Añadir Decisión / Condición (Rombo)"
              aria-label="Rombo decisión"
            >
              <Diamond className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('cylinder')}
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
              title="Añadir Base de Datos (Cilindro)"
              aria-label="Cilindro base de datos"
            >
              <Database className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('cloud')}
              className="p-1.5 rounded-lg text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors"
              title="Añadir Nube / Servicio Externo"
              aria-label="Nube"
            >
              <Cloud className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('circle')}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Añadir Inicio / Fin (Círculo)"
              aria-label="Círculo"
            >
              <Circle className="w-4 h-4" />
            </button>
          </div>

          {/* Plantillas de 1 toque */}
          <div className="flex items-center gap-1 pl-1">
            <button
              type="button"
              onClick={() => handleLoadPreset(currentDiagramType)}
              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors"
              title="Cargar plantilla ordenada de ejemplo"
            >
              Plantilla
            </button>

            <button
              type="button"
              onClick={handleAutoLayout}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Auto-organizar y alinear todos los bloques"
              aria-label="Auto-organizar"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleGenerateWithAI}
              disabled={isGenerating}
              className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-all disabled:opacity-50"
              title="Generar diagrama con IA desde el texto o título"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{isGenerating ? 'Generando...' : 'IA Diagrama'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyOutline}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs transition-colors"
              title="Copiar esquema de texto"
              aria-label="Copiar esquema"
            >
              {copiedOutline ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas for Connections & Arrows */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          <marker
            id="diagram-arrow"
            viewBox="0 0 10 10"
            refX="24"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
          <marker
            id="diagram-arrow-active"
            viewBox="0 0 10 10"
            refX="24"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
          </marker>
        </defs>

        {graph.edges.map((edge) => {
          const source = graph.nodes.find((n) => n.id === edge.sourceId);
          const target = graph.nodes.find((n) => n.id === edge.targetId);
          if (!source || !target) return null;

          const isSelected = selectedEdgeId === edge.id;
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;

          return (
            <g key={edge.id} className="pointer-events-auto cursor-pointer">
              {/* Hitbox line */}
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="transparent"
                strokeWidth={20}
                onClick={() => setSelectedEdgeId(edge.id)}
              />
              {/* Visible edge line */}
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isSelected ? '#2563eb' : '#64748b'}
                strokeWidth={isSelected ? 2.5 : 1.8}
                strokeDasharray={isSelected ? '4,4' : undefined}
                markerEnd={isSelected ? 'url(#diagram-arrow-active)' : 'url(#diagram-arrow)'}
              />
              {/* Relationship label */}
              {edge.label && (
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x={-edge.label.length * 3.5 - 6}
                    y={-10}
                    width={edge.label.length * 7 + 12}
                    height={18}
                    rx={5}
                    fill={isSelected ? '#dbeafe' : '#ffffff'}
                    stroke={isSelected ? '#2563eb' : '#cbd5e1'}
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={3}
                    textAnchor="middle"
                    fontSize={10}
                    fill={isSelected ? '#1e40af' : '#334155'}
                    fontWeight={600}
                  >
                    {edge.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Nodes Layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {graph.nodes.length === 0 ? (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 dark:bg-slate-900/95 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center max-w-sm pointer-events-auto"
          >
            <Workflow className="w-10 h-10 text-blue-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Lienzo de Diagramas Limpio
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Crea diagramas de flujo, arquitectura de sistemas o mapas mentales usando las figuras de arriba o carga una plantilla.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleAddNode('rectangle')}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                + Añadir Bloque
              </button>
              <button
                type="button"
                onClick={() => handleLoadPreset(currentDiagramType)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold"
              >
                Cargar Plantilla
              </button>
            </div>
          </div>
        ) : (
          graph.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isConnectingSource = connectingSourceId === node.id;
            const shape = node.shape || 'rounded';

            // Distinctive shape styling
            let shapeClasses = 'rounded-2xl border-2 p-3 min-w-[150px] max-w-[240px]';
            if (shape === 'circle') {
              shapeClasses = 'rounded-full border-2 p-4 w-32 h-32 flex flex-col items-center justify-center text-center';
            } else if (shape === 'diamond') {
              shapeClasses = 'rounded-2xl border-2 p-4 min-w-[150px] max-w-[200px] border-dashed border-amber-400 bg-amber-50/20';
            } else if (shape === 'cylinder') {
              shapeClasses = 'rounded-xl border-2 p-3.5 min-w-[160px] max-w-[240px] border-t-8';
            } else if (shape === 'cloud') {
              shapeClasses = 'rounded-3xl border-2 p-4 min-w-[160px] max-w-[240px] border-cyan-400 bg-cyan-50/10';
            } else if (shape === 'rectangle') {
              shapeClasses = 'rounded-lg border-2 p-3 min-w-[150px] max-w-[240px]';
            }

            return (
              <div
                key={node.id}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                className={`absolute pointer-events-auto bg-white dark:bg-slate-900 shadow-md transition-shadow cursor-grab active:cursor-grabbing select-none text-left ${shapeClasses} ${
                  isSelected
                    ? 'ring-4 ring-blue-500/30 border-blue-500 shadow-xl'
                    : 'border-slate-200 dark:border-slate-800'
                } ${isConnectingSource ? 'animate-pulse ring-4 ring-emerald-500/40 border-emerald-500' : ''}`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  transform: 'translate(-50%, -50%)',
                  borderTopColor: node.color,
                }}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    {shape === 'cylinder' && <Database className="w-3.5 h-3.5 text-emerald-600" />}
                    {shape === 'cloud' && <Cloud className="w-3.5 h-3.5 text-cyan-600" />}
                    {shape === 'diamond' && <Diamond className="w-3.5 h-3.5 text-amber-600" />}
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: node.color }}
                    />
                  </div>

                  <div className="flex items-center gap-1 opacity-80 hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnectingSourceId(isConnectingSource ? null : node.id);
                      }}
                      className={`p-1 rounded-md text-[10px] ${
                        isConnectingSource
                          ? 'bg-emerald-500 text-white'
                          : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
                      }`}
                      title="Conectar a otro bloque con una flecha"
                      aria-label="Conectar flecha"
                    >
                      <LinkIcon className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNode(node.id);
                      }}
                      className="p-1 rounded-md text-[10px] text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                      title="Eliminar bloque"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs leading-tight mb-1">
                  {node.label}
                </div>

                {node.description && (
                  <div className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                    {node.description}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Inspector / Editor Drawer for Active Node */}
      {activeNode && (
        <div className="absolute bottom-4 right-4 z-30 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Edit2 className="w-3.5 h-3.5 text-blue-600" />
              Editar Bloque
            </span>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Cerrar
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Etiqueta del Bloque</label>
              <input
                type="text"
                value={activeNode.label}
                onChange={(e) => {
                  const val = e.target.value;
                  onGraphChange({
                    ...graph,
                    nodes: graph.nodes.map((n) => (n.id === activeNode.id ? { ...n, label: val } : n)),
                  });
                }}
                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Etiqueta"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Descripción / Detalles</label>
              <textarea
                value={activeNode.description || ''}
                rows={2}
                onChange={(e) => {
                  const val = e.target.value;
                  onGraphChange({
                    ...graph,
                    nodes: graph.nodes.map((n) => (n.id === activeNode.id ? { ...n, description: val } : n)),
                  });
                }}
                className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Función, proceso o nota..."
                aria-label="Descripción"
              />
            </div>

            {/* Shape Selector */}
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Figura geométrica</label>
              <div className="grid grid-cols-6 gap-1">
                {(['rectangle', 'rounded', 'diamond', 'cylinder', 'cloud', 'circle'] as NodeShape[]).map((shp) => (
                  <button
                    key={shp}
                    type="button"
                    onClick={() => {
                      onGraphChange({
                        ...graph,
                        nodes: graph.nodes.map((n) => (n.id === activeNode.id ? { ...n, shape: shp } : n)),
                      });
                    }}
                    className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-all ${
                      (activeNode.shape || 'rounded') === shp
                        ? 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/60'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    title={shp}
                  >
                    {shp === 'rectangle' && <Square className="w-3.5 h-3.5" />}
                    {shp === 'rounded' && <span className="w-3.5 h-2.5 rounded-md border border-current" />}
                    {shp === 'diamond' && <Diamond className="w-3.5 h-3.5" />}
                    {shp === 'cylinder' && <Database className="w-3.5 h-3.5" />}
                    {shp === 'cloud' && <Cloud className="w-3.5 h-3.5" />}
                    {shp === 'circle' && <Circle className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Palette */}
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Color de acento</label>
              <div className="flex items-center gap-1.5">
                {NODE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      onGraphChange({
                        ...graph,
                        nodes: graph.nodes.map((n) => (n.id === activeNode.id ? { ...n, color: c } : n)),
                      });
                    }}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      activeNode.color === c ? 'scale-125 ring-2 ring-blue-500 ring-offset-2' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConnectingSourceId(activeNode.id)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Trazar Flecha</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteNode(activeNode.id)}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Edge Editor Drawer */}
      {selectedEdgeId && (
        <div className="absolute bottom-4 left-4 z-30 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Editar Flecha</span>
            <button
              type="button"
              onClick={() => setSelectedEdgeId(null)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Cerrar
            </button>
          </div>
          {(() => {
            const edge = graph.edges.find((e) => e.id === selectedEdgeId);
            if (!edge) return null;
            return (
              <div className="space-y-2">
                <input
                  type="text"
                  value={edge.label || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onGraphChange({
                      ...graph,
                      edges: graph.edges.map((eg) => (eg.id === edge.id ? { ...eg, label: val } : eg)),
                    });
                  }}
                  className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  placeholder="Texto (ej: Sí, No, solicita, guarda)"
                  aria-label="Texto de la flecha"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteEdge(edge.id)}
                  className="w-full text-xs py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                >
                  Eliminar Flecha
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Bottom Center Zoom & Pan reset */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-800 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
          className="w-6 h-6 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300"
          title="Alejar"
          aria-label="Alejar"
        >
          -
        </button>
        <span className="text-[11px] font-mono text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.0, z + 0.1))}
          className="w-6 h-6 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300"
          title="Acercar"
          aria-label="Acercar"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 0, y: 0 });
          }}
          className="text-[11px] px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
