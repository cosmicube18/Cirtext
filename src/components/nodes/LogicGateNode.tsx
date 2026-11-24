import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { CircuitNodeData } from '../../types/flow.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';

/**
 * Renders IEEE standard schematic symbols for logic gates:
 * AND, OR, NOT, NAND, NOR, XOR, XNOR.
 * Displays interactive live logic states (0 / 1) in Simulation mode.
 */
export const LogicGateNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const gateType = (data.componentType || 'AND').toUpperCase();
  const isNotGate = gateType === 'NOT';

  const isSimulating = useCircuitStore((s) => s.isSimulating);
  const pinStates = useCircuitStore((s) => s.simulationState.pinStates);

  const stateA = pinStates[`${props.id}.A`] ?? 0;
  const stateB = pinStates[`${props.id}.B`] ?? 0;
  const stateY = pinStates[`${props.id}.Y`] ?? 0;

  const outColor = isSimulating && stateY === 1 ? '#22c55e' : '#38bdf8';

  const renderGateSymbol = () => {
    switch (gateType) {
      case 'AND':
        return (
          <g>
            <line x1="0" y1="16" x2="20" y2="16" strokeWidth="2" stroke={isSimulating && stateA === 1 ? '#22c55e' : '#38bdf8'} />
            <line x1="0" y1="34" x2="20" y2="34" strokeWidth="2" stroke={isSimulating && stateB === 1 ? '#22c55e' : '#38bdf8'} />
            <path
              d="M 20 8 L 38 8 A 17 17 0 0 1 38 42 L 20 42 Z"
              strokeWidth="2.2"
              stroke="#38bdf8"
              fill="#1e293b"
              strokeLinejoin="round"
            />
            <line x1="55" y1="25" x2="80" y2="25" strokeWidth="2.2" stroke={outColor} />
          </g>
        );

      case 'NAND':
        return (
          <g>
            <line x1="0" y1="16" x2="20" y2="16" strokeWidth="2" stroke={isSimulating && stateA === 1 ? '#22c55e' : '#38bdf8'} />
            <line x1="0" y1="34" x2="20" y2="34" strokeWidth="2" stroke={isSimulating && stateB === 1 ? '#22c55e' : '#38bdf8'} />
            <path
              d="M 20 8 L 36 8 A 17 17 0 0 1 36 42 L 20 42 Z"
              strokeWidth="2.2"
              stroke="#38bdf8"
              fill="#1e293b"
              strokeLinejoin="round"
            />
            <circle cx="56" cy="25" r="3.5" strokeWidth="2" stroke={outColor} fill="#0f172a" />
            <line x1="59.5" y1="25" x2="80" y2="25" strokeWidth="2.2" stroke={outColor} />
          </g>
        );

      case 'OR':
        return (
          <g>
            <line x1="0" y1="16" x2="24" y2="16" strokeWidth="2" stroke={isSimulating && stateA === 1 ? '#22c55e' : '#38bdf8'} />
            <line x1="0" y1="34" x2="24" y2="34" strokeWidth="2" stroke={isSimulating && stateB === 1 ? '#22c55e' : '#38bdf8'} />
            <path
              d="M 18 8 Q 28 25 18 42 Q 38 42 56 25 Q 38 8 18 8 Z"
              strokeWidth="2.2"
              stroke="#38bdf8"
              fill="#1e293b"
              strokeLinejoin="round"
            />
            <line x1="56" y1="25" x2="80" y2="25" strokeWidth="2.2" stroke={outColor} />
          </g>
        );

      case 'NOR':
        return (
          <g>
            <line x1="0" y1="16" x2="24" y2="16" strokeWidth="2" stroke={isSimulating && stateA === 1 ? '#22c55e' : '#38bdf8'} />
            <line x1="0" y1="34" x2="24" y2="34" strokeWidth="2" stroke={isSimulating && stateB === 1 ? '#22c55e' : '#38bdf8'} />
            <path
              d="M 18 8 Q 28 25 18 42 Q 38 42 53 25 Q 38 8 18 8 Z"
              strokeWidth="2.2"
              stroke="#38bdf8"
              fill="#1e293b"
              strokeLinejoin="round"
            />
            <circle cx="56.5" cy="25" r="3.5" strokeWidth="2" stroke={outColor} fill="#0f172a" />
            <line x1="60" y1="25" x2="80" y2="25" strokeWidth="2.2" stroke={outColor} />
          </g>
        );

      case 'XOR':
        return (
          <g>
            <line x1="0" y1="16" x2="16" y2="16" strokeWidth="2" stroke={isSimulating && stateA === 1 ? '#22c55e' : '#38bdf8'} />
            <line x1="0" y1="34" x2="16" y2="34" strokeWidth="2" stroke={isSimulating && stateB === 1 ? '#22c55e' : '#38bdf8'} />
            <path
              d="M 12 8 Q 22 25 12 42"
              strokeWidth="2.2"
              stroke="#38bdf8"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 18 8 Q 28 25 18 42 Q 38 42 56 25 Q 38 8 18 8 Z"
              strokeWidth="2.2"
              stroke="#38bdf8"
              fill="#1e293b"
              strokeLinejoin="round"
            />
            <line x1="56" y1="25" x2="80" y2="25" strokeWidth="2.2" stroke={outColor} />
          </g>
        );

      case 'XNOR':
        return (
          <g>
            <line x1="0" y1="16" x2="16" y2="16" strokeWidth="2" stroke={isSimulating && stateA === 1 ? '#22c55e' : '#38bdf8'} />
            <line x1="0" y1="34" x2="16" y2="34" strokeWidth="2" stroke={isSimulating && stateB === 1 ? '#22c55e' : '#38bdf8'} />
            <path
              d="M 12 8 Q 22 25 12 42"
              strokeWidth="2.2"
              stroke="#38bdf8"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 18 8 Q 28 25 18 42 Q 38 42 53 25 Q 38 8 18 8 Z"
              strokeWidth="2.2"
              stroke="#38bdf8"
              fill="#1e293b"
              strokeLinejoin="round"
            />
            <circle cx="56.5" cy="25" r="3.5" strokeWidth="2" stroke={outColor} fill="#0f172a" />
            <line x1="60" y1="25" x2="80" y2="25" strokeWidth="2.2" stroke={outColor} />
          </g>
        );

      case 'NOT':
      default:
        return (
          <g>
            <line x1="0" y1="25" x2="22" y2="25" strokeWidth="2" stroke={isSimulating && stateA === 1 ? '#22c55e' : '#38bdf8'} />
            <polygon
              points="22,10 22,40 48,25"
              strokeWidth="2.2"
              stroke="#38bdf8"
              fill="#1e293b"
              strokeLinejoin="round"
            />
            <circle cx="51.5" cy="25" r="3.5" strokeWidth="2" stroke={outColor} fill="#0f172a" />
            <line x1="55" y1="25" x2="80" y2="25" strokeWidth="2.2" stroke={outColor} />
          </g>
        );
    }
  };

  return (
    <div
      style={{ width: '160px' }}
      className={`relative rounded-xl bg-slate-900/98 border transition-all duration-150 shadow-xl flex flex-col ${
        props.selected
          ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-500/20'
          : 'border-slate-700 hover:border-slate-500'
      }`}
    >
      {/* Header: ID, Gate Type, and Output Level */}
      <div className="w-full px-2.5 pt-2 pb-1.5 border-b border-slate-800 flex items-center justify-between select-none">
        <span className="font-mono text-xs font-bold text-sky-400">
          {data.id || props.id}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800/60 font-semibold">
            {gateType}
          </span>
          {isSimulating && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold border ${
                stateY === 1
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700 shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              Y={stateY}
            </span>
          )}
        </div>
      </div>

      {/* Symbol Container & Pin Handles */}
      <div className="relative w-full h-[66px] flex items-center justify-center select-none">
        {/* Left Input Handles */}
        {isNotGate ? (
          /* Single Input for NOT gate */
          <div
            className="absolute left-0 flex items-center gap-1"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            <Handle
              type="source"
              position={Position.Left}
              id="A"
              style={{ left: '-6px' }}
              className="!w-2.5 !h-2.5 !border-2 !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
            />
            <span className="text-[9px] font-mono text-slate-400 pl-1.5">A</span>
            {isSimulating && (
              <span
                className={`text-[9px] font-mono px-1 rounded font-bold ${
                  stateA === 1
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {stateA}
              </span>
            )}
          </div>
        ) : (
          /* Dual Inputs (A, B) for 2-input gates */
          <>
            {/* Input A (Top-Left) */}
            <div
              className="absolute left-0 flex items-center gap-1"
              style={{ top: '32%', transform: 'translateY(-50%)' }}
            >
              <Handle
                type="source"
                position={Position.Left}
                id="A"
                style={{ left: '-6px' }}
                className="!w-2.5 !h-2.5 !border-2 !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
              />
              <span className="text-[9px] font-mono text-slate-400 pl-1.5">A</span>
              {isSimulating && (
                <span
                  className={`text-[9px] font-mono px-1 rounded font-bold ${
                    stateA === 1
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {stateA}
                </span>
              )}
            </div>

            {/* Input B (Bottom-Left) */}
            <div
              className="absolute left-0 flex items-center gap-1"
              style={{ top: '68%', transform: 'translateY(-50%)' }}
            >
              <Handle
                type="source"
                position={Position.Left}
                id="B"
                style={{ left: '-6px' }}
                className="!w-2.5 !h-2.5 !border-2 !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
              />
              <span className="text-[9px] font-mono text-slate-400 pl-1.5">B</span>
              {isSimulating && (
                <span
                  className={`text-[9px] font-mono px-1 rounded font-bold ${
                    stateB === 1
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {stateB}
                </span>
              )}
            </div>
          </>
        )}

        {/* Center SVG Schematic Graphic */}
        <svg
          width="80"
          height="50"
          viewBox="0 0 80 50"
          className="overflow-visible"
        >
          {renderGateSymbol()}
        </svg>

        {/* Right Output Handle (Y) */}
        <div
          className="absolute right-0 flex items-center gap-1"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        >
          {isSimulating && (
            <span
              className={`text-[9px] font-mono px-1 rounded font-bold ${
                stateY === 1
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-sm shadow-emerald-500/30'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {stateY}
            </span>
          )}
          <span className="text-[9px] font-mono text-cyan-300 font-bold pr-1.5">Y</span>
          <Handle
            type="source"
            position={Position.Right}
            id="Y"
            style={{ right: '-6px' }}
            className={`!w-2.5 !h-2.5 !border-2 transition-all hover:!scale-125 ${
              isSimulating && stateY === 1
                ? '!border-emerald-400 !bg-emerald-950 shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                : '!border-sky-400 !bg-slate-950 hover:!bg-sky-400'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
