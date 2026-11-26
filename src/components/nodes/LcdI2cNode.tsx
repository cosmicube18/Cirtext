import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { CircuitNodeData } from '../../types/flow.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';

const COLS = 16;

const padRow = (text: string | undefined): string => {
  const value = (text ?? '').slice(0, COLS);
  return value + ' '.repeat(Math.max(0, COLS - value.length));
};

/**
 * 16x2 I2C character LCD. Renders two rows of 16 monospace characters driven by
 * the firmware's LiquidCrystal_I2C calls. Stays blank with a dim backlight until
 * the device is properly powered (VCC + GND) and wired (SDA -> GPIO21, SCL -> GPIO22).
 */
export const LcdI2cNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as CircuitNodeData;
  const meta = COMPONENT_METADATA.LCD_I2C;
  const leftPins = meta.pins.filter((p) => p.position === 'left');
  const rightPins = meta.pins.filter((p) => p.position === 'right');
  const maxRows = Math.max(leftPins.length, rightPins.length, 2);

  const isSimulating = useCircuitStore((s) => s.isSimulating);
  const online = useCircuitStore(
    (s) => s.isSimulating && Boolean(s.simulationState.i2cDevices[props.id]?.online)
  );
  const display = useCircuitStore((s) => s.lcdDisplays[props.id]);

  const backlightOn = online && Boolean(display?.backlight);
  const row0 = online ? padRow(display?.row0) : padRow('');
  const row1 = online ? padRow(display?.row1) : padRow('');

  const getPinColor = (pinId: string) => {
    if (pinId === 'VCC') return 'text-rose-400 font-semibold';
    if (pinId === 'GND') return 'text-slate-400 font-semibold';
    if (pinId === 'SDA' || pinId === 'SCL') return 'text-cyan-300 font-bold';
    return 'text-amber-300 font-medium';
  };

  const statusLabel = !isSimulating
    ? 'IDLE'
    : online
      ? backlightOn
        ? 'LIVE'
        : 'BLANK'
      : 'OFFLINE';

  return (
    <div
      style={{ width: '240px' }}
      className={`relative rounded-xl bg-slate-900/98 border transition-all duration-150 shadow-2xl flex flex-col ${
        props.selected
          ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-500/20'
          : 'border-slate-700 hover:border-slate-500'
      }`}
    >
      {/* Header */}
      <div className="w-full px-3 py-1.5 border-b border-slate-800 flex items-center justify-between select-none">
        <span className="font-mono text-xs font-bold text-sky-400">
          {data.id || props.id}
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
          16x2 I2C LCD
        </span>
      </div>

      {/* LCD screen area */}
      <div className="px-3 pt-2 pb-1.5">
        <div
          className={`w-full rounded-md border p-1.5 shadow-inner select-none transition-colors duration-200 ${
            backlightOn
              ? 'bg-emerald-900/60 border-emerald-700'
              : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-mono text-slate-400">
              ADDR: 0x27
            </span>
            <span
              className={`text-[8px] font-mono font-semibold ${
                online
                  ? backlightOn
                    ? 'text-emerald-300'
                    : 'text-slate-400'
                  : 'text-rose-400'
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {[row0, row1].map((row, i) => (
              <div
                key={i}
                className={`font-mono text-[11px] leading-tight tracking-[0.12em] whitespace-pre rounded-sm px-1 py-0.5 ${
                  backlightOn
                    ? 'bg-emerald-950/80 text-emerald-200'
                    : 'bg-slate-900/80 text-slate-600'
                }`}
              >
                {row}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pin rows */}
      <div className="w-full py-1 border-t border-slate-800/80 flex flex-col select-none">
        {Array.from({ length: maxRows }).map((_, index) => {
          const leftPin = leftPins[index];
          const rightPin = rightPins[index];

          return (
            <div
              key={index}
              className="relative flex items-center justify-between h-6 px-3 hover:bg-slate-800/40"
            >
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

              <div className="w-1 h-1 rounded-full bg-slate-800 pointer-events-none" />

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
