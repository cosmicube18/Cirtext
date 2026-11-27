import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode.tsx';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';

export const ResistorNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const pins = COMPONENT_METADATA.Resistor.pins;

  return (
    <BaseNode
      id={props.id}
      title={data.id || props.id}
      subtitle={data.value || '10k'}
      editableValue={data.value || '10k'}
      selected={props.selected}
      pins={pins}
      layout="horizontal"
    >
      <svg
        width="80"
        height="36"
        viewBox="0 0 80 36"
        className="stroke-slate-200 fill-none overflow-visible"
      >
        {/* Left & right leads */}
        <line x1="0" y1="18" x2="12" y2="18" strokeWidth="2" stroke="#38bdf8" />
        <line x1="68" y1="18" x2="80" y2="18" strokeWidth="2" stroke="#38bdf8" />

        {/* Standard IEEE zig-zag resistor symbol */}
        <polyline
          points="12,18 16,6 24,30 32,6 40,30 48,6 56,30 64,6 68,18"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-amber-400"
        />
      </svg>
    </BaseNode>
  );
};
