import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode.tsx';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';

export const BuzzerNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const pins = COMPONENT_METADATA.Buzzer.pins;
  const isSimulating = useCircuitStore((s) => s.isSimulating);
  const isOn = useCircuitStore(
    (s) => s.isSimulating && Boolean(s.simulationState.buzzerStates?.[props.id])
  );

  return (
    <BaseNode
      id={props.id}
      title={data.id || props.id}
      editableValue={data.value || 'Piezo'}
      subtitle={
        isSimulating ? (
          isOn ? (
            <span
              className="font-mono text-[10px] font-bold px-1 py-0.5 rounded border bg-amber-950/80 text-amber-300 border-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse select-none"
              title="Buzzer sounding"
            >
              ON
            </span>
          ) : (
            <span
              className="font-mono text-[10px] font-bold px-1 py-0.5 rounded border bg-slate-800 text-slate-400 border-slate-700 select-none"
              title="Buzzer silent"
            >
              OFF
            </span>
          )
        ) : (
          data.value || 'Piezo'
        )
      }
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
        <circle cx="28" cy="18" r="14" className={isOn ? 'stroke-amber-300 fill-amber-900/60' : 'stroke-slate-400 fill-slate-800/60'} strokeWidth="2" />
        <circle cx="28" cy="18" r="5" className={isOn ? 'stroke-amber-200 fill-amber-400' : 'stroke-slate-500 fill-slate-700'} strokeWidth="2" />
        <line x1="0" y1="18" x2="14" y2="18" strokeWidth="2" stroke="#38bdf8" />
        <line x1="42" y1="18" x2="80" y2="18" strokeWidth="2" stroke="#38bdf8" />
        {isOn && (
          <>
            <path d="M48,10 Q56,18 48,26" className="stroke-amber-300" strokeWidth="2" fill="none" />
            <path d="M54,5 Q64,18 54,31" className="stroke-amber-300/70" strokeWidth="2" fill="none" />
          </>
        )}
      </svg>
    </BaseNode>
  );
};
