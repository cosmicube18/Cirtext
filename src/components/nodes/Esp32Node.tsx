import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';

export const Esp32Node: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const meta = COMPONENT_METADATA.ESP32_30Pin;

  const leftPins = meta.pins.filter((p) => p.position === 'left');
  const rightPins = meta.pins.filter((p) => p.position === 'right');
  const maxRows = Math.max(leftPins.length, rightPins.length);

  const getPinColor = (pinId: string) => {
    if (pinId.includes('3V3') || pinId.includes('VIN')) return 'text-rose-400 font-bold';
    if (pinId.includes('GND')) return 'text-slate-400 font-medium';
    if (pinId.includes('GPIO21') || pinId.includes('GPIO22')) return 'text-cyan-300 font-bold';
    if (pinId.startsWith('RX') || pinId.startsWith('TX')) return 'text-emerald-400';
    return 'text-slate-300';
  };

  return (
    <div
      style={{ width: '230px' }}
      className={`relative rounded-xl bg-slate-900/98 border transition-all duration-150 shadow-2xl flex flex-col ${
        props.selected
          ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-500/20'
          : 'border-slate-700 hover:border-slate-500'
      }`}
    >
      {/* Top Header: USB Connector Graphic & Board Identity */}
      <div className="relative w-full pt-2 px-3 pb-2 border-b border-slate-800 flex flex-col items-center select-none">
        {/* Micro-USB / Type-C Connector Graphic */}
        <div className="w-12 h-3.5 -mt-3.5 rounded-t-sm bg-slate-700 border border-slate-500 border-b-0 flex items-center justify-center shadow-inner">
          <div className="w-7 h-1.5 rounded-sm bg-slate-950 border border-slate-600" />
        </div>

        <div className="w-full flex items-center justify-between mt-1.5">
          <span className="font-mono text-xs font-bold text-sky-400 tracking-wider">
            {data.id || props.id}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-300 border border-sky-800/60 font-semibold">
            ESP32 30-PIN
          </span>
        </div>

        {/* ESP-WROOM-32 Shield Graphic */}
        <div className="w-full mt-1.5 py-1 px-2 rounded bg-slate-800/90 border border-slate-700/80 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono font-bold text-slate-300 tracking-tight leading-none">
              ESP-WROOM-32
            </span>
            <span className="text-[8px] font-mono text-slate-500">Wi-Fi + BLE SoC</span>
          </div>
          {/* Antenna trace icon */}
          <svg width="24" height="12" viewBox="0 0 24 12" className="stroke-amber-400/80 fill-none stroke-[1.5]">
            <path d="M 2 2 L 6 2 L 6 10 L 10 10 L 10 2 L 14 2 L 14 10 L 18 10 L 18 2 L 22 2" />
          </svg>
        </div>
      </div>

      {/* Pin Rows: Paired Left & Right with Handles Anchored Inside Each Row */}
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

              {/* Center subtle pin-bridge trace */}
              <div className="w-10 border-b border-slate-800/60 pointer-events-none" />

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
