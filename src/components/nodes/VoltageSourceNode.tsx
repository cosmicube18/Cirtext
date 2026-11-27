import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode.tsx';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';

export const VoltageSourceNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const pins = COMPONENT_METADATA.VoltageSource.pins;

  return (
    <BaseNode
      id={props.id}
      title={data.id || props.id}
      subtitle={data.value || '5V'}
      editableValue={data.value || '5V'}
      selected={props.selected}
      pins={pins}
      layout="vertical"
    >
      <svg
        width="44"
        height="48"
        viewBox="0 0 44 48"
        className="stroke-slate-200 fill-none overflow-visible"
      >
        {/* Top & bottom connecting leads */}
        <line x1="22" y1="0" x2="22" y2="8" strokeWidth="2" stroke="#38bdf8" />
        <line x1="22" y1="40" x2="22" y2="48" strokeWidth="2" stroke="#38bdf8" />

        {/* Source circle body */}
        <circle
          cx="22"
          cy="24"
          r="14"
          strokeWidth="2"
          className="stroke-slate-200 fill-slate-800/80"
        />

        {/* Positive polarity symbol (+) */}
        <line x1="22" y1="15" x2="22" y2="21" strokeWidth="2" stroke="#f87171" />
        <line x1="19" y1="18" x2="25" y2="18" strokeWidth="2" stroke="#f87171" />

        {/* Negative polarity symbol (-) */}
        <line x1="19" y1="30" x2="25" y2="30" strokeWidth="2" stroke="#60a5fa" />
      </svg>
    </BaseNode>
  );
};
