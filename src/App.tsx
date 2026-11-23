import React, { useState } from 'react';
import { Navbar } from './components/layout/Navbar.tsx';
import { ComponentPalette } from './components/layout/ComponentPalette.tsx';
import { CircuitCanvas } from './components/canvas/CircuitCanvas.tsx';
import { TextEditor } from './components/editor/TextEditor.tsx';
import { AIPromptModal } from './components/editor/AIPromptModal.tsx';
import { useCircuitStore } from './store/circuitStore.ts';

export const App: React.FC = () => {
  const { nodes, edges, updateNodes, updateEdges, connectPins, deleteNodes, deleteEdges } =
    useCircuitStore();
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  return (
    <div
      className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none"
      style={{ width: '100vw', height: '100vh' }}
    >
      {/* Top CAD Navigation */}
      <Navbar onOpenAiPrompt={() => setIsAiModalOpen(true)} />

      {/* Main Split-Screen Workspace */}
      <main className="flex-1 w-full min-h-0 flex overflow-hidden">
        {/* Left: Interactive Canvas View (flex-1 with min-h-0 and min-w-0) */}
        <section
          className="relative flex-1 h-full min-w-0 min-h-0 border-r border-slate-800 bg-slate-950 overflow-hidden"
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

        {/* Right: Real-time DSL Text Editor (fixed width sidebar, full height) */}
        <section
          className="w-[420px] lg:w-[480px] xl:w-[520px] shrink-0 h-full min-h-0 flex flex-col bg-slate-900 border-l border-slate-800 overflow-hidden"
          style={{ height: '100%' }}
        >
          <TextEditor />
        </section>
      </main>

      {/* AI Instructions Prompt Modal */}
      <AIPromptModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
};

export default App;
