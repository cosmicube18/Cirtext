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
        return { width: 240, height: 460 };
      case 'OLED_SSD1306':
        return { width: 200, height: 180 };
      case 'SCD41':
      case 'BH1750':
      case 'SHT31':
        return { width: 180, height: 180 };
      case 'Switch':
        return { width: 110, height: 70 };
      default:
        return { width: 110, height: 80 };
    }
  };

  const elkChildren = graph.components.map((comp) => {
    const dims = getComponentDimensions(comp.type);
    const meta = COMPONENT_METADATA[comp.type as ComponentType];
    const ports = meta?.pins.map((pin) => ({
      id: pin.id,
      width: 4,
      height: 4,
      layoutOptions: {
        'elk.portConstraints': 'FIXED_SIDE',
        'elk.port.side': PIN_SIDE_TO_ELK[pin.position],
      },
    })) || [];

    return {
      id: comp.id,
      width: dims.width,
      height: dims.height,
      ports,
    };
  });

  const elkEdges = graph.connections.map((conn) => ({
    id: `elk_edge_${conn.sourceComponentId}_${conn.sourcePinId}_${conn.targetComponentId}_${conn.targetPinId}`,
    source: conn.sourceComponentId,
    sourcePort: conn.sourcePinId,
    target: conn.targetComponentId,
    targetPort: conn.targetPinId,
  }));

  const rootNode: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '140',
      'elk.spacing.nodeNode': '90',
      'elk.spacing.edgeNode': '40',
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
      fallbackPositions[comp.id] = {
        x: 80 + (idx % 3) * 160,
        y: 80 + Math.floor(idx / 3) * 120,
      };
    });
    return fallbackPositions;
  }
}
