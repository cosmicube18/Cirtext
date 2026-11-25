import React, { useState, useCallback, useEffect } from 'react';
import { Cpu, FileCode, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { Navbar } from './components/layout/Navbar.tsx';
import { ComponentPalette } from './components/layout/ComponentPalette.tsx';
import { CircuitCanvas } from './components/canvas/CircuitCanvas.tsx';
import { TextEditor } from './components/editor/TextEditor.tsx';
import { AiAssistantPanel } from './components/editor/AiAssistantPanel.tsx';
import { AIPromptModal } from './components/editor/AIPromptModal.tsx';
import { Esp32CodeModal } from './components/editor/Esp32CodeModal.tsx';
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
  const [esp32CodeModal, setEsp32CodeModal] = useState<{ isOpen: boolean; componentId: string }>({ isOpen: false, componentId: '' });
  const [activeRightTab, setActiveRightTab] = useState<'text' | 'ai'>('ai');
  const [mobileTab, setMobileTab] = useState<'canvas' | 'text' | 'ai'>('canvas');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);

  const hasErrors = diagnostics.some((d) => d.severity === 'error');

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleOpenEsp32Code = useCallback((componentId: string) => {
    setEsp32CodeModal({ isOpen: true, componentId });
  }, []);

  const handleCloseEsp32Code = useCallback(() => {
    setEsp32CodeModal({ isOpen: false, componentId: '' });
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const main = document.getElementById('main-container');
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;
      setRightPanelWidth(Math.min(Math.max(newWidth, 320), 720));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = 'auto';
    };

    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'auto';
    };
  }, [isResizing]);

  return (
    <div
      className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none"
      style={{ width: '100vw', height: '100vh' }}
    >
      {/* Top CAD Navigation */}
      <Navbar
        onOpenAiPrompt={() => setIsAiModalOpen(true)}
      />

      {/* Main Split-Screen Workspace */}
      <main
        id="main-container"
        className="flex-1 w-full min-h-0 flex overflow-hidden relative"
        style={{ height: '100%' }}
      >
        {/* Left: Interactive Canvas View + Component Palette */}
        <section
          className={`relative h-full min-w-0 min-h-0 bg-slate-950 overflow-hidden flex-1 ${mobileTab !== 'canvas' ? 'hidden md:flex' : ''}`}
          style={{ height: '100%' }}
        >
          {!leftPanelCollapsed && (
            <ComponentPalette
              collapsed={leftPanelCollapsed}
              onToggleCollapse={() => setLeftPanelCollapsed(true)}
            />
          )}
          <CircuitCanvas
            nodes={nodes}
            edges={edges}
            onNodesUpdate={updateNodes}
            onEdgesUpdate={updateEdges}
            onConnectEdge={connectPins}
            onNodesDelete={deleteNodes}
            onEdgesDelete={deleteEdges}
            onOpenEsp32Code={handleOpenEsp32Code}
          />
          {leftPanelCollapsed && (
            <button
              onClick={() => setLeftPanelCollapsed(false)}
              className="absolute top-3 left-3 z-50 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-700 text-sky-400 text-xs font-semibold shadow-2xl backdrop-blur-md"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">Components</span>
            </button>
          )}
        </section>

        {/* Drag-to-resize handle (desktop only) */}
        {!rightPanelCollapsed && mobileTab === 'canvas' && (
          <div
            className="hidden md:block w-[4px] cursor-col-resize z-50 bg-transparent hover:bg-slate-600/30 active:bg-slate-500"
            onMouseDown={startResize}
          />
        )}

        {/* Right: Desktop Sidebar / Mobile Full View (AI Assistant or Text Editor) */}
        {!rightPanelCollapsed && (
          <section
            className={`h-full bg-slate-900 border-l border-slate-800 overflow-hidden flex flex-col shrink-0 ${mobileTab === 'canvas' ? 'hidden md:flex' : 'flex-1 w-full'}`}
            style={{ width: mobileTab === 'canvas' ? `${rightPanelWidth}px` : '100%', height: '100%' }}
          >
            {/* Desktop Tab Switcher Header */}
            <div className="hidden md:flex h-11 border-b border-slate-800 bg-slate-950/90 px-3 items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveRightTab('ai')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeRightTab === 'ai'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Assistant</span>
                </button>

                <button
                  onClick={() => setActiveRightTab('text')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeRightTab === 'text'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>DSL Editor</span>
                  {hasErrors && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                </button>
              </div>
              <button
                onClick={() => setRightPanelCollapsed(true)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Hide Right Panel"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Panel Content Container */}
            <div className="flex-1 min-h-0 overflow-hidden relative">
              {(mobileTab === 'ai' || (mobileTab !== 'text' && activeRightTab === 'ai')) && (
                <AiAssistantPanel
                  onClose={() => {
                    setMobileTab('canvas');
                    setActiveRightTab('text');
                  }}
                />
              )}
              {(mobileTab === 'text' || (mobileTab !== 'ai' && activeRightTab === 'text')) && (
                <TextEditor />
              )}
            </div>
          </section>
        )}

        {/* Right panel restore button (desktop only) */}
        {rightPanelCollapsed && mobileTab === 'canvas' && (
          <button
            onClick={() => setRightPanelCollapsed(false)}
            className="absolute top-3 right-3 z-50 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-700 text-purple-400 text-xs font-semibold shadow-2xl backdrop-blur-md"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium">AI & DSL</span>
          </button>
        )}
      </main>

      {/* Mobile Sticky Bottom Tab Bar (< 768px) */}
      <nav className="flex md:hidden h-14 border-t border-slate-800 bg-slate-900/98 px-2 shrink-0 items-center justify-around z-30 select-none shadow-lg">
        <button
          onClick={() => setMobileTab('canvas')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-lg transition-all ${
            mobileTab === 'canvas'
              ? 'text-sky-400 bg-sky-950/70 font-semibold border border-sky-800/60 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span className="text-[11px] font-medium leading-none">Canvas</span>
        </button>

        <div className="w-px h-6 bg-slate-800 mx-1" />

        <button
          onClick={() => setMobileTab('ai')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-lg transition-all ${
            mobileTab === 'ai'
              ? 'text-purple-400 bg-purple-950/70 font-semibold border border-purple-800/60 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-[11px] font-medium leading-none">AI Assistant</span>
        </button>

        <div className="w-px h-6 bg-slate-800 mx-1" />

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

      {/* ESP32 Code Modal */}
      <Esp32CodeModal
        isOpen={esp32CodeModal.isOpen}
        onClose={handleCloseEsp32Code}
        esp32ComponentId={esp32CodeModal.componentId}
      />
    </div>
  );
};

export default App;
