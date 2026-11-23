import { create } from 'zustand';
import { MarkerType, type Connection } from '@xyflow/react';
import type {
  CircuitGraph,
  ComponentType,
  ParseDiagnostic,
  UpdateSource,
} from '../types/circuit.ts';
import { COMPONENT_METADATA } from '../types/circuit.ts';
import type { CircuitNode, CircuitEdge } from '../types/flow.ts';
import { parseDsl } from '../parser/dslParser.ts';
import { serializeGraph } from '../parser/dslSerializer.ts';
import { SAMPLE_CIRCUITS, type CircuitSample } from '../parser/sampleCircuits.ts';
import { calculateAutoLayout } from '../utils/layout.ts';

export interface CircuitState {
  dslText: string;
  graph: CircuitGraph;
  nodes: CircuitNode[];
  edges: CircuitEdge[];
  diagnostics: ParseDiagnostic[];
  lastUpdatedBy: UpdateSource;
  isLayoutRunning: boolean;

  // Actions
  setDslText: (text: string) => void;
  updateNodes: (nodes: CircuitNode[]) => void;
  updateEdges: (edges: CircuitEdge[]) => void;
  connectPins: (connection: Connection) => void;
  addComponent: (type: ComponentType, position?: { x: number; y: number }) => void;
  deleteComponent: (id: string) => void;
  deleteNodes: (nodesToDelete: CircuitNode[] | string[]) => void;
  deleteEdges: (edgesToDelete: CircuitEdge[] | string[]) => void;
  applyAutoLayout: () => Promise<void>;
  loadSample: (sample: CircuitSample) => Promise<void>;
  clearCircuit: () => void;
}

function graphToNodesAndEdges(graph: CircuitGraph): {
  nodes: CircuitNode[];
  edges: CircuitEdge[];
} {
  const nodes: CircuitNode[] = graph.components.map((comp) => ({
    id: comp.id,
    type: comp.type,
    position: { ...comp.position },
    data: {
      id: comp.id,
      componentType: comp.type,
      value: comp.value,
      label: comp.label,
      rotation: comp.rotation,
    },
  }));

  const edges: CircuitEdge[] = graph.connections.map((conn) => {
    // Vary path offset based on source pin index so multiple wires
    // leaving the same side of a component fan out into separate lanes.
    const sourceComp = graph.components.find((c) => c.id === conn.sourceComponentId);
    const sourceMeta = sourceComp ? COMPONENT_METADATA[sourceComp.type] : undefined;
    const sourcePinIndex = sourceMeta?.pins.findIndex((p) => p.id === conn.sourcePinId) ?? 0;
    const pinLaneOffset = Math.max(sourcePinIndex, 0) * 6;

    return {
      id: conn.id,
      source: conn.sourceComponentId,
      sourceHandle: conn.sourcePinId,
      target: conn.targetComponentId,
      targetHandle: conn.targetPinId,
      type: 'smoothstep',
      label: conn.netLabel,
      labelStyle: conn.netLabel
        ? { fill: '#38bdf8', fontWeight: 600, fontSize: 11 }
        : undefined,
      labelBgStyle: conn.netLabel
        ? { fill: '#0f172a', stroke: '#334155', strokeWidth: 1 }
        : undefined,
      style: { stroke: '#38bdf8', strokeWidth: 2.2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#38bdf8',
        width: 14,
        height: 14,
      },
      pathOptions: {
        borderRadius: 12,
        offset: 25 + pinLaneOffset,
      },
    };
  });

  return { nodes, edges };
}

// Initial default state: Voltage Divider
const initialSample = SAMPLE_CIRCUITS[0];
const initialParse = parseDsl(initialSample.dsl);

// Preset nice initial positions for Voltage Divider
const INITIAL_COORDS: Record<string, { x: number; y: number }> = {
  V1: { x: 80, y: 160 },
  R1: { x: 260, y: 110 },
  R2: { x: 440, y: 110 },
  GND: { x: 440, y: 280 },
};

initialParse.graph.components.forEach((c) => {
  if (INITIAL_COORDS[c.id]) {
    c.position = INITIAL_COORDS[c.id];
  }
});

const initialFlow = graphToNodesAndEdges(initialParse.graph);

export const useCircuitStore = create<CircuitState>((set, get) => ({
  dslText: initialSample.dsl,
  graph: initialParse.graph,
  nodes: initialFlow.nodes,
  edges: initialFlow.edges,
  diagnostics: initialParse.diagnostics,
  lastUpdatedBy: 'initial',
  isLayoutRunning: false,

  setDslText: (newText: string) => {
    const currentGraph = get().graph;
    const result = parseDsl(newText, currentGraph);

    // Check if new components lack spatial coordinates (all at 0,0)
    const hasUnpositionedNodes = result.graph.components.some(
      (c) => c.position.x === 0 && c.position.y === 0
    );

    const { nodes, edges } = graphToNodesAndEdges(result.graph);

    set({
      dslText: newText,
      graph: result.graph,
      nodes,
      edges,
      diagnostics: result.diagnostics,
      lastUpdatedBy: 'text',
    });

    // Auto-layout if freshly pasted text has all components at origin
    if (
      hasUnpositionedNodes &&
      result.graph.components.length > 0 &&
      result.isValid
    ) {
      void get().applyAutoLayout();
    }
  },

  updateNodes: (updatedNodes: CircuitNode[]) => {
    const currentGraph = get().graph;

    // Map updated positions into the component graph
    const compMap = new Map(currentGraph.components.map((c) => [c.id, c]));
    for (const node of updatedNodes) {
      const comp = compMap.get(node.id);
      if (comp) {
        comp.position = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
      }
    }

    set({
      nodes: updatedNodes,
      lastUpdatedBy: 'canvas',
    });
  },

  updateEdges: (updatedEdges: CircuitEdge[]) => {
    const currentGraph = get().graph;

    const newConnections = updatedEdges
      .filter((e) => e.source && e.target && e.sourceHandle && e.targetHandle)
      .map((e) => ({
        id: e.id,
        sourceComponentId: e.source,
        sourcePinId: e.sourceHandle!,
        targetComponentId: e.target,
        targetPinId: e.targetHandle!,
        netLabel: typeof e.label === 'string' ? e.label : undefined,
      }));

    const updatedGraph: CircuitGraph = {
      ...currentGraph,
      connections: newConnections,
    };

    const newDsl = serializeGraph(updatedGraph);

    set({
      edges: updatedEdges,
      graph: updatedGraph,
      dslText: newDsl,
      lastUpdatedBy: 'canvas',
    });
  },

  connectPins: (connection: Connection) => {
    if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
      return;
    }

    const currentGraph = get().graph;
    const connId = `${connection.source}.${connection.sourceHandle}->${connection.target}.${connection.targetHandle}`;

    // Prevent duplicate connection
    const exists = currentGraph.connections.some(
      (c) =>
        c.sourceComponentId === connection.source &&
        c.sourcePinId === connection.sourceHandle &&
        c.targetComponentId === connection.target &&
        c.targetPinId === connection.targetHandle
    );

    if (exists) return;

    const newConnection = {
      id: connId,
      sourceComponentId: connection.source,
      sourcePinId: connection.sourceHandle,
      targetComponentId: connection.target,
      targetPinId: connection.targetHandle,
    };

    const updatedGraph: CircuitGraph = {
      ...currentGraph,
      connections: [...currentGraph.connections, newConnection],
    };

    const { nodes, edges } = graphToNodesAndEdges(updatedGraph);
    const newDsl = serializeGraph(updatedGraph);

    set({
      graph: updatedGraph,
      nodes,
      edges,
      dslText: newDsl,
      lastUpdatedBy: 'canvas',
    });
  },

  addComponent: (type: ComponentType, position?: { x: number; y: number }) => {
    const currentGraph = get().graph;
    const meta = COMPONENT_METADATA[type];
    const prefix = meta.defaultPrefix;

    // Find next available numeric ID e.g. R1, R2, R3
    let nextNum = 1;
    while (currentGraph.components.some((c) => c.id === `${prefix}${nextNum}`)) {
      nextNum++;
    }

    const newId = type === 'Ground' && !currentGraph.components.some((c) => c.id === 'GND')
      ? 'GND'
      : `${prefix}${nextNum}`;

    const defaultPos = position || {
      x: 100 + (currentGraph.components.length % 4) * 120,
      y: 120 + Math.floor(currentGraph.components.length / 4) * 100,
    };

    const newComp = {
      id: newId,
      type,
      value: meta.defaultValue,
      position: defaultPos,
      rotation: 0 as const,
    };

    const updatedGraph: CircuitGraph = {
      ...currentGraph,
      components: [...currentGraph.components, newComp],
    };

    const { nodes, edges } = graphToNodesAndEdges(updatedGraph);
    const newDsl = serializeGraph(updatedGraph);

    set({
      graph: updatedGraph,
      nodes,
      edges,
      dslText: newDsl,
      lastUpdatedBy: 'canvas',
    });
  },

  deleteNodes: (nodesToDelete: CircuitNode[] | string[]) => {
    const idsToDelete = new Set(
      nodesToDelete.map((n) => (typeof n === 'string' ? n : n.id))
    );
    if (idsToDelete.size === 0) return;

    const currentGraph = get().graph;
    const updatedComponents = currentGraph.components.filter(
      (c) => !idsToDelete.has(c.id)
    );
    // Automatically clean up any orphaned connections attached to deleted components
    const updatedConnections = currentGraph.connections.filter(
      (c) =>
        !idsToDelete.has(c.sourceComponentId) &&
        !idsToDelete.has(c.targetComponentId)
    );

    const updatedGraph: CircuitGraph = {
      ...currentGraph,
      components: updatedComponents,
      connections: updatedConnections,
    };

    const { nodes, edges } = graphToNodesAndEdges(updatedGraph);
    const newDsl = serializeGraph(updatedGraph);

    set({
      graph: updatedGraph,
      nodes,
      edges,
      dslText: newDsl,
      lastUpdatedBy: 'canvas',
    });
  },

  deleteEdges: (edgesToDelete: CircuitEdge[] | string[]) => {
    const idsToDelete = new Set(
      edgesToDelete.map((e) => (typeof e === 'string' ? e : e.id))
    );
    if (idsToDelete.size === 0) return;

    const currentGraph = get().graph;
    const updatedConnections = currentGraph.connections.filter(
      (c) => !idsToDelete.has(c.id)
    );

    const updatedGraph: CircuitGraph = {
      ...currentGraph,
      connections: updatedConnections,
    };

    const { nodes, edges } = graphToNodesAndEdges(updatedGraph);
    const newDsl = serializeGraph(updatedGraph);

    set({
      graph: updatedGraph,
      nodes,
      edges,
      dslText: newDsl,
      lastUpdatedBy: 'canvas',
    });
  },

  deleteComponent: (id: string) => {
    get().deleteNodes([id]);
  },

  applyAutoLayout: async () => {
    set({ isLayoutRunning: true });
    const currentGraph = get().graph;

    const positions = await calculateAutoLayout(currentGraph);

    const updatedComponents = currentGraph.components.map((comp) => {
      const pos = positions[comp.id];
      return pos ? { ...comp, position: pos } : comp;
    });

    const updatedGraph: CircuitGraph = {
      ...currentGraph,
      components: updatedComponents,
    };

    const { nodes, edges } = graphToNodesAndEdges(updatedGraph);

    set({
      graph: updatedGraph,
      nodes,
      edges,
      isLayoutRunning: false,
      lastUpdatedBy: 'layout',
    });
  },

  loadSample: async (sample: CircuitSample) => {
    const parseResult = parseDsl(sample.dsl);
    const { nodes, edges } = graphToNodesAndEdges(parseResult.graph);

    set({
      dslText: sample.dsl,
      graph: parseResult.graph,
      nodes,
      edges,
      diagnostics: parseResult.diagnostics,
      lastUpdatedBy: 'initial',
    });

    // Auto-arrange the loaded sample with ELKjs
    await get().applyAutoLayout();
  },

  clearCircuit: () => {
    const emptyGraph: CircuitGraph = {
      title: 'New Circuit',
      components: [],
      connections: [],
    };
    const emptyDsl = serializeGraph(emptyGraph);

    set({
      dslText: emptyDsl,
      graph: emptyGraph,
      nodes: [],
      edges: [],
      diagnostics: [],
      lastUpdatedBy: 'canvas',
    });
  },
}));
