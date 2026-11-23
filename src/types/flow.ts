import type { Node, Edge } from '@xyflow/react';
import type { ComponentType } from './circuit.ts';

export interface CircuitNodeData extends Record<string, unknown> {
  id: string; // e.g. "V1", "R1", "GND"
  componentType: ComponentType;
  value?: string;
  label?: string;
  rotation?: 0 | 90 | 180 | 270;
}

export type CircuitNode = Node<CircuitNodeData>;
export type CircuitEdge = Edge<{ netLabel?: string }>;
