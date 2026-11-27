import React, { useRef, useState } from 'react';
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
  const touchHandledRef = useRef(false);
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

  const handleBranchEvent = (
    e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    const point = 'changedTouches' in e ? e.changedTouches[0] : e;
    if (!point) return;
    handleBranchAtPoint(point.clientX, point.clientY);
  };

  const handleBranchClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (touchHandledRef.current) return;
    handleBranchEvent(e);
  };

  const handleBranchTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    touchHandledRef.current = true;
    window.setTimeout(() => {
      touchHandledRef.current = false;
    }, 600);
    handleBranchEvent(e);
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

      {/* Wide transparent hit-target path so taps select the wire reliably on touch screens */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={28}
        style={{ pointerEvents: 'stroke' }}
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
              onClick={handleBranchClick}
              onTouchEnd={handleBranchTouchEnd}
              title="Add wire junction"
              aria-label="Add wire junction"
              className="nodrag nopan w-8 h-8 rounded-full bg-slate-900/95 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/70 shadow-lg flex items-center justify-center text-lg font-bold transition-all hover:scale-110 touch-none"
            >
              +
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
