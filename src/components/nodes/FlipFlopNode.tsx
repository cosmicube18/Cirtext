import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { CircuitNodeData } from '../../types/flow.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';

/**
 * Custom Schematic Node for Sequential Logic Flip-Flops:
 * Supports D_FlipFlop (D, CLK -> Q, Q_BAR) and JK_FlipFlop (J, CLK, K -> Q, Q_BAR)
 * with clock dynamic wedge graphics (>) and real-time state visualization.
 */
export const FlipFlopNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const isJK = data.componentType === 'JK_FlipFlop';
  const typeTitle = isJK ? 'JK FLIP-FLOP' : 'D FLIP-FLOP';

  const isSimulating = useCircuitStore((s) => s.isSimulating);
  const pinStates = useCircuitStore((s) => s.simulationState.pinStates);

  // Read input states during simulation
  const stateClk = pinStates[`${props.id}.CLK`] ?? 0;
  const stateD = pinStates[`${props.id}.D`] ?? 0;
  const stateJ = pinStates[`${props.id}.J`] ?? 0;
  const stateK = pinStates[`${props.id}.K`] ?? 0;

  // Read output states during simulation (default: Q=0, Q_BAR=1)
  const stateQ = pinStates[`${props.id}.Q`] ?? 0;
  const stateQBar = pinStates[`${props.id}.Q_BAR`] ?? 1;

  return (
    <div
      style={{ width: '180px', height: '150px' }}
      className={`relative rounded-xl bg-slate-900/98 border transition-all duration-150 shadow-2xl flex flex-col justify-between ${
        props.selected
          ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-500/20'
          : 'border-slate-700 hover:border-slate-500'
      }`}
    >
      {/* Header: Component ID & Type Badge */}
      <div className="w-full px-2.5 pt-2 pb-1.5 border-b border-slate-800 flex items-center justify-between select-none">
        <span className="font-mono text-xs font-bold text-sky-400">
          {data.id || props.id}
        </span>
        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800/60 font-semibold tracking-wide">
          {typeTitle}
        </span>
      </div>

      {/* Main Schematic Body with Left/Right Pins */}
      <div className="relative flex-1 w-full px-3 py-2 flex justify-between select-none">
        {/* Left Inputs Column */}
        <div className="flex flex-col justify-around h-full">
          {isJK ? (
            <>
              {/* Pin J */}
              <div className="relative flex items-center gap-1.5">
                <Handle
                  type="source"
                  position={Position.Left}
                  id="J"
                  style={{ left: '-18px' }}
                  className="!w-2.5 !h-2.5 !border-2 !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
                />
                <span className="text-[11px] font-mono font-bold text-slate-200">J</span>
                {isSimulating && (
                  <span
                    className={`text-[9px] font-mono px-1 rounded font-bold ${
                      stateJ === 1
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {stateJ}
                  </span>
                )}
              </div>

              {/* Pin CLK with clock triangle graphic (>) */}
              <div className="relative flex items-center gap-1">
                <Handle
                  type="source"
                  position={Position.Left}
                  id="CLK"
                  style={{ left: '-18px' }}
                  className="!w-2.5 !h-2.5 !border-2 !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
                />
                <svg width="10" height="12" viewBox="0 0 10 12" className="stroke-sky-400 fill-none stroke-[1.8]">
                  <polyline points="0,1 8,6 0,11" />
                </svg>
                <span className="text-[10px] font-mono font-bold text-slate-300">CLK</span>
                {isSimulating && (
                  <span
                    className={`text-[9px] font-mono px-1 rounded font-bold ${
                      stateClk === 1
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {stateClk}
                  </span>
                )}
              </div>

              {/* Pin K */}
              <div className="relative flex items-center gap-1.5">
                <Handle
                  type="source"
                  position={Position.Left}
                  id="K"
                  style={{ left: '-18px' }}
                  className="!w-2.5 !h-2.5 !border-2 !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
                />
                <span className="text-[11px] font-mono font-bold text-slate-200">K</span>
                {isSimulating && (
                  <span
                    className={`text-[9px] font-mono px-1 rounded font-bold ${
                      stateK === 1
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {stateK}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Pin D */}
              <div className="relative flex items-center gap-1.5">
                <Handle
                  type="source"
                  position={Position.Left}
                  id="D"
                  style={{ left: '-18px' }}
                  className="!w-2.5 !h-2.5 !border-2 !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
                />
                <span className="text-[11px] font-mono font-bold text-slate-200">D</span>
                {isSimulating && (
                  <span
                    className={`text-[9px] font-mono px-1 rounded font-bold ${
                      stateD === 1
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {stateD}
                  </span>
                )}
              </div>

              {/* Pin CLK with clock triangle graphic (>) */}
              <div className="relative flex items-center gap-1">
                <Handle
                  type="source"
                  position={Position.Left}
                  id="CLK"
                  style={{ left: '-18px' }}
                  className="!w-2.5 !h-2.5 !border-2 !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
                />
                <svg width="10" height="12" viewBox="0 0 10 12" className="stroke-sky-400 fill-none stroke-[1.8]">
                  <polyline points="0,1 8,6 0,11" />
                </svg>
                <span className="text-[10px] font-mono font-bold text-slate-300">CLK</span>
                {isSimulating && (
                  <span
                    className={`text-[9px] font-mono px-1 rounded font-bold ${
                      stateClk === 1
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {stateClk}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Center Schematic IC Divider Graphic */}
        <div className="flex flex-col items-center justify-center opacity-30 pointer-events-none">
          <div className="w-px h-full bg-slate-700 border-dashed" />
        </div>

        {/* Right Outputs Column */}
        <div className="flex flex-col justify-around h-full items-end">
          {/* Output Q */}
          <div className="relative flex items-center gap-1.5">
            {isSimulating && (
              <span
                className={`text-[9px] font-mono px-1 rounded font-bold ${
                  stateQ === 1
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-sm shadow-emerald-500/30'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {stateQ}
              </span>
            )}
            <span className="text-[11px] font-mono font-bold text-cyan-300">Q</span>
            <Handle
              type="source"
              position={Position.Right}
              id="Q"
              style={{ right: '-18px' }}
              className={`!w-2.5 !h-2.5 !border-2 transition-all hover:!scale-125 ${
                isSimulating && stateQ === 1
                  ? '!border-emerald-400 !bg-emerald-950 shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                  : '!border-sky-400 !bg-slate-950 hover:!bg-sky-400'
              }`}
            />
          </div>

          {/* Output Q_BAR (Q̄) */}
          <div className="relative flex items-center gap-1.5">
            {isSimulating && (
              <span
                className={`text-[9px] font-mono px-1 rounded font-bold ${
                  stateQBar === 1
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-sm shadow-emerald-500/30'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {stateQBar}
              </span>
            )}
            <span className="text-[11px] font-mono font-bold text-cyan-300">Q̄</span>
            <Handle
              type="source"
              position={Position.Right}
              id="Q_BAR"
              style={{ right: '-18px' }}
              className={`!w-2.5 !h-2.5 !border-2 transition-all hover:!scale-125 ${
                isSimulating && stateQBar === 1
                  ? '!border-emerald-400 !bg-emerald-950 shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                  : '!border-sky-400 !bg-slate-950 hover:!bg-sky-400'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Footer Pin Labels Guide */}
      <div className="px-2.5 py-1 border-t border-slate-800/80 bg-slate-950/40 rounded-b-xl flex items-center justify-between text-[9px] font-mono text-slate-400 select-none">
        <span>IN: {isJK ? 'J, CLK, K' : 'D, CLK'}</span>
        <span>OUT: Q, Q̄</span>
      </div>
    </div>
  );
};
