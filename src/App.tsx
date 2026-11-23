import React, { useState } from 'react';
import { Cpu, FileCode } from 'lucide-react';
import { Navbar } from './components/layout/Navbar.tsx';
import { ComponentPalette } from './components/layout/ComponentPalette.tsx';
import { CircuitCanvas } from './components/canvas/CircuitCanvas.tsx';
import { TextEditor } from './components/editor/TextEditor.tsx';
import { AIPromptModal } from './components/editor/AIPromptModal.tsx';
import { useCircuitStore } from './store/circuitStore.ts';

export const App: React.FC = () => {
  const {
    nodes,
    edges,
    diagnostics,
    updateNodes,
    updateEdges,
    connectPins,
    deleteNodes,
    deleteEdges,
  } = useCircuitStore();
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'canvas' | 'text'>('canvas');

  const hasErrors = diagnostics.some((d) => d.severity === 'error');

  return (
    <div
      className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none"
      style={{ width: '100vw', height: '100vh' }}
    >
      {/* Top CAD Navigation */}
      <Navbar onOpenAiPrompt={() => setIsAiModalOpen(true)} />

      {/* Main Split-Screen Workspace */}
      <main className="flex-1 w-full min-h-0 flex overflow-hidden">
        {/* Left: Interactive Canvas View (full on mobile when active; 58% on desktop) */}
        <section
          className={`relative h-full min-w-0 min-h-0 border-r border-slate-800 bg-slate-950 overflow-hidden ${
            mobileTab === 'canvas' ? 'flex flex-1 w-full' : 'hidden md:flex md:flex-1'
          }`}
          style={{ height: '100%' }}
        >
          {/* Quick Component Palette Drawer */}
          <ComponentPalette />

          {/* Canvas Component */}
          <CircuitCanvas
            nodes={nodes}
            edges={edges}
            onNodesUpdate={updateNodes}
            onEdgesUpdate={updateEdges}
            onConnectEdge={connectPins}
            onNodesDelete={deleteNodes}
            onEdgesDelete={deleteEdges}
          />
        </section>

        {/* Right: Real-time DSL Text Editor (full on mobile when active; fixed sidebar on desktop) */}
        <section
          className={`h-full min-h-0 bg-slate-900 border-l border-slate-800 overflow-hidden ${
            mobileTab === 'text'
              ? 'flex flex-1 w-full'
              : 'hidden md:flex md:w-[420px] lg:md:w-[480px] xl:md:w-[520px] md:shrink-0 flex-col'
          }`}
          style={{ height: '100%' }}
        >
          <TextEditor />
        </section>
      </main>

      {/* Mobile Sticky Bottom Tab Bar (< 768px) */}
      <nav className="flex md:hidden h-14 border-t border-slate-800 bg-slate-900/98 px-3 shrink-0 items-center justify-around z-30 select-none shadow-lg">
        <button
          onClick={() => setMobileTab('canvas')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-lg transition-all ${
            mobileTab === 'canvas'
              ? 'text-sky-400 bg-sky-950/70 font-semibold border border-sky-800/60 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span className="text-[11px] font-medium leading-none">Schematic Canvas</span>
        </button>

        <div className="w-px h-6 bg-slate-800 mx-2" />

        <button
          onClick={() => setMobileTab('text')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-lg transition-all ${
            mobileTab === 'text'
              ? 'text-sky-400 bg-sky-950/70 font-semibold border border-sky-800/60 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <FileCode className="w-4 h-4" />
            {hasErrors && (
              <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
          <span className="text-[11px] font-medium leading-none">DSL Text</span>
        </button>
      </nav>

      {/* AI Instructions Prompt Modal */}
      <AIPromptModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
};

export default App;
