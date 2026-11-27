import React, { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, ChevronLeft, X, Layers, Search } from 'lucide-react';
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
    items: ['SCD41', 'BH1750', 'SHT31', 'OLED_SSD1306', 'LCD_I2C'],
  },
  {
    name: 'Passives & Controls',
    items: ['VoltageSource', 'Resistor', 'Capacitor', 'LED', 'Buzzer', 'Boost5V', 'TP4056', 'Switch', 'Ground'],
  },
  {
    name: 'Instruments / Meters',
    items: ['Voltmeter', 'Ammeter', 'Ohmmeter'],
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredGroups = PALETTE_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((type) => {
      if (!normalizedQuery) return true;
      const meta = COMPONENT_METADATA[type];
      return (
        type.toLowerCase().includes(normalizedQuery) ||
        meta.displayName.toLowerCase().includes(normalizedQuery) ||
        meta.defaultPrefix.toLowerCase().includes(normalizedQuery)
      );
    }),
  })).filter((group) => group.items.length > 0);

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

      {/* Sidebar Container: flex sidebar on desktop, modal drawer on mobile */}
      <aside
        className={`${
          isOpenMobile
            ? 'flex absolute top-3 left-3 z-30 max-h-[calc(100%-76px)] rounded-2xl border border-slate-800 shadow-2xl'
            : 'hidden md:flex h-full border-r border-slate-800'
        } flex-col min-h-0 w-60 shrink-0 bg-slate-900/95 backdrop-blur-md select-none transition-all duration-200`}
      >
        <div className="px-3 py-2.5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Component Library
            </span>
          </div>
          {/* Collapse button (desktop) */}
          <button
            onClick={onToggleCollapse}
            className="hidden md:inline-flex p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Collapse Component Library"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {/* Close button (mobile) */}
          <button
            onClick={() => setIsOpenMobile(false)}
            className="md:hidden p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Search / Filter Input */}
        <div className="px-2.5 pt-2 pb-1.5 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter components..."
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 focus:border-sky-500/60 focus:outline-none text-xs text-slate-200 placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-500 hover:text-slate-300"
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Component List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-6 flex flex-col gap-1">
          {filteredGroups.map((group) => {
            const isCollapsed = !normalizedQuery && collapsedGroups[group.name];
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
                          draggable={true}
                          onDragStart={(event) => {
                            event.dataTransfer.setData('application/reactflow', type);
                            event.dataTransfer.effectAllowed = 'move';
                          }}
                          onClick={() => handleAdd(type)}
                          title={`Click or drag to add ${meta.displayName}`}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/60 hover:border-sky-500/60 text-slate-200 transition-all text-xs group active:scale-95 cursor-grab active:cursor-grabbing"
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
          {filteredGroups.length === 0 && (
            <div className="px-2 py-4 text-center text-[11px] text-slate-500">
              No matching components
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
