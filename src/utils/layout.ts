import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { ComponentType, CircuitGraph } from '../types/circuit.ts';
import { COMPONENT_METADATA } from '../types/circuit.ts';

const elk = new ELK();

const PIN_SIDE_TO_ELK: Record<'top' | 'bottom' | 'left' | 'right', string> = {
  top: 'NORTH',
  bottom: 'SOUTH',
  left: 'WEST',
  right: 'EAST',
};

/**
 * Calculates non-overlapping (x, y) coordinates for all circuit components
 * using ELK's layered orthogonal DAG algorithm (left-to-right electronic flow).
 * Wires are routed orthogonally with generous spacing so they never cross
 * component bodies and parallel wires fan out into separate lanes.
 */
export async function calculateAutoLayout(
  graph: CircuitGraph
): Promise<Record<string, { x: number; y: number }>> {
  if (graph.components.length === 0) {
    return {};
  }

  // Determine dynamic bounding box per component type
  const getComponentDimensions = (type: string) => {
    switch (type) {
      case 'ESP32_30Pin':
        return { width: 320, height: 640 };
      case 'OLED_SSD1306':
      case 'SCD41':
      case 'BH1750':
      case 'SHT31':
      case 'LCD_I2C':
        return { width: 240, height: 200 };
      case 'AND':
      case 'OR':
      case 'NOR':
      case 'NOT':
      case 'NAND':
      case 'XOR':
      case 'XNOR':
        return { width: 160, height: 110 };
      case 'D_FlipFlop':
      case 'JK_FlipFlop':
        return { width: 180, height: 150 };
      case 'Clock':
      case 'Voltmeter':
      case 'Ammeter':
      case 'Ohmmeter':
        return { width: 150, height: 110 };
      case 'Junction':
        return { width: 16, height: 16 };
      case 'VoltageSource':
      case 'Resistor':
      case 'Capacitor':
      case 'LED':
      case 'Switch':
      case 'Ground':
        return { width: 180, height: 130 };
      default:
        return { width: 180, height: 120 };
    }
  };

  const elkChildren = graph.components.map((comp) => {
    const dims = getComponentDimensions(comp.type);
    const meta = COMPONENT_METADATA[comp.type as ComponentType];
    const ports =
      meta?.pins.map((pin) => ({
        id: `${comp.id}_${pin.id}`,
        width: 4,
        height: 4,
        layoutOptions: {
          'elk.portConstraints': 'FIXED_SIDE',
          'elk.port.side': PIN_SIDE_TO_ELK[pin.position] || 'EAST',
        },
      })) || [];

    // Ensure any connected pin that wasn't in metadata is also present as a port
    graph.connections.forEach((conn) => {
      if (
        conn.sourceComponentId === comp.id &&
        !ports.some((p) => p.id === `${comp.id}_${conn.sourcePinId}`)
      ) {
        ports.push({
          id: `${comp.id}_${conn.sourcePinId}`,
          width: 4,
          height: 4,
          layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE', 'elk.port.side': 'EAST' },
        });
      }
      if (
        conn.targetComponentId === comp.id &&
        !ports.some((p) => p.id === `${comp.id}_${conn.targetPinId}`)
      ) {
        ports.push({
          id: `${comp.id}_${conn.targetPinId}`,
          width: 4,
          height: 4,
          layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE', 'elk.port.side': 'WEST' },
        });
      }
    });

    return {
      id: comp.id,
      width: dims.width,
      height: dims.height,
      ports,
    };
  });

  const elkEdges = graph.connections.map((conn, idx) => ({
    id: `elk_edge_${idx}_${conn.sourceComponentId}_${conn.sourcePinId}_${conn.targetComponentId}_${conn.targetPinId}`,
    sources: [`${conn.sourceComponentId}_${conn.sourcePinId}`],
    targets: [`${conn.targetComponentId}_${conn.targetPinId}`],
  }));

  const rootNode: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '160',
      'elk.spacing.nodeNode': '60',
      'elk.spacing.edgeNode': '50',
      'elk.spacing.edgeEdge': '20',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.portConstraints': 'FIXED_SIDE',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.padding': '[top=64,left=64,bottom=64,right=64]',
    },
    children: elkChildren,
    edges: elkEdges as any,
  };

  try {
    const layouted = await elk.layout(rootNode);
    const positions: Record<string, { x: number; y: number }> = {};

    if (layouted.children) {
      for (const child of layouted.children) {
        // Snap to clean 16px grid
        const rawX = child.x ?? 0;
        const rawY = child.y ?? 0;
        positions[child.id] = {
          x: Math.round(rawX / 16) * 16,
          y: Math.round(rawY / 16) * 16,
        };
      }
    }

    return positions;
  } catch (error) {
    console.error('ELK auto-layout error:', error);
    // Fallback: grid distribution if ELK fails
    const fallbackPositions: Record<string, { x: number; y: number }> = {};
    graph.components.forEach((comp, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      fallbackPositions[comp.id] = {
        x: 120 + col * 340,
        y: 120 + row * 260,
      };
    });
    return fallbackPositions;
  }
}
