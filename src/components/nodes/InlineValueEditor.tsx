import React, { useEffect, useRef, useState } from 'react';
import { useCircuitStore } from '../../store/circuitStore.ts';

export interface InlineValueEditorProps {
  nodeId: string;
  initialValue: string;
  onClose: () => void;
}

/**
 * Compact dark-themed inline input popover for editing a component's value
 * directly on the canvas. Stops event propagation so typing or pressing
 * Backspace/Delete never triggers canvas shortcuts or node deletion.
 */
export const InlineValueEditor: React.FC<InlineValueEditorProps> = ({
  nodeId,
  initialValue,
  onClose,
}) => {
  const updateComponentValue = useCircuitStore((s) => s.updateComponentValue);
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    updateComponentValue(nodeId, draft.trim());
    onClose();
  };

  const cancel = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  };

  return (
    <div
      className="nodrag nopan absolute -top-9 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-1.5 py-1 rounded-lg bg-slate-900 border border-sky-500/70 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        placeholder="Value..."
        className="w-24 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 focus:border-sky-400 focus:outline-none font-mono text-[11px] text-amber-300 placeholder:text-slate-500"
      />
    </div>
  );
};
