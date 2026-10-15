/**
 * Concept map graph operations, auto-layout, and note integration.
 */

export interface ConceptNode {
  id: string;
  label: string;
  description?: string;
  x: number;
  y: number;
  color: string;
  width?: number;
  height?: number;
}

export interface ConceptEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface ConceptGraph {
  id: string;
  title: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

/**
 * Validates and purges edges that point to non-existent nodes.
 */
export function purgeOrphanEdges(nodes: ConceptNode[], edges: ConceptEdge[]): ConceptEdge[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  return edges.filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));
}

/**
 * Automatically calculates pleasant grid/radial coordinates for nodes.
 */
export function autoLayoutNodes(
  nodes: ConceptNode[],
  centerX: number = 400,
  centerY: number = 300,
  radius: number = 220
): ConceptNode[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) {
    return [{ ...nodes[0], x: centerX, y: centerY }];
  }

  // Position root node in center if identified, else circle layout
  const count = nodes.length;
  const angleStep = (2 * Math.PI) / count;

  return nodes.map((node, index) => {
    const angle = index * angleStep - Math.PI / 2;
    const x = Math.round(centerX + Math.cos(angle) * radius);
    const y = Math.round(centerY + Math.sin(angle) * radius);
    return { ...node, x, y };
  });
}

/**
 * Converts a concept graph into a readable hierarchical outline or markdown.
 */
export function graphToMarkdown(graph: ConceptGraph): string {
  let output = `# ${graph.title || 'Mapa Conceptual'}\n\n`;

  const nodeMap = new Map<string, ConceptNode>();
  graph.nodes.forEach((n) => nodeMap.set(n.id, n));

  // Find incoming connection count
  const incomingCount: Record<string, number> = {};
  graph.edges.forEach((e) => {
    incomingCount[e.targetId] = (incomingCount[e.targetId] || 0) + 1;
  });

  // Group outgoing edges by source
  const outgoingMap: Record<string, ConceptEdge[]> = {};
  graph.edges.forEach((e) => {
    if (!outgoingMap[e.sourceId]) outgoingMap[e.sourceId] = [];
    outgoingMap[e.sourceId].push(e);
  });

  graph.nodes.forEach((node) => {
    output += `### ${node.label}\n`;
    if (node.description) {
      output += `${node.description}\n`;
    }
    const connections = outgoingMap[node.id] || [];
    if (connections.length > 0) {
      output += `Conexiones:\n`;
      connections.forEach((conn) => {
        const target = nodeMap.get(conn.targetId);
        if (target) {
          const relation = conn.label ? ` --[${conn.label}]--> ` : ' --> ';
          output += `- ${relation}${target.label}\n`;
        }
      });
    }
    output += '\n';
  });

  return output.trim();
}

/**
 * Converts structured text lines (e.g. from OCR or AI voice transcript) into initial concept nodes.
 */
export function textLinesToConceptNodes(
  title: string,
  lines: string[],
  centerX: number = 400,
  centerY: number = 300
): { nodes: ConceptNode[]; edges: ConceptEdge[] } {
  const rootId = 'node-root';
  const nodes: ConceptNode[] = [
    {
      id: rootId,
      label: title || 'Concepto Central',
      x: centerX,
      y: centerY,
      color: '#3b82f6', // blue
    },
  ];

  const edges: ConceptEdge[] = [];
  const cleanLines = lines
    .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 8); // reasonable default count

  const angleStep = cleanLines.length > 0 ? (2 * Math.PI) / cleanLines.length : 0;
  const radius = 180;
  const palette = ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  cleanLines.forEach((line, idx) => {
    const childId = `node-${idx + 1}`;
    const angle = idx * angleStep - Math.PI / 2;
    nodes.push({
      id: childId,
      label: line,
      x: Math.round(centerX + Math.cos(angle) * radius),
      y: Math.round(centerY + Math.sin(angle) * radius),
      color: palette[idx % palette.length],
    });

    edges.push({
      id: `edge-${idx + 1}`,
      sourceId: rootId,
      targetId: childId,
      label: 'incluye',
    });
  });

  return { nodes, edges };
}
