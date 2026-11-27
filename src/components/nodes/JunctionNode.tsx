import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CircuitNode } from '../../types/flow.ts';
import { useCircuitStore } from '../../store/circuitStore.ts';

export const JunctionNode: React.FC<NodeProps<CircuitNode>> = ({ data, selected }) => {
  const isSimulating = useCircuitStore((s) => s.isSimulating);
  const pinHigh = useCircuitStore((s) => s.simulationState.pinStates[`${data.id}.1`] === 1);
  const nodeVoltage = useCircuitStore((s) => s.simulationState.nodeVoltages[`${data.id}.1`] ?? 0);

  const isEnergized = isSimulating && pinHigh;
  const dotColor = isEnergized ? '#10b981' : '#64748b';
  const tooltip = isSimulating
    ? `${data.id} • ${nodeVoltage.toFixed(2)} V`
    : `${data.id} (Junction)`;

  return (
    <div
      title={tooltip}
      className="relative w-9 h-9 flex items-center justify-center group select-none touch-none"
    >
      {/* Solid 12px x 12px circular solder dot with subtle hover/selected ring */}
      <div
        style={{ backgroundColor: dotColor }}
        className={`w-3 h-3 rounded-full transition-all duration-150 ${
          selected
            ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-950 scale-110'
            : 'group-hover:ring-2 group-hover:ring-sky-400/70 group-hover:scale-110'
        } ${isEnergized ? 'shadow-[0_0_8px_rgba(16,185,129,0.8)]' : ''}`}
      />

      {/* Centered bidirectional handles with enlarged touch hit areas */}
      <Handle
        id="1"
        type="target"
        position={Position.Left}
        isConnectable={true}
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 24,
          height: 24,
          opacity: 0,
        }}
      />
      <Handle
        id="1"
        type="source"
        position={Position.Right}
        isConnectable={true}
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 24,
          height: 24,
          opacity: 0,
        }}
      />
    </div>
  );
};
