import React, { useState } from 'react';
import {
  Wand2,
  Sparkles,
  Trash2,
  ChevronDown,
  Layers,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Download,
  Printer,
  Image,
  FileCode2,
  Loader2,
} from 'lucide-react';
import { useCircuitStore } from '../../store/circuitStore.ts';
import { SAMPLE_CIRCUITS } from '../../parser/sampleCircuits.ts';
import { downloadDiagram, printDiagram } from '../../utils/exportDiagram.ts';

export interface NavbarProps {
  onOpenAiPrompt: () => void;
  onToggleAiPanel?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAiPrompt, onToggleAiPanel }) => {
  const { graph, nodes, diagnostics, applyAutoLayout, isLayoutRunning, loadSample, clearCircuit } =
    useCircuitStore();
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [printLightMode, setPrintLightMode] = useState(true);
  const [validationToast, setValidationToast] = useState<string | null>(null);

  const handleValidate = () => {
    const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
    const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

    // Check for components with 0 connections (floating)
    const connectedComponentIds = new Set<string>();
    graph.connections.forEach((conn) => {
      connectedComponentIds.add(conn.sourceComponentId);
      connectedComponentIds.add(conn.targetComponentId);
    });

    const floatingComponents = graph.components.filter(
      (comp) => !connectedComponentIds.has(comp.id)
    );

    if (errorCount > 0) {
      setValidationToast(`Found ${errorCount} syntax error(s). See Diagnostics panel.`);
    } else if (warningCount > 0) {
      setValidationToast(`Validated with ${warningCount} warning(s). See Diagnostics panel.`);
    } else if (floatingComponents.length > 0) {
      setValidationToast(
        `Connections valid! Note: ${floatingComponents.map((c) => c.id).join(', ')} has no connections.`
      );
    } else {
      setValidationToast(
        `All ${graph.connections.length} connections and ${graph.components.length} components verified!`
      );
    }

    setTimeout(() => {
      setValidationToast(null);
    }, 4000);
  };

  const handleExportPng = async () => {
    if (nodes.length === 0) {
      alert('The circuit is empty. Add components to the canvas before exporting.');
      return;
    }
    try {
      setIsExporting(true);
      await downloadDiagram(nodes, 'png', {
        title: graph.title || 'circuit-schematic',
        isLightMode: printLightMode,
      });
      setExportMenuOpen(false);
    } catch (err) {
      console.error('PNG export failed:', err);
      alert('Failed to generate PNG image. Check browser console.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSvg = async () => {
    if (nodes.length === 0) {
      alert('The circuit is empty. Add components to the canvas before exporting.');
      return;
    }
    try {
      setIsExporting(true);
      await downloadDiagram(nodes, 'svg', {
        title: graph.title || 'circuit-schematic',
        isLightMode: printLightMode,
      });
      setExportMenuOpen(false);
    } catch (err) {
      console.error('SVG export failed:', err);
      alert('Failed to generate SVG vector diagram. Check browser console.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = async () => {
    if (nodes.length === 0) {
      alert('The circuit is empty. Add components to the canvas before printing.');
      return;
    }
    try {
      setIsExporting(true);
      await printDiagram(nodes, {
        title: graph.title || 'Circuit Schematic',
        isLightMode: printLightMode,
      });
      setExportMenuOpen(false);
    } catch (err) {
      console.error('Print generation failed:', err);
      alert('Failed to generate printable view. Check browser console.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="min-h-14 py-2 px-3 md:px-4 border-b border-slate-800 bg-slate-900/95 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 z-20 shrink-0 select-none shadow-sm">
      {/* Brand & Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/80 flex items-center justify-center font-bold text-sky-400 shadow-sm shadow-sky-500/10 shrink-0">
          <Cpu className="w-4 h-4 md:w-5 md:h-5 text-sky-400" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <span className="font-semibold text-xs md:text-sm tracking-tight text-slate-100">
              Cirtext
            </span>
            <span className="text-[9px] md:text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800/60">
              CAD
            </span>
          </div>
          <p className="hidden sm:block text-[10px] md:text-[11px] text-slate-400 leading-none">
            Bi-Directional Canvas & AI-Readable Text
          </p>
        </div>
      </div>

      {/* Center Sample Selector */}
      <div className="relative order-2 sm:order-none">
        <button
          onClick={() => {
            setSampleMenuOpen(!sampleMenuOpen);
            setExportMenuOpen(false);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800/90 border border-slate-700 hover:border-slate-600 text-xs text-slate-200 transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="hidden sm:inline">Load Example Circuit</span>
          <span className="sm:hidden text-[11px]">Examples</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        {sampleMenuOpen && (
          <div className="absolute top-full left-0 sm:left-auto right-auto sm:right-0 mt-1 w-72 max-w-[calc(100vw-24px)] rounded-md bg-slate-900 border border-slate-700 shadow-2xl py-1 z-50">
            {SAMPLE_CIRCUITS.map((sample) => (
              <button
                key={sample.id}
                onClick={() => {
                  void loadSample(sample);
                  setSampleMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-800/80 flex flex-col transition-colors border-b border-slate-800/60 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-100">
                    {sample.name}
                  </span>
                  {sample.id.includes('esp32') && (
                    <span className="text-[9px] font-mono px-1 rounded bg-sky-950 text-sky-300 border border-sky-800">
                      NEW
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                  {sample.description}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center flex-wrap gap-1.5 md:gap-2">
        {/* Validate Connections Button */}
        <button
          onClick={handleValidate}
          title="Validate all connection endpoints"
          className="flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-medium transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="hidden lg:inline">Validate Connections</span>
          <span className="hidden sm:inline lg:hidden">Validate</span>
        </button>

        {/* ELK Auto Layout Button */}
        <button
          onClick={() => void applyAutoLayout()}
          disabled={isLayoutRunning}
          title="Compute orthogonal coordinates via ELKjs"
          className="flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-medium text-xs shadow-sm shadow-sky-500/20 transition-colors"
        >
          <Wand2 className={`w-3.5 h-3.5 shrink-0 ${isLayoutRunning ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isLayoutRunning ? 'Layouting...' : 'Auto-Layout'}</span>
          <span className="sm:hidden text-[11px]">Auto</span>
        </button>

        {/* Export Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => {
              setExportMenuOpen(!exportMenuOpen);
              setSampleMenuOpen(false);
            }}
            disabled={isExporting}
            title="Download or Print full resolution diagram"
            className="flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-medium transition-colors"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
            ) : (
              <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            )}
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {exportMenuOpen && (
            <div className="absolute top-full right-0 mt-1 w-60 max-w-[calc(100vw-24px)] rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1.5 z-50 flex flex-col">
              <div className="px-3 py-1 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Export Schematic
                </span>
                {isExporting && (
                  <span className="text-[10px] text-sky-400 animate-pulse">
                    Generating...
                  </span>
                )}
              </div>

              {/* Option 1: Download PNG */}
              <button
                onClick={() => void handleExportPng()}
                disabled={isExporting}
                className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-200">
                      Download PNG
                    </span>
                    <span className="text-[10px] text-slate-400">
                      High-res raster image
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  .png
                </span>
              </button>

              {/* Option 2: Download SVG */}
              <button
                onClick={() => void handleExportSvg()}
                disabled={isExporting}
                className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-200">
                      Download SVG
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Vector graphic
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  .svg
                </span>
              </button>

              {/* Option 3: Print / Save as PDF */}
              <button
                onClick={() => void handlePrint()}
                disabled={isExporting}
                className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between transition-colors group border-b border-slate-800/80"
              >
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-200">
                      Print / Save as PDF
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Print-ready landscape
                    </span>
                  </div>
                </div>
              </button>

              {/* Ink Saver Toggle */}
              <div className="px-3 py-2 flex items-center justify-between text-xs text-slate-300">
                <span className="text-[11px] text-slate-400">
                  White Paper (Ink Saver)
                </span>
                <input
                  type="checkbox"
                  checked={printLightMode}
                  onChange={(e) => setPrintLightMode(e.target.checked)}
                  className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 bg-slate-800 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* AI Assistant Button */}
        {onToggleAiPanel && (
          <button
            onClick={onToggleAiPanel}
            title="Open Gemini AI Circuit Assistant"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-400/60 text-xs font-semibold shadow-md shadow-purple-900/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200 shrink-0 animate-pulse" />
            <span className="hidden sm:inline">AI Assistant</span>
            <span className="sm:hidden text-[11px]">AI</span>
          </button>
        )}

        {/* AI Helper Button */}
        <button
          onClick={onOpenAiPrompt}
          title="Format current circuit with AI instructions"
          className="flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-md bg-purple-600/90 hover:bg-purple-500 text-purple-100 border border-purple-400/40 text-xs font-medium transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-300 shrink-0" />
          <span className="hidden md:inline">Copy with AI Instructions</span>
          <span className="md:hidden text-[11px]">AI Prompt</span>
        </button>

        {/* Clear All Circuit Button */}
        <button
          onClick={() => {
            if (
              window.confirm(
                'Are you sure you want to clear the entire circuit? This will remove all components and connections.'
              )
            ) {
              clearCircuit();
            }
          }}
          title="Clear the entire schematic canvas and DSL (Reset)"
          className="flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-md hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-800/50 text-xs font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Clear All</span>
        </button>
      </div>

      {/* Validation Toast Notice */}
      {validationToast && (
        <div className="absolute top-16 right-4 z-50 px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-600 shadow-2xl flex items-center gap-2 text-xs text-slate-100 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{validationToast}</span>
        </div>
      )}
    </header>
  );
};
