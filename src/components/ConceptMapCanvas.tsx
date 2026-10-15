import React, { useState, useRef, useEffect } from 'react';
import { ConceptGraph, ConceptNode, ConceptEdge } from '../types';
import { autoLayoutNodes, purgeOrphanEdges, graphToMarkdown } from '../utils/conceptMap';
import {
  Plus,
  Sparkles,
  Maximize2,
  Trash2,
  Share2,
  Check,
  Copy,
  Edit2,
  Link as LinkIcon,
  RotateCcw,
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

  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Connection creation mode
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);

  // Selected node for editing
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<ConceptNode | null>(null);

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
        // Create edge
        const newEdge: ConceptEdge = {
          id: `edge-${Date.now()}`,
          sourceId: connectingSourceId,
          targetId: node.id,
          label: 'se relaciona con',
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

  // Add new node
  const handleAddNode = () => {
    const id = `node-${Date.now()}`;
    const newNode: ConceptNode = {
      id,
      label: 'Nuevo Concepto',
      description: 'Detalles o ideas clave',
      x: Math.round(400 - pan.x / zoom),
      y: Math.round(250 - pan.y / zoom),
      color: NODE_COLORS[graph.nodes.length % NODE_COLORS.length],
    };

    onGraphChange({
      ...graph,
      nodes: [...graph.nodes, newNode],
    });
    setSelectedNodeId(id);
    setEditingNode(newNode);
  };

  // Delete node
  const handleDeleteNode = (id: string) => {
    const updatedNodes = graph.nodes.filter((n) => n.id !== id);
    const updatedEdges = purgeOrphanEdges(updatedNodes, graph.edges);
    onGraphChange({
      ...graph,
      nodes: updatedNodes,
      edges: updatedEdges,
    });
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  // Delete edge
  const handleDeleteEdge = (id: string) => {
    const updatedEdges = graph.edges.filter((e) => e.id !== id);
    onGraphChange({
      ...graph,
      edges: updatedEdges,
    });
    if (selectedEdgeId === id) setSelectedEdgeId(null);
  };

  // Auto layout
  const handleAutoLayout = () => {
    const laidOut = autoLayoutNodes(graph.nodes, 450, 300, 220);
    onGraphChange({
      ...graph,
      nodes: laidOut,
    });
  };

  // Generate concept map with AI from current note text
  const handleGenerateWithAI = async () => {
    const textToUse = currentNoteText || graph.title || 'Ideas del proyecto y notas';
    setIsGenerating(true);

    try {
      const res = await fetch('/api/generate-concept-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToUse,
          title: graph.title || 'Mapa Conceptual',
        }),
      });

      if (!res.ok) throw new Error('Error generando mapa conceptual');
      const data = await res.json();

      if (data.nodes && data.nodes.length > 0) {
        onGraphChange({
          id: graph.id,
          title: data.title || graph.title,
          nodes: data.nodes,
          edges: data.edges || [],
        });
      }
    } catch (err: any) {
      console.warn('Error en generación de mapa:', err);
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

  // Selected node object
  const activeNode = graph.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-50 dark:bg-slate-950 overflow-hidden select-none cursor-grab active:cursor-grabbing"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      {/* Top Map Toolbar */}
      <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Left: Title & Status */}
        <div className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <input
            type="text"
            value={graph.title}
            onChange={(e) => onGraphChange({ ...graph, title: e.target.value })}
            className="font-bold text-sm text-slate-800 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none"
            placeholder="Título del Mapa"
            aria-label="Título del mapa"
          />
          <span className="text-xs text-slate-400">
            {graph.nodes.length} nodos • {graph.edges.length} enlaces
          </span>
        </div>

        {/* Right: Actions */}
        <div className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleAddNode}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            aria-label="Añadir nodo"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Nodo</span>
          </button>

          <button
            type="button"
            onClick={handleAutoLayout}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Auto-organizar nodos en círculo armónico"
            aria-label="Auto-organizar"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleGenerateWithAI}
            disabled={isGenerating}
            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            title="Generar mapa conceptual con IA desde el texto de la nota actual"
            aria-label="Generar mapa con IA"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Generando...' : 'IA Conceptual'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyOutline}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Copiar esquema de texto y exportar a nota"
            aria-label="Copiar esquema"
          >
            {copiedOutline ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Esquema</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas for Connections */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
          <marker
            id="arrow-active"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
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
              {/* Interaction hitbox line */}
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
                stroke={isSelected ? '#3b82f6' : '#94a3b8'}
                strokeWidth={isSelected ? 2.5 : 1.8}
                strokeDasharray={isSelected ? '4,4' : undefined}
                markerEnd={isSelected ? 'url(#arrow-active)' : 'url(#arrow)'}
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
                    fill={isSelected ? '#dbeafe' : '#f8fafc'}
                    stroke={isSelected ? '#3b82f6' : '#cbd5e1'}
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={3}
                    textAnchor="middle"
                    fontSize={10}
                    fill={isSelected ? '#1e40af' : '#475569'}
                    fontWeight={500}
                  >
                    {edge.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Temporary connecting line from source to pointer */}
        {connectingSourceId && (
          <line
            x1={graph.nodes.find((n) => n.id === connectingSourceId)?.x || 0}
            y1={graph.nodes.find((n) => n.id === connectingSourceId)?.y || 0}
            x2={dragOffset.x}
            y2={dragOffset.y}
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="4,4"
          />
        )}
      </svg>

      {/* Nodes Layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {graph.nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isConnectingSource = connectingSourceId === node.id;

          return (
            <div
              key={node.id}
              onPointerDown={(e) => handleNodePointerDown(e, node)}
              className={`absolute pointer-events-auto rounded-2xl shadow-md transition-shadow cursor-grab active:cursor-grabbing border-2 p-3 min-w-[150px] max-w-[240px] text-left select-none ${
                isSelected
                  ? 'ring-4 ring-blue-500/30 border-blue-500 shadow-xl'
                  : 'border-slate-200 dark:border-slate-800'
              } ${isConnectingSource ? 'animate-pulse ring-4 ring-emerald-500/40 border-emerald-500' : ''}`}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#ffffff',
                borderTopColor: node.color,
                borderTopWidth: '4px',
              }}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: node.color }}
                />
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
                    title="Conectar a otro concepto"
                    aria-label="Conectar concepto"
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
                    title="Eliminar nodo"
                    aria-label="Eliminar nodo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="font-semibold text-slate-900 text-xs leading-tight mb-1">
                {node.label}
              </div>

              {node.description && (
                <div className="text-[11px] text-slate-500 leading-snug line-clamp-3">
                  {node.description}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Node Inspector / Editor Drawer (when a node is selected) */}
      {activeNode && (
        <div className="absolute bottom-4 right-4 z-30 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Edit2 className="w-3.5 h-3.5 text-blue-600" />
              Editar Concepto
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
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Etiqueta del Concepto</label>
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
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Descripción / Notas</label>
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
                placeholder="Explicación del concepto..."
                aria-label="Descripción"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Color del Nodo</label>
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
                <span>Trazar Conexión</span>
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
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Editar Enlace</span>
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
                  placeholder="Texto del enlace (ej: genera, causa, contiene)"
                  aria-label="Texto del enlace"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteEdge(edge.id)}
                  className="w-full text-xs py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                >
                  Eliminar Enlace
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Zoom / View controls at bottom center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-800 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
          className="w-7 h-7 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300"
          title="Alejar"
          aria-label="Alejar"
        >
          -
        </button>
        <span className="text-xs font-mono text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.0, z + 0.1))}
          className="w-7 h-7 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300"
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
          className="text-xs px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
