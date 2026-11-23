import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';

export const OledNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const meta = COMPONENT_METADATA.OLED_SSD1306;
  const leftPins = meta.pins.filter((p) => p.position === 'left');
  const rightPins = meta.pins.filter((p) => p.position === 'right');
  const maxRows = Math.max(leftPins.length, rightPins.length);

  return (
    <div
      style={{ width: '200px' }}
      className={`relative rounded-xl bg-slate-900/98 border transition-all duration-150 shadow-2xl flex flex-col ${
        props.selected
          ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-500/20'
          : 'border-slate-700 hover:border-slate-500'
      }`}
    >
      {/* Top Header */}
      <div className="w-full px-3 py-1.5 border-b border-slate-800 flex items-center justify-between select-none">
        <span className="font-mono text-xs font-bold text-sky-400">
          {data.id || props.id}
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/60 font-semibold">
          SSD1306 OLED
        </span>
      </div>

      {/* Screen Graphic Area */}
      <div className="px-3 pt-2 pb-1.5">
        <div className="w-full h-14 rounded-lg bg-slate-950 border border-slate-800 p-1.5 flex flex-col justify-between shadow-inner select-none">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-amber-300 font-semibold">
              128x64 I2C
            </span>
            <span className="text-[8px] font-mono text-slate-500">ADDR: 0x3C</span>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-[10px] font-mono text-cyan-400 font-bold tracking-widest animate-pulse">
              [ LIVE DISPLAY ]
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[8px] font-mono text-slate-400">READY</span>
          </div>
        </div>
      </div>

      {/* Pin Rows: Paired Left & Right with Handles Anchored Inside Each Row */}
      <div className="w-full py-1 border-t border-slate-800/80 flex flex-col select-none">
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
                  <span
                    className={`text-[10px] font-mono leading-none pl-1 ${
                      leftPin.id === 'VCC' ? 'text-rose-400 font-semibold' : 'text-slate-400 font-semibold'
                    }`}
                  >
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
                  <span className="text-[10px] font-mono leading-none pr-1 text-cyan-300 font-bold">
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
