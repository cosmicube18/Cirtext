import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';

/**
 * Reusable dynamic multi-pin module node for I2C sensors (SCD41, BH1750, SHT31).
 * Every pin row is its own relative flex container with the Handle anchored directly inside at top: 50%.
 */
export const MultiPinModuleNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const meta = COMPONENT_METADATA[data.componentType];

  const leftPins = meta?.pins.filter((p) => p.position === 'left') || [];
  const rightPins = meta?.pins.filter((p) => p.position === 'right') || [];
  const maxRows = Math.max(leftPins.length, rightPins.length, 2);

  const getPinColor = (pinId: string) => {
    if (pinId === 'VCC') return 'text-rose-400 font-semibold';
    if (pinId === 'GND') return 'text-slate-400 font-semibold';
    if (pinId === 'SDA' || pinId === 'SCL') return 'text-cyan-300 font-bold';
    return 'text-amber-300 font-medium';
  };

  return (
    <div
      style={{ width: '170px' }}
      className={`relative rounded-xl bg-slate-900/98 border transition-all duration-150 shadow-xl flex flex-col ${
        props.selected
          ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-500/20'
          : 'border-slate-700 hover:border-slate-500'
      }`}
    >
      {/* Module Header */}
      <div className="w-full px-3 pt-2 pb-1.5 border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex flex-col">
          <span className="font-mono text-xs font-bold text-sky-400">
            {data.id || props.id}
          </span>
          <span className="text-[10px] font-mono text-slate-400 leading-tight">
            {data.componentType}
          </span>
        </div>
        {data.value && (
          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {data.value}
          </span>
        )}
      </div>

      {/* Pin Rows: Paired Left & Right */}
      <div className="w-full py-1.5 flex flex-col select-none">
        {Array.from({ length: maxRows }).map((_, index) => {
          const leftPin = leftPins[index];
          const rightPin = rightPins[index];

          return (
            <div
              key={index}
              className="relative flex items-center justify-between h-6 px-3 hover:bg-slate-800/40"
            >
              {/* Left Pin Terminal + Handle */}
              {leftPin ? (
                <div className="relative flex items-center">
                  <Handle
                    type="source"
                    position={Position.Left}
                    id={leftPin.id}
                    style={{ top: '50%', transform: 'translateY(-50%)', left: '-6px' }}
                    className="!w-2.5 !h-2.5 !border-2 !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
                  />
                  <span className={`text-[10px] font-mono leading-none pl-1 ${getPinColor(leftPin.id)}`}>
                    {leftPin.label}
                  </span>
                </div>
              ) : (
                <div />
              )}

              {/* Center subtle dot */}
              <div className="w-1 h-1 rounded-full bg-slate-800 pointer-events-none" />

              {/* Right Pin Terminal + Handle */}
              {rightPin ? (
                <div className="relative flex items-center">
                  <span className={`text-[10px] font-mono leading-none pr-1 ${getPinColor(rightPin.id)}`}>
                    {rightPin.label}
                  </span>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={rightPin.id}
                    style={{ top: '50%', transform: 'translateY(-50%)', right: '-6px' }}
                    className="!w-2.5 !h-2.5 !border-2 !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
                  />
                </div>
              ) : (
                <div />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
