import React, { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, ChevronLeft, X, Layers } from 'lucide-react';
import type { ComponentType } from '../../types/circuit.ts';
import { COMPONENT_METADATA } from '../../types/circuit.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';

interface PaletteGroup {
  name: string;
  items: ComponentType[];
}

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    name: 'Logic Gates',
    items: ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'],
  },
  {
    name: 'Sequential Logic',
    items: ['Clock', 'D_FlipFlop', 'JK_FlipFlop'],
  },
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
    items: ['VoltageSource', 'Resistor', 'Capacitor', 'LED', 'Buzzer', 'Boost5V', 'TP4056', 'Switch', 'Ground'],
  },
];

export interface ComponentPaletteProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({
  collapsed = false,
  onToggleCollapse,
}) => {
  const { addComponent } = useCircuitStore();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleAdd = (type: ComponentType) => {
    addComponent(type);
    // On small screens, close after adding so the user sees the canvas
    if (window.innerWidth < 768) {
      setIsOpenMobile(false);
    }
  };

  // When collapsed, render nothing (App shows the restore button)
  if (collapsed) return null;

  return (
    <>
      {/* Mobile Floating Toggle Button (< md) */}
      <div className="md:hidden absolute top-3 left-3 z-20">
        {!isOpenMobile && (
          <button
            onClick={() => setIsOpenMobile(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-700 text-sky-400 text-xs font-semibold shadow-2xl backdrop-blur-md"
          >
            <Plus className="w-4 h-4 text-sky-400" />
            <span>Add Component</span>
          </button>
        )}
      </div>

      {/* Palette Container: visible on desktop, modal drawer on mobile */}
      <div
        className={`absolute top-3 left-3 z-20 flex flex-col gap-1 p-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-2xl w-60 select-none transition-all duration-200 ${
          isOpenMobile ? 'block' : 'hidden md:block'
        }`}
      >
        <div className="px-2 py-1 border-b border-slate-800/80 mb-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Component Library
            </span>
          </div>
          {/* Collapse button */}
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Collapse Component Library"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {/* Close button on mobile */}
          <button
            onClick={() => setIsOpenMobile(false)}
            className="md:hidden p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
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
                        onClick={() => handleAdd(type)}
                        title={`Add ${meta.displayName}`}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/60 hover:border-sky-500/60 text-slate-200 transition-all text-xs group active:scale-95"
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
    </>
  );
};
