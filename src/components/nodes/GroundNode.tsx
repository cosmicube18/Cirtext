import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode.tsx';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';

export const GroundNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const pins = COMPONENT_METADATA.Ground.pins;

  return (
    <BaseNode
      id={props.id}
      title={data.id || props.id}
      subtitle={data.value}
      selected={props.selected}
      pins={pins}
    >
      <svg
        width="56"
        height="44"
        viewBox="0 0 56 44"
        className="stroke-emerald-400 fill-none"
      >
        {/* Top lead */}
        <line x1="28" y1="0" x2="28" y2="16" strokeWidth="2" stroke="#38bdf8" />

        {/* Earth Ground descending horizontal plates */}
        <line x1="12" y1="16" x2="44" y2="16" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="18" y1="24" x2="38" y2="24" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="24" y1="32" x2="32" y2="32" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </BaseNode>
  );
};
