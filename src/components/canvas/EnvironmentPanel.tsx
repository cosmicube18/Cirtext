import React, { useState } from 'react';
import { Thermometer, Droplets, Sun, Wind, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useCircuitStore } from '../../store/circuitStore.ts';

const DEFAULTS = { temperature: 25.0, humidity: 50, lightLux: 350, co2Ppm: 420 };

export const EnvironmentPanel: React.FC = () => {
  const env = useCircuitStore((s) => s.environmentState);
  const setEnv = useCircuitStore((s) => s.setEnvironmentState);
  const isSimulating = useCircuitStore((s) => s.isSimulating);
  const components = useCircuitStore((s) => s.graph.components);
  const [open, setOpen] = useState(true);

  const hasEnvSensor = components.some((c) => c.type === 'SHT31' || c.type === 'BH1750' || c.type === 'SCD41');
  if (!hasEnvSensor && !isSimulating) return null;

  return (
    <div className="absolute bottom-4 left-4 z-40 w-64 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-200"
      >
        <span>Environment</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          <div>
            <label className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> Temperature</span>
              <span>{env.temperature.toFixed(1)} °C</span>
            </label>
            <input type="range" min={-10} max={50} step={0.5} value={env.temperature}
              onChange={(e) => setEnv({ temperature: Number(e.target.value) })}
              className="w-full" />
          </div>
          <div>
            <label className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Droplets className="w-3 h-3" /> Humidity</span>
              <span>{env.humidity.toFixed(0)} %</span>
            </label>
            <input type="range" min={0} max={100} step={1} value={env.humidity}
              onChange={(e) => setEnv({ humidity: Number(e.target.value) })}
              className="w-full" />
          </div>
          <div>
            <label className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Sun className="w-3 h-3" /> Ambient Light</span>
              <span>{env.lightLux} lux</span>
            </label>
            <input type="range" min={0} max={10000} step={10} value={env.lightLux}
              onChange={(e) => setEnv({ lightLux: Number(e.target.value) })}
              className="w-full" />
          </div>
          <div>
            <label className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Wind className="w-3 h-3" /> CO2</span>
              <span>{env.co2Ppm} ppm</span>
            </label>
            <input type="range" min={400} max={5000} step={10} value={env.co2Ppm}
              onChange={(e) => setEnv({ co2Ppm: Number(e.target.value) })}
              className="w-full" />
          </div>
          <button
            onClick={() => setEnv({ ...DEFAULTS })}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      )}
    </div>
  );
};
