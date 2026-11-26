import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CircuitNode } from '../../types/flow.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';

interface InstrumentStyleConfig {
  badge: string;
  accentText: string;
  accentBorder: string;
  leftPinId: string;
  leftPinLabel: string;
  rightPinId: string;
  rightPinLabel: string;
}

const INSTRUMENT_CONFIGS: Record<string, InstrumentStyleConfig> = {
  Voltmeter: {
    badge: 'DC VOLTS',
    accentText: 'text-sky-400',
    accentBorder: 'border-sky-500/60',
    leftPinId: 'pos',
    leftPinLabel: '+',
    rightPinId: 'neg',
    rightPinLabel: '-',
  },
  Ammeter: {
    badge: 'DC AMPS',
    accentText: 'text-emerald-400',
    accentBorder: 'border-emerald-500/60',
    leftPinId: 'pos',
    leftPinLabel: '+',
    rightPinId: 'neg',
    rightPinLabel: '-',
  },
  Ohmmeter: {
    badge: 'OHMS',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/60',
    leftPinId: '1',
    leftPinLabel: '1',
    rightPinId: '2',
    rightPinLabel: '2',
  },
};

export const InstrumentNode: React.FC<NodeProps<CircuitNode>> = ({ data, selected }) => {
  const isSimulating = useCircuitStore((s) => s.isSimulating);
  const reading = useCircuitStore((s) => s.simulationState.instrumentReadings[data.id]);

  const config = INSTRUMENT_CONFIGS[data.componentType] ?? INSTRUMENT_CONFIGS.Voltmeter;

  const isLiveError = isSimulating && reading?.status === 'live_error';
  const displayText = isSimulating ? (reading?.display ?? '---') : '---';

  const lcdClass = isLiveError
    ? 'bg-rose-950/95 border-rose-500/80 text-rose-300 shadow-[inset_0_0_10px_rgba(244,63,94,0.3)]'
    : isSimulating
    ? 'bg-emerald-950/95 border-emerald-600/60 text-emerald-300 shadow-[inset_0_0_10px_rgba(16,185,129,0.2)]'
    : 'bg-slate-950/95 border-slate-700/70 text-slate-500';

  return (
    <div
      className={`relative w-[150px] h-[110px] rounded-xl bg-slate-900/95 border-2 px-3 py-2 flex flex-col justify-between shadow-xl select-none transition-all ${
        selected
          ? 'border-sky-400 ring-2 ring-sky-400/30'
          : isSimulating
          ? config.accentBorder
          : 'border-slate-700'
      }`}
    >
      {/* Top Header: Component ID + Meter Badge */}
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono font-bold text-xs text-slate-100 truncate">
          {data.id}
        </span>
        <span
          className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 ${config.accentText}`}
        >
          {config.badge}
        </span>
      </div>

      {/* Backlit Digital LCD Readout */}
      <div
        className={`w-full rounded-md border px-2 py-1.5 flex items-center justify-end font-mono font-bold text-sm tracking-tight ${lcdClass}`}
      >
        <span className="truncate">{displayText}</span>
      </div>

      {/* Bottom Terminal Labels */}
      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 px-0.5">
        <span className={data.componentType !== 'Ohmmeter' ? 'text-rose-400' : 'text-slate-400'}>
          {config.leftPinLabel}
        </span>
        {data.label ? (
          <span className="text-[9px] text-slate-500 truncate max-w-[80px] font-sans">
            {data.label}
          </span>
        ) : (
          <span className="text-[9px] text-slate-600 font-sans">DMM</span>
        )}
        <span className={data.componentType !== 'Ohmmeter' ? 'text-sky-400' : 'text-slate-400'}>
          {config.rightPinLabel}
        </span>
      </div>

      {/* Left Terminal Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id={config.leftPinId}
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-900 hover:!bg-sky-400"
      />

      {/* Right Terminal Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id={config.rightPinId}
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-900 hover:!bg-sky-400"
      />
    </div>
  );
};
