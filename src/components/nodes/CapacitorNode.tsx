import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode.tsx';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';

export const CapacitorNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const pins = COMPONENT_METADATA.Capacitor.pins;

  return (
    <BaseNode
      id={props.id}
      title={data.id || props.id}
      subtitle={data.value || '100uF'}
      selected={props.selected}
      pins={pins}
    >
      <svg
        width="70"
        height="40"
        viewBox="0 0 70 40"
        className="stroke-slate-200 fill-none"
      >
        {/* Left terminal lead to plate 1 */}
        <line x1="0" y1="20" x2="31" y2="20" strokeWidth="2" stroke="#38bdf8" />
        {/* Plate 1 */}
        <line x1="31" y1="6" x2="31" y2="34" strokeWidth="2.75" className="stroke-cyan-300" strokeLinecap="round" />

        {/* Plate 2 */}
        <line x1="39" y1="6" x2="39" y2="34" strokeWidth="2.75" className="stroke-cyan-300" strokeLinecap="round" />
        {/* Right terminal lead from plate 2 */}
        <line x1="39" y1="20" x2="70" y2="20" strokeWidth="2" stroke="#38bdf8" />
      </svg>
    </BaseNode>
  );
};
