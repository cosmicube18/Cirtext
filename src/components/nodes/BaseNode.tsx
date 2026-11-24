import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { PinDefinition } from '../../types/circuit.ts';

export interface BaseNodeProps {
  id: string;
  title: string;
  subtitle?: React.ReactNode;
  selected?: boolean;
  pins: PinDefinition[];
  children: React.ReactNode;
}

const POSITION_MAP: Record<'top' | 'bottom' | 'left' | 'right', Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

export const BaseNode: React.FC<BaseNodeProps> = ({
  title,
  subtitle,
  selected = false,
  pins,
  children,
}) => {
  return (
    <div
      className={`relative group px-3 py-2 rounded-lg bg-slate-900/95 border transition-all duration-150 shadow-lg ${
        selected
          ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-500/20'
          : 'border-slate-700/80 hover:border-slate-500'
      }`}
    >
      {/* Component Header (ID & Value/Label) */}
      <div className="flex items-center justify-between gap-2 mb-1.5 pointer-events-none select-none">
        <span className="font-mono text-xs font-bold text-sky-400 tracking-wide">
          {title}
        </span>
        {subtitle && (
          typeof subtitle === 'string' ? (
            <span className="font-mono text-[11px] text-amber-300/90 font-medium px-1.5 py-0.2 rounded bg-amber-950/40 border border-amber-800/40">
              {subtitle}
            </span>
          ) : (
            subtitle
          )
        )}
      </div>

      {/* SVG Symbol container */}
      <div className="flex items-center justify-center min-w-[70px] min-h-[50px] my-1">
        {children}
      </div>

      {/* Terminal Pin Handles */}
      {pins.map((pin) => {
        const rfPosition = POSITION_MAP[pin.position];

        // Position helper classes for terminal tooltip badge
        const badgePositionClass = {
          top: '-top-6 left-1/2 -translate-x-1/2',
          bottom: '-bottom-6 left-1/2 -translate-x-1/2',
          left: '-left-8 top-1/2 -translate-y-1/2',
          right: '-right-8 top-1/2 -translate-y-1/2',
        }[pin.position];

        return (
          <React.Fragment key={pin.id}>
            <Handle
              type="source"
              position={rfPosition}
              id={pin.id}
              className="!w-3 !h-3 !border-2 !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
            />
            {/* Hover pin label badge */}
            <span
              className={`absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono font-semibold px-1 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700 shadow z-20 ${badgePositionClass}`}
            >
              {pin.id}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};
