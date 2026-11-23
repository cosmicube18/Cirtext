import React, { useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Info,
} from 'lucide-react';
import { useCircuitStore } from '../../store/circuitStore.ts';

export const TextEditor: React.FC = () => {
  const { dslText, setDslText, diagnostics } = useCircuitStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Line counter for line gutter
  const lines = dslText.split('\n');

  // Handle Tab key insertion in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const updated = dslText.substring(0, start) + '  ' + dslText.substring(end);
      setDslText(updated);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  };

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 border-l border-slate-800">
      {/* Editor Header */}
      <div className="h-10 border-b border-slate-800 px-3 flex items-center justify-between bg-slate-900/90 select-none">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-mono font-semibold text-slate-200">
            CIRCUIT DSL
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            ({lines.length} lines)
          </span>
        </div>

        {/* Validation Status Badge */}
        <div className="flex items-center gap-1.5">
          {errorCount === 0 && warningCount === 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Valid Syntax
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/60">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              {errorCount > 0 && `${errorCount} error${errorCount > 1 ? 's' : ''}`}
              {warningCount > 0 && ` ${warningCount} warning${warningCount > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
      </div>

      {/* Editor Main Text Area with Line Gutter */}
      <div className="flex-1 relative flex overflow-hidden font-mono text-xs">
        {/* Line Numbers Gutter */}
        <div className="w-10 py-3 bg-slate-950/60 border-r border-slate-800 text-slate-500 text-right pr-2 select-none shrink-0 overflow-hidden font-mono text-[11px] leading-6">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={dslText}
          onChange={(e) => setDslText(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="flex-1 w-full h-full p-3 bg-transparent text-slate-100 resize-none outline-none leading-6 font-mono text-xs selection:bg-sky-500/30 whitespace-pre overflow-auto"
          placeholder="Paste or type circuit DSL here..."
        />
      </div>

      {/* Diagnostics / Non-blocking Warnings Panel */}
      {diagnostics.length > 0 && (
        <div className="max-h-40 border-t border-slate-800 bg-slate-950/95 overflow-y-auto p-2.5 flex flex-col gap-1.5 select-text">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
            <Info className="w-3.5 h-3.5 text-sky-400" />
            <span>Syntax Diagnostics</span>
          </div>
          {diagnostics.map((diag, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 text-xs px-2 py-1 rounded font-mono ${
                diag.severity === 'error'
                  ? 'bg-rose-950/40 text-rose-300 border border-rose-800/50'
                  : 'bg-amber-950/40 text-amber-300 border border-amber-800/50'
              }`}
            >
              <span className="shrink-0 font-bold opacity-80">
                [Line {diag.line}]:
              </span>
              <span className="flex-1">{diag.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
