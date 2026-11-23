import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode.tsx';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';

export const SwitchNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const pins = COMPONENT_METADATA.Switch.pins;

  return (
    <BaseNode
      id={props.id}
      title={data.id || props.id}
      subtitle={data.value || 'SPST'}
      selected={props.selected}
      pins={pins}
    >
      <svg
        width="76"
        height="36"
        viewBox="0 0 76 36"
        className="stroke-slate-200 fill-none"
      >
        {/* Left terminal lead */}
        <line x1="0" y1="18" x2="22" y2="18" strokeWidth="2" stroke="#38bdf8" />
        {/* Left terminal contact circle */}
        <circle cx="24" cy="18" r="3" strokeWidth="2" className="stroke-sky-400 fill-slate-900" />

        {/* Angled switch blade (open position) */}
        <line
          x1="26"
          y1="16"
          x2="50"
          y2="6"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-amber-400"
        />

        {/* Right terminal contact circle */}
        <circle cx="52" cy="18" r="3" strokeWidth="2" className="stroke-sky-400 fill-slate-900" />
        {/* Right terminal lead */}
        <line x1="55" y1="18" x2="76" y2="18" strokeWidth="2" stroke="#38bdf8" />
      </svg>
    </BaseNode>
  );
};
