import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode.tsx';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';

export const SwitchNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const pins = COMPONENT_METADATA.Switch.pins;
  const isClosed = useCircuitStore((s) => s.switchStates[props.id] ?? false);
  const toggleSwitch = useCircuitStore((s) => s.toggleSwitch);

  return (
    <div
      onClick={() => {
        // Allow ReactFlow to select the node (so the delete button can appear)
        // without toggling the switch on every click. Toggle only when the node
        // is not already selected.
        if (!props.selected) {
          toggleSwitch(props.id);
        }
      }}
      className="cursor-pointer"
      title={`Click to toggle switch (${isClosed ? 'CLOSED' : 'OPEN'})`}
    >
      <BaseNode
        id={props.id}
        title={data.id || props.id}
        subtitle={
          <span
            className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors select-none ${
              isClosed
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80 shadow-sm shadow-emerald-500/20'
                : 'bg-amber-950/60 text-amber-400 border-amber-800/60'
            }`}
          >
            {isClosed ? 'CLOSED' : 'OPEN'}
          </span>
        }
        selected={props.selected}
        pins={pins}
      >
        <svg
          width="76"
          height="36"
          viewBox="0 0 76 36"
          className="stroke-slate-200 fill-none select-none transition-all"
        >
          {/* Left terminal lead */}
          <line x1="0" y1="18" x2="22" y2="18" strokeWidth="2" stroke="#38bdf8" />
          {/* Left terminal contact circle */}
          <circle cx="24" cy="18" r="3" strokeWidth="2" className="stroke-sky-400 fill-slate-900" />

          {/* Switch blade */}
          {isClosed ? (
            /* Closed position: horizontal connection bridging pins 1 and 2 */
            <line
              x1="24"
              y1="18"
              x2="52"
              y2="18"
              strokeWidth="2.8"
              strokeLinecap="round"
              stroke="#22c55e"
              className="drop-shadow-[0_0_4px_rgba(34,197,94,0.8)]"
            />
          ) : (
            /* Open position: angled lever */
            <line
              x1="26"
              y1="16"
              x2="50"
              y2="6"
              strokeWidth="2.5"
              strokeLinecap="round"
              stroke="#f59e0b"
            />
          )}

          {/* Right terminal contact circle */}
          <circle cx="52" cy="18" r="3" strokeWidth="2" className="stroke-sky-400 fill-slate-900" />
          {/* Right terminal lead */}
          <line x1="55" y1="18" x2="76" y2="18" strokeWidth="2" stroke="#38bdf8" />
        </svg>
      </BaseNode>
    </div>
  );
};
