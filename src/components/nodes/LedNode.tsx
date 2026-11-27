import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode.tsx';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';

/**
 * Interactive LED Schematic Node with Closed-Loop Ground Verification:
 * An LED ONLY illuminates when its anode receives HIGH (1) AND its cathode has
 * a verified return path to Ground or VoltageSource.neg (isGrounded).
 */
export const LedNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const pins = COMPONENT_METADATA.LED.pins;
  const isSimulating = useCircuitStore((s) => s.isSimulating);
  const isAnodeHigh = useCircuitStore(
    (s) => s.isSimulating && s.simulationState.pinStates[`${props.id}.anode`] === 1
  );
  const isCathodeGrounded = useCircuitStore(
    (s) => s.isSimulating && Boolean(s.simulationState.isGrounded?.[`${props.id}.cathode`])
  );
  const isLit = useCircuitStore(
    (s) => s.isSimulating && Boolean(s.simulationState.ledStates[props.id]) && isCathodeGrounded
  );

  return (
    <BaseNode
      id={props.id}
      title={data.id || props.id}
      editableValue={data.value || 'Red'}
      subtitle={
        isSimulating ? (
          isLit ? (
            <span
              className="font-mono text-[10px] font-bold px-1 py-0.5 rounded border bg-rose-950/80 text-rose-300 border-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse select-none"
              title="Illuminated: Closed loop active (Anode=HIGH, Cathode=GROUNDED)"
            >
              ON
            </span>
          ) : isAnodeHigh && !isCathodeGrounded ? (
            <span
              className="font-mono text-[10px] font-bold px-1 py-0.5 rounded border bg-amber-950/80 text-amber-300 border-amber-600/80 select-none"
              title="Open Loop: Anode is HIGH but Cathode has no ground return path"
            >
              NO GND
            </span>
          ) : (
            <span
              className="font-mono text-[10px] font-bold px-1 py-0.5 rounded border bg-slate-800 text-slate-400 border-slate-700 select-none"
              title="Unpowered: Anode is LOW"
            >
              OFF
            </span>
          )
        ) : (
          data.value || 'Red'
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
        <defs>
          <radialGradient id={`led-glow-${props.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#f43f5e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Radial glow background when illuminated */}
        {isLit && (
          <circle
            cx="32"
            cy="18"
            r="20"
            fill={`url(#led-glow-${props.id})`}
            className="animate-pulse"
          />
        )}

        {/* Anode lead (left) */}
        <line
          x1="0"
          y1="18"
          x2="20"
          y2="18"
          strokeWidth="2"
          stroke={isAnodeHigh ? '#22c55e' : '#38bdf8'}
        />

        {/* Diode Triangle (Anode) */}
        <polygon
          points="20,4 20,32 44,18"
          className={
            isLit
              ? 'fill-rose-500 stroke-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.9)]'
              : 'fill-rose-500/80 stroke-rose-400'
          }
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Cathode Bar (vertical line) */}
        <line
          x1="44"
          y1="4"
          x2="44"
          y2="32"
          strokeWidth="2.5"
          className={isLit ? 'stroke-rose-200' : 'stroke-rose-400'}
          strokeLinecap="round"
        />

        {/* Cathode lead (right) */}
        <line
          x1="44"
          y1="18"
          x2="80"
          y2="18"
          strokeWidth="2"
          stroke={isSimulating ? (isCathodeGrounded ? '#38bdf8' : '#475569') : '#38bdf8'}
        />

        {/* Photon emission arrows (up & right) */}
        <g
          className={
            isLit
              ? 'stroke-amber-300 stroke-[2.2] drop-shadow-[0_0_4px_rgba(252,211,77,0.9)]'
              : 'stroke-amber-300/60 stroke-[1.8]'
          }
          strokeLinecap="round"
        >
          {/* Arrow 1 */}
          <line x1="50" y1="12" x2="61" y2="4" />
          <polyline points="56,4 61,4 61,9" fill="none" />

          {/* Arrow 2 */}
          <line x1="56" y1="18" x2="67" y2="10" />
          <polyline points="62,10 67,10 67,15" fill="none" />
        </g>
      </svg>
    </BaseNode>
  );
};
