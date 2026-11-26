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
import { runCircuitSimulation, I2C_ADDRESSES, type SimulationResult, type FlipFlopStates, type Esp32GpioStates } from '../utils/simulation.ts';
import { esp32RuntimeManager } from '../simulation/esp32/Esp32RuntimeManager.ts';

export interface CircuitState {
  dslText: string;
  graph: CircuitGraph;
  nodes: CircuitNode[];
  edges: CircuitEdge[];
  diagnostics: ParseDiagnostic[];
  lastUpdatedBy: UpdateSource;
  isLayoutRunning: boolean;

  // Real-time Simulation Mode State
  isSimulating: boolean;
  switchStates: Record<string, boolean>; // switchId -> true (closed) / false (open)
  clockHigh: boolean; // Clock generator output state (toggles every 1s)
  clockIntervalId: ReturnType<typeof setInterval> | null;
  flipFlopStates: FlipFlopStates; // componentId -> { q, prevClk }
  simulationState: SimulationResult;
  esp32GpioStates: Esp32GpioStates; // ESP32 componentId -> pinId -> 0|1

  // Simulated environment values that Phase 2 sliders can drive directly.
  environmentState: EnvironmentState;
  // Rendered 16x2 text state for each LCD_I2C, keyed by component id.
  lcdDisplays: Record<string, LcdDisplayState>;

  // Undo/Redo history
  past: { dslText: string; nodes: CircuitNode[]; edges: CircuitEdge[] }[];
  future: { dslText: string; nodes: CircuitNode[]; edges: CircuitEdge[] }[];
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setDslText: (text: string) => Promise<void>;
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

  // Simulation Actions
  toggleSimulation: () => void;
  toggleSwitch: (switchId: string) => void;
  setEsp32GpioStates: (gpioStates: Esp32GpioStates) => void;
  setEnvironmentState: (partial: Partial<EnvironmentState>) => void;
  undo: () => void;
  redo: () => void;
  _pushHistory: () => void;
  setLcdDisplayByAddress: (address: number, display: LcdDisplayState) => void;
  _recomputeSimulation: () => void;
}

export interface EnvironmentState {
  temperature: number; // degrees Celsius
  humidity: number; // percent relative humidity
  lightLux: number; // ambient light in lux
  co2Ppm: number; // CO2 concentration in ppm
}

export interface LcdDisplayState {
  row0: string;
  row1: string;
  backlight: boolean;
}

const DEFAULT_ENVIRONMENT: EnvironmentState = {
  temperature: 25.0,
  humidity: 50.0,
  lightLux: 350,
  co2Ppm: 420,
};

function graphToNodesAndEdges(
  graph: CircuitGraph,
  isSimulating = false,
  simulationResult?: SimulationResult
): {
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
    // Vary path offset based on source pin index so multiple wires fan out into separate lanes.
    const sourceComp = graph.components.find((c) => c.id === conn.sourceComponentId);
    const sourceMeta = sourceComp ? COMPONENT_METADATA[sourceComp.type] : undefined;
    const sourcePinIndex = sourceMeta?.pins.findIndex((p) => p.id === conn.sourcePinId) ?? 0;
    const pinLaneOffset = Math.max(sourcePinIndex, 0) * 4;

    const isLive = isSimulating && simulationResult?.edgeStates[conn.id] === 1;

    return {
      id: conn.id,
      source: conn.sourceComponentId,
      sourceHandle: conn.sourcePinId,
      target: conn.targetComponentId,
      targetHandle: conn.targetPinId,
      type: 'wire',
      selectable: true,
      deletable: true,
      label: conn.netLabel,
      animated: isLive,
      labelStyle: conn.netLabel
        ? { fill: isLive ? '#22c55e' : '#38bdf8', fontWeight: 600, fontSize: 11 }
        : undefined,
      labelBgStyle: conn.netLabel
        ? { fill: '#0f172a', stroke: '#334155', strokeWidth: 1 }
        : undefined,
      style: isSimulating
        ? isLive
          ? { stroke: '#22c55e', strokeWidth: 3, filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.8))' }
          : { stroke: '#334155', strokeWidth: 2 }
        : { stroke: '#38bdf8', strokeWidth: 3 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isSimulating ? (isLive ? '#22c55e' : '#334155') : '#38bdf8',
        width: 14,
        height: 14,
      },
      pathOptions: {
        offset: 24 + pinLaneOffset,
        borderRadius: 8,
      },
    };
  });

  return { nodes, edges };
}

// Initial default state: Voltage Divider
const initialSample = SAMPLE_CIRCUITS.find((s) => s.id === 'voltage-divider') || SAMPLE_CIRCUITS[0];
const initialParse = parseDsl(initialSample.dsl);

// Preset initial positions for Voltage Divider
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

const initialSwitchStates: Record<string, boolean> = { SW1: true, SW2: false };
const initialEsp32GpioStates: Esp32GpioStates = {};
const initialSimResult = runCircuitSimulation(initialParse.graph, initialSwitchStates, {}, false, initialEsp32GpioStates);
const initialFlow = graphToNodesAndEdges(initialParse.graph, false, initialSimResult);

export const useCircuitStore = create<CircuitState>((set, get) => ({
  dslText: initialSample.dsl,
  graph: initialParse.graph,
  nodes: initialFlow.nodes,
  edges: initialFlow.edges,
  diagnostics: initialParse.diagnostics,
  lastUpdatedBy: 'initial',
  isLayoutRunning: false,

  isSimulating: false,
  switchStates: initialSwitchStates,
  clockHigh: false,
  clockIntervalId: null,
  flipFlopStates: {},
  simulationState: initialSimResult,
  esp32GpioStates: initialEsp32GpioStates,
  environmentState: { ...DEFAULT_ENVIRONMENT },
  lcdDisplays: {},
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  // Helper to recompute simulation with current state
  _recomputeSimulation: () => {
    const state = get();
    const simResult = runCircuitSimulation(
      state.graph,
      state.switchStates,
      state.flipFlopStates,
      state.clockHigh,
      state.esp32GpioStates
    );
    const { nodes, edges } = graphToNodesAndEdges(state.graph, state.isSimulating, simResult);
    set({
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      nodes,
      edges,
    });
  },

  setEsp32GpioStates: (gpioStates: Esp32GpioStates) => {
    set({ esp32GpioStates: gpioStates }, false);
    // Trigger immediate re-simulation
    get()._recomputeSimulation();
  },

  setEnvironmentState: (partial: Partial<EnvironmentState>) => {
    set({ environmentState: { ...get().environmentState, ...partial } });
  },

  _pushHistory: () => {
    const state = get();
    const nodes = state.nodes.map(n => ({ ...n, position: { ...n.position } }));
    const edges = state.edges.map(e => ({ ...e }));
    const snap = { dslText: state.dslText, nodes, edges };
    const past = [...state.past, snap].slice(-30);
    set({ past, future: [], canUndo: past.length > 0, canRedo: false });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const past = [...state.past];
    const last = past.pop()!;
    const future = [{ dslText: state.dslText, nodes: state.nodes, edges: state.edges }, ...state.future].slice(0, 30);
    
    // Re-parse DSL for electrical/syntax evaluation, but preserve node positions from snapshot
    const parsed = parseDsl(last.dslText);
    const isSim = state.isSimulating;
    const simResult = runCircuitSimulation(parsed.graph, state.switchStates, state.flipFlopStates, state.clockHigh, state.esp32GpioStates);
    const { nodes: freshNodes, edges: freshEdges } = graphToNodesAndEdges(parsed.graph, isSim, simResult);
    
    // Merge saved positions into fresh nodes
    const posMap = new Map(last.nodes.map(n => [n.id, n.position]));
    const nodes = freshNodes.map(n => ({
      ...n,
      position: posMap.get(n.id) ?? n.position,
    }));
    
    set({ 
      dslText: last.dslText, 
      graph: parsed.graph,
      nodes, 
      edges: freshEdges, 
      diagnostics: parsed.diagnostics,
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      past, 
      future, 
      canUndo: past.length > 0, 
      canRedo: true,
      lastUpdatedBy: 'canvas',
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const future = [...state.future];
    const next = future.shift()!;
    const past = [...state.past, { dslText: state.dslText, nodes: state.nodes, edges: state.edges }].slice(-30);
    
    // Re-parse DSL for electrical/syntax evaluation, but preserve node positions from snapshot
    const parsed = parseDsl(next.dslText);
    const isSim = state.isSimulating;
    const simResult = runCircuitSimulation(parsed.graph, state.switchStates, state.flipFlopStates, state.clockHigh, state.esp32GpioStates);
    const { nodes: freshNodes, edges: freshEdges } = graphToNodesAndEdges(parsed.graph, isSim, simResult);
    
    // Merge saved positions into fresh nodes
    const posMap = new Map(next.nodes.map(n => [n.id, n.position]));
    const nodes = freshNodes.map(n => ({
      ...n,
      position: posMap.get(n.id) ?? n.position,
    }));
    
    set({ 
      dslText: next.dslText, 
      graph: parsed.graph,
      nodes, 
      edges: freshEdges, 
      diagnostics: parsed.diagnostics,
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      past, 
      future, 
      canUndo: true, 
      canRedo: future.length > 0,
      lastUpdatedBy: 'canvas',
    });
  },

  setLcdDisplayByAddress: (address: number, display: LcdDisplayState) => {
    const graph = get().graph;
    const lcdComp = graph.components.find(
      (c) => c.type === 'LCD_I2C' && I2C_ADDRESSES.LCD_I2C === address
    );
    if (!lcdComp) return;
    set({
      lcdDisplays: { ...get().lcdDisplays, [lcdComp.id]: display },
    });
  },

  setDslText: async (newText: string) => {
    get()._pushHistory();
    const currentGraph = get().graph;
    const result = parseDsl(newText, currentGraph);

    // Check if new components lack spatial coordinates (all at 0,0)
    const hasUnpositionedNodes = result.graph.components.some(
      (c) => c.position.x === 0 && c.position.y === 0
    );

    const isSim = get().isSimulating;
    const simResult = runCircuitSimulation(result.graph, get().switchStates, get().flipFlopStates, get().clockHigh, get().esp32GpioStates);
    const { nodes, edges } = graphToNodesAndEdges(result.graph, isSim, simResult);

    set({
      dslText: newText,
      graph: result.graph,
      nodes,
      edges,
      diagnostics: result.diagnostics,
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      lastUpdatedBy: 'text',
    });

    // Auto-layout if freshly pasted text has all components at origin
    if (
      hasUnpositionedNodes &&
      result.graph.components.length > 0 &&
      result.isValid
    ) {
      await get().applyAutoLayout();
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
    get()._pushHistory();
    const currentGraph = get().graph;

    // Preserve selection so a rebuilt edge list keeps the clicked wire highlighted.
    const selectedIds = new Set(
      updatedEdges.filter((e) => e.selected).map((e) => e.id)
    );

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
    const isSim = get().isSimulating;
    const simResult = runCircuitSimulation(updatedGraph, get().switchStates, get().flipFlopStates, get().clockHigh, get().esp32GpioStates);
    const { nodes, edges } = graphToNodesAndEdges(updatedGraph, isSim, simResult);
    const edgesWithSelection = edges.map((e) =>
      selectedIds.has(e.id) ? { ...e, selected: true } : e
    );

    set({
      edges: edgesWithSelection,
      nodes,
      graph: updatedGraph,
      dslText: newDsl,
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      lastUpdatedBy: 'canvas',
    });
  },

  connectPins: (connection: Connection) => {
    get()._pushHistory();
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

    const isSim = get().isSimulating;
    const simResult = runCircuitSimulation(updatedGraph, get().switchStates, get().flipFlopStates, get().clockHigh, get().esp32GpioStates);
    const { nodes, edges } = graphToNodesAndEdges(updatedGraph, isSim, simResult);
    const newDsl = serializeGraph(updatedGraph);

    set({
      graph: updatedGraph,
      nodes,
      edges,
      dslText: newDsl,
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      lastUpdatedBy: 'canvas',
    });
  },

  addComponent: (type: ComponentType, position?: { x: number; y: number }) => {
    get()._pushHistory();
    const currentGraph = get().graph;
    const meta = COMPONENT_METADATA[type];
    const prefix = meta.defaultPrefix;

    // Find next available numeric ID e.g. R1, R2, G1, G2
    let nextNum = 1;
    while (currentGraph.components.some((c) => c.id === `${prefix}${nextNum}`)) {
      nextNum++;
    }

    const newId = type === 'Ground' && !currentGraph.components.some((c) => c.id === 'GND')
      ? 'GND'
      : `${prefix}${nextNum}`;

    const defaultPos = position || {
      x: 100 + (currentGraph.components.length % 4) * 140,
      y: 120 + Math.floor(currentGraph.components.length / 4) * 110,
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

    const isSim = get().isSimulating;
    const simResult = runCircuitSimulation(updatedGraph, get().switchStates, get().flipFlopStates, get().clockHigh, get().esp32GpioStates);
    const { nodes, edges } = graphToNodesAndEdges(updatedGraph, isSim, simResult);
    const newDsl = serializeGraph(updatedGraph);

    set({
      graph: updatedGraph,
      nodes,
      edges,
      dslText: newDsl,
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      lastUpdatedBy: 'canvas',
    });
  },

  deleteNodes: (nodesToDelete: CircuitNode[] | string[]) => {
    get()._pushHistory();
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

    const isSim = get().isSimulating;
    const simResult = runCircuitSimulation(updatedGraph, get().switchStates, get().flipFlopStates, get().clockHigh, get().esp32GpioStates);
    const { nodes, edges } = graphToNodesAndEdges(updatedGraph, isSim, simResult);
    const newDsl = serializeGraph(updatedGraph);

    set({
      graph: updatedGraph,
      nodes,
      edges,
      dslText: newDsl,
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      lastUpdatedBy: 'canvas',
    });
  },

  deleteEdges: (edgesToDelete: CircuitEdge[] | string[]) => {
    get()._pushHistory();
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

    const isSim = get().isSimulating;
    const simResult = runCircuitSimulation(updatedGraph, get().switchStates, get().flipFlopStates, get().clockHigh, get().esp32GpioStates);
    const { nodes, edges } = graphToNodesAndEdges(updatedGraph, isSim, simResult);
    const newDsl = serializeGraph(updatedGraph);

    set({
      graph: updatedGraph,
      nodes,
      edges,
      dslText: newDsl,
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      lastUpdatedBy: 'canvas',
    });
  },

  deleteComponent: (id: string) => {
    get().deleteNodes([id]);
  },

  applyAutoLayout: async () => {
    get()._pushHistory();
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

    const isSim = get().isSimulating;
    const simResult = runCircuitSimulation(updatedGraph, get().switchStates, get().flipFlopStates, get().clockHigh, get().esp32GpioStates);
    const { nodes, edges } = graphToNodesAndEdges(updatedGraph, isSim, simResult);

    set({
      graph: updatedGraph,
      nodes,
      edges,
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      isLayoutRunning: false,
      lastUpdatedBy: 'layout',
    });
  },

  loadSample: async (sample: CircuitSample) => {
    get()._pushHistory();
    const parseResult = parseDsl(sample.dsl);
    const isSim = get().isSimulating;
    const simResult = runCircuitSimulation(parseResult.graph, get().switchStates, get().flipFlopStates, get().clockHigh, get().esp32GpioStates);
    const { nodes, edges } = graphToNodesAndEdges(parseResult.graph, isSim, simResult);

    set({
      dslText: sample.dsl,
      graph: parseResult.graph,
      nodes,
      edges,
      diagnostics: parseResult.diagnostics,
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      lastUpdatedBy: 'initial',
    });

    // Auto-arrange the loaded sample with ELKjs
    await get().applyAutoLayout();
  },

  clearCircuit: () => {
    get()._pushHistory();
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
      simulationState: { pinStates: {}, isGrounded: {}, ledStates: {}, buzzerStates: {}, edgeStates: {}, flipFlopStates: {}, i2cDevices: {} },
      flipFlopStates: {},
      lcdDisplays: {},
      lastUpdatedBy: 'canvas',
    });
  },

  toggleSimulation: () => {
    const nextSimulating = !get().isSimulating;
    const currentGraph = get().graph;
    const currentFlipFlopStates = nextSimulating ? get().flipFlopStates : {};
    const currentClockHigh = nextSimulating ? get().clockHigh : false;
    const simResult = runCircuitSimulation(currentGraph, get().switchStates, currentFlipFlopStates, currentClockHigh, get().esp32GpioStates);
    const { nodes, edges } = graphToNodesAndEdges(currentGraph, nextSimulating, simResult);

    if (nextSimulating) {
      // Start clock interval: toggle every 1000ms (1s half-period = 2s full cycle)
      const intervalId = setInterval(() => {
        const state = get();
        if (!state.isSimulating) return;
        const nextClockHigh = !state.clockHigh;
        const nextSimResult = runCircuitSimulation(state.graph, state.switchStates, state.flipFlopStates, nextClockHigh, state.esp32GpioStates);
        const { nodes: nextNodes, edges: nextEdges } = graphToNodesAndEdges(state.graph, true, nextSimResult);
        set({
          clockHigh: nextClockHigh,
          simulationState: nextSimResult,
          nodes: nextNodes,
          edges: nextEdges,
          flipFlopStates: nextSimResult.flipFlopStates,
        });
      }, 1000);

      set({
        isSimulating: nextSimulating,
        simulationState: simResult,
        flipFlopStates: simResult.flipFlopStates,
        clockHigh: currentClockHigh,
        clockIntervalId: intervalId,
        nodes,
        edges,
      });
    } else {
      // Stop clock interval
      const currentIntervalId = get().clockIntervalId;
      if (currentIntervalId) {
        clearInterval(currentIntervalId);
      }
      set({
        isSimulating: nextSimulating,
        simulationState: simResult,
        flipFlopStates: {},
        clockHigh: false,
        clockIntervalId: null,
        nodes,
        edges,
      });
    }
  },

  toggleSwitch: (switchId: string) => {
    const nextSwitchStates = {
      ...get().switchStates,
      [switchId]: !get().switchStates[switchId],
    };
    const currentGraph = get().graph;
    const isSim = get().isSimulating;
    const simResult = runCircuitSimulation(currentGraph, nextSwitchStates, get().flipFlopStates, get().clockHigh, get().esp32GpioStates);
    const { nodes, edges } = graphToNodesAndEdges(currentGraph, isSim, simResult);

    set({
      switchStates: nextSwitchStates,
      simulationState: simResult,
      flipFlopStates: simResult.flipFlopStates,
      nodes,
      edges,
    });
  },
}));

// Register the ESP32 runtime -> circuit solver bridge once at module initialization.
// This keeps GPIO updates wired to the solver permanently, independent of the
// ESP32 code modal lifecycle (closing the modal must never disconnect GPIO updates).
esp32RuntimeManager.setSimulationTrigger((gpioStates) => {
  useCircuitStore.getState().setEsp32GpioStates(gpioStates);
});

// Bridge simulated LiquidCrystal_I2C text state into the store so LCD_I2C nodes
// render exactly what the firmware printed (and stay blank when offline).
esp32RuntimeManager.setLcdUpdateCallback((address, row0, row1, backlight) => {
  useCircuitStore.getState().setLcdDisplayByAddress(address, { row0, row1, backlight });
});
