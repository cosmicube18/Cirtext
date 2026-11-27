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
    >
      <svg
        width="60"
        height="64"
        viewBox="0 0 60 64"
        className="stroke-slate-200 fill-none"
      >
        {/* Top & bottom connecting leads */}
        <line x1="30" y1="0" x2="30" y2="12" strokeWidth="2" stroke="#38bdf8" />
        <line x1="30" y1="52" x2="30" y2="64" strokeWidth="2" stroke="#38bdf8" />

        {/* Source circle body */}
        <circle
          cx="30"
          cy="32"
          r="20"
          strokeWidth="2"
          className="stroke-slate-200 fill-slate-800/80"
        />

        {/* Positive polarity symbol (+) */}
        <line x1="30" y1="20" x2="30" y2="28" strokeWidth="2" stroke="#f87171" />
        <line x1="26" y1="24" x2="34" y2="24" strokeWidth="2" stroke="#f87171" />

        {/* Negative polarity symbol (-) */}
        <line x1="26" y1="40" x2="34" y2="40" strokeWidth="2" stroke="#60a5fa" />
      </svg>
    </BaseNode>
  );
};
