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
      subtitle={
        isSimulating ? (
          isOn ? (
            <span
              className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-950/80 text-amber-300 border-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse select-none"
              title="Buzzer sounding"
            >
              ON
            </span>
          ) : (
            <span
              className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border bg-slate-800 text-slate-400 border-slate-700 select-none"
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
    >
      <svg
        width="76"
        height="48"
        viewBox="0 0 76 48"
        className="stroke-slate-200 fill-none"
      >
        <circle cx="30" cy="24" r="16" className={isOn ? 'stroke-amber-300 fill-amber-900/60' : 'stroke-slate-400 fill-slate-800/60'} strokeWidth="2" />
        <circle cx="30" cy="24" r="6" className={isOn ? 'stroke-amber-200 fill-amber-400' : 'stroke-slate-500 fill-slate-700'} strokeWidth="2" />
        <line x1="0" y1="24" x2="14" y2="24" strokeWidth="2" stroke="#38bdf8" />
        <line x1="46" y1="24" x2="76" y2="24" strokeWidth="2" stroke="#38bdf8" />
        {isOn && (
          <>
            <path d="M52,12 Q60,24 52,36" className="stroke-amber-300" strokeWidth="2" fill="none" />
            <path d="M58,6 Q70,24 58,42" className="stroke-amber-300/70" strokeWidth="2" fill="none" />
          </>
        )}
      </svg>
    </BaseNode>
  );
};