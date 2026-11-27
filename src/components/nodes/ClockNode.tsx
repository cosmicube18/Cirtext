import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { CircuitNodeData } from '../../types/flow.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';
import { InlineValueEditor } from './InlineValueEditor.tsx';

/**
 * Clock generator node.
 * Renders component ID, a square-wave icon, and a live 0/1 state badge
 * with a right-side OUT output handle.
 */
export const ClockNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const isSimulating = useCircuitStore((s) => s.isSimulating);
  const clockHigh = useCircuitStore((s) => s.clockHigh);
  const pinStates = useCircuitStore((s) => s.simulationState.pinStates);
  const [isEditing, setIsEditing] = useState(false);

  const stateOut = pinStates[`${props.id}.OUT`] ?? (clockHigh ? 1 : 0);
  const outColor = isSimulating && stateOut === 1 ? '#22c55e' : '#38bdf8';
  const currentValue = data.value || 'Clock';

  return (
    <div
      style={{ width: '150px' }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`relative rounded-xl bg-slate-900/98 border transition-all duration-150 shadow-xl flex flex-col ${
        props.selected
          ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-500/20'
          : 'border-slate-700 hover:border-slate-500'
      }`}
    >
      {isEditing && (
        <InlineValueEditor
          nodeId={props.id}
          initialValue={currentValue}
          onClose={() => setIsEditing(false)}
        />
      )}

      {/* Header: ID + Component Type */}
      <div className="w-full px-2.5 pt-2 pb-1.5 border-b border-slate-800 flex items-center justify-between select-none">
        <span className="font-mono text-xs font-bold text-sky-400">
          {data.id || props.id}
        </span>
        <span
          onClick={
            props.selected
              ? (e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }
              : undefined
          }
          title="Double-click to edit value"
          className={`text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800/60 font-semibold ${
            props.selected ? 'cursor-text hover:border-sky-400' : ''
          }`}
        >
          {currentValue}
        </span>
      </div>

      {/* Square-Wave Icon + State Badge */}
      <div className="relative w-full h-[60px] flex items-center justify-center select-none">
        {/* Square-wave SVG */}
        <svg width="70" height="44" viewBox="0 0 70 44" className="overflow-visible">
          <path
            d={`M 4 16 L 20 16 L 20 28 L 34 28 L 34 16 L 48 16 L 48 28 L 66 28`}
            strokeWidth="2"
            stroke={outColor}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 4 8 L 66 8 L 66 36 L 4 36 Z"
            strokeWidth="1"
            stroke="#334155"
            fill="none"
          />
          <line x1="4" y1="16" x2="66" y2="16" strokeWidth="1" stroke="#1e293b" />
          <line x1="4" y2="28" x2="66" y1="28" strokeWidth="1" stroke="#1e293b" />
        </svg>

        {/* Live State Badge */}
        <span
          className={`absolute bottom-[-28px] left-1/2 -translate-x-1/2 text-[9px] font-mono px-1.5 py-0.2 rounded font-bold border ${
            stateOut === 1
              ? 'bg-emerald-950 text-emerald-300 border-emerald-700 shadow-sm shadow-emerald-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          OUT={stateOut}
        </span>
      </div>

      {/* Right Output Handle (OUT) */}
      <div
        className="absolute right-0 flex items-center gap-1"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        <span className="text-[9px] font-mono text-cyan-300 font-bold pr-1.5">OUT</span>
        <Handle
          type="source"
          position={Position.Right}
          id="OUT"
          style={{ right: '-6px' }}
          className={`!w-2.5 !h-2.5 !border-2 transition-all hover:!scale-125 ${
            isSimulating && stateOut === 1
              ? '!border-emerald-400 !bg-emerald-950 shadow-[0_0_8px_rgba(34,197,94,0.8)]'
              : '!border-sky-400 !bg-slate-950 hover:!bg-sky-400'
          }`}
        />
      </div>
    </div>
  );
};
