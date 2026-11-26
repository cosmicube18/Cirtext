import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { useCircuitStore } from '../../store/circuitStore.ts';

export const WireEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  selected,
  style,
  markerStart,
  markerEnd,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  pathOptions,
}) => {
  const [hovered, setHovered] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const branchFromEdge = useCircuitStore((s) => s.branchFromEdge);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: pathOptions?.borderRadius,
    offset: pathOptions?.offset,
  });

  const wireStyle: React.CSSProperties = selected
    ? {
        ...style,
        stroke: '#f59e0b',
        strokeWidth: 4,
        filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.85))',
      }
    : (style as React.CSSProperties);

  const handleBranchAtPoint = (clientX: number, clientY: number) => {
    const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
    branchFromEdge(id, { x: flowPos.x - 8, y: flowPos.y - 8 });
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={wireStyle}
        markerStart={markerStart}
        markerEnd={markerEnd}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
      />

      {/* Transparent hit-target path for hover detection & Shift/Alt+Click anywhere on wire */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        className="react-flow__edge-interaction cursor-crosshair"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          if (e.shiftKey || e.altKey) {
            e.stopPropagation();
            handleBranchAtPoint(e.clientX, e.clientY);
          }
        }}
      />

      {(selected || hovered) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan z-20"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                branchFromEdge(id, { x: labelX - 8, y: labelY - 8 });
              }}
              title="Add wire junction (or Shift+Click anywhere on wire)"
              className="w-5 h-5 rounded-full bg-slate-900/95 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/70 shadow-lg flex items-center justify-center text-xs font-bold transition-all hover:scale-110"
            >
              +
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
