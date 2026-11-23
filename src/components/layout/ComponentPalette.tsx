import React, { useState } from 'react';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import type { ComponentType } from '../../types/circuit.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';

interface PaletteGroup {
  name: string;
  items: ComponentType[];
}

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    name: 'Microcontrollers',
    items: ['ESP32_30Pin'],
  },
  {
    name: 'Sensors & Displays',
    items: ['SCD41', 'BH1750', 'SHT31', 'OLED_SSD1306'],
  },
  {
    name: 'Passives & Controls',
    items: ['VoltageSource', 'Resistor', 'Capacitor', 'LED', 'Switch', 'Ground'],
  },
];

export const ComponentPalette: React.FC = () => {
  const { addComponent } = useCircuitStore();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 p-2 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-2xl max-h-[85vh] overflow-y-auto w-56 select-none">
      <div className="px-2 py-1 border-b border-slate-800/80 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Component Library
        </span>
      </div>

      {PALETTE_GROUPS.map((group) => {
        const isCollapsed = collapsedGroups[group.name];
        return (
          <div key={group.name} className="flex flex-col gap-1 mb-1">
            <button
              onClick={() => toggleGroup(group.name)}
              className="flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200"
            >
              <span>{group.name}</span>
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>

            {!isCollapsed && (
              <div className="flex flex-col gap-1 pl-1">
                {group.items.map((type) => {
                  const meta = COMPONENT_METADATA[type];
                  return (
                    <button
                      key={type}
                      onClick={() => addComponent(type)}
                      title={`Add ${meta.displayName}`}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/60 hover:border-sky-500/60 text-slate-200 transition-all text-xs group"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono font-bold text-sky-400 text-[10px] w-6 text-left shrink-0">
                          {meta.defaultPrefix}
                        </span>
                        <span className="font-medium text-slate-200 text-[11px] truncate">
                          {meta.displayName}
                        </span>
                      </div>
                      <Plus className="w-3 h-3 text-slate-400 group-hover:text-sky-400 group-hover:scale-110 transition-all shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
