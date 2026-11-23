import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode.tsx';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';

export const LedNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const pins = COMPONENT_METADATA.LED.pins;

  return (
    <BaseNode
      id={props.id}
      title={data.id || props.id}
      subtitle={data.value || 'Red'}
      selected={props.selected}
      pins={pins}
    >
      <svg
        width="76"
        height="48"
        viewBox="0 0 76 48"
        className="stroke-slate-200 fill-none"
      >
        {/* Anode lead (left) */}
        <line x1="0" y1="24" x2="24" y2="24" strokeWidth="2" stroke="#38bdf8" />

        {/* Diode Triangle (Anode) */}
        <polygon
          points="24,12 24,36 44,24"
          className="fill-rose-500/80 stroke-rose-400"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Cathode Bar (vertical line) */}
        <line x1="44" y1="12" x2="44" y2="36" strokeWidth="2.5" className="stroke-rose-400" strokeLinecap="round" />

        {/* Cathode lead (right) */}
        <line x1="44" y1="24" x2="76" y2="24" strokeWidth="2" stroke="#38bdf8" />

        {/* Photon emission arrows (up & right) */}
        <g className="stroke-amber-300 stroke-[1.8]" strokeLinecap="round">
          {/* Arrow 1 */}
          <line x1="36" y1="10" x2="48" y2="2" />
          <polyline points="43,2 48,2 48,7" fill="none" />

          {/* Arrow 2 */}
          <line x1="44" y1="14" x2="56" y2="6" />
          <polyline points="51,6 56,6 56,11" fill="none" />
        </g>
      </svg>
    </BaseNode>
  );
};
