import React, { useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { useCircuitStore } from '../../store/circuitStore.ts';
import type { ComponentType } from '../../types/circuit.ts';

const BI_DIRECTIONAL_COMPONENTS = new Set<ComponentType>([
  'Resistor',
  'Capacitor',
  'Switch',
  'Junction',
  'Ohmmeter',
]);

const DIRECTIONAL_COMPONENTS = new Set<ComponentType>([
  'LED',
  'Buzzer',
  'AND',
  'OR',
  'NOT',
  'NAND',
  'NOR',
  'XOR',
  'XNOR',
  'D_FlipFlop',
  'JK_FlipFlop',
  'Clock',
  'ESP32_30Pin',
]);

const isBidirectionalEdge = (
  sourceType: ComponentType | undefined,
  targetType: ComponentType | undefined
): boolean => {
  const hasDirectionalEndpoint =
    (sourceType !== undefined && DIRECTIONAL_COMPONENTS.has(sourceType)) ||
    (targetType !== undefined && DIRECTIONAL_COMPONENTS.has(targetType));
  const hasBidirectionalEndpoint =
    (sourceType !== undefined && BI_DIRECTIONAL_COMPONENTS.has(sourceType)) ||
    (targetType !== undefined && BI_DIRECTIONAL_COMPONENTS.has(targetType));

  return !hasDirectionalEndpoint && hasBidirectionalEndpoint;
};

const sanitizeMarkerId = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, '_');

export const WireEdge: React.FC<EdgeProps> = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  selected,
  style,
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
  const components = useCircuitStore((s) => s.graph.components);

  const sourceType = components.find((c) => c.id === source)?.type;
  const targetType = components.find((c) => c.id === target)?.type;
  const bidirectional = isBidirectionalEdge(sourceType, targetType);

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

  const strokeColor =
    typeof wireStyle?.stroke === 'string' ? wireStyle.stroke : '#38bdf8';
  const markerId = `wire-arrow-${sanitizeMarkerId(id)}-${sanitizeMarkerId(strokeColor)}`;
  const markerUrl = `url(#${markerId})`;

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
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          markerUnits="strokeWidth"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 L 2.5 5 Z" fill={strokeColor} />
        </marker>
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        style={wireStyle}
        markerStart={bidirectional ? markerUrl : undefined}
        markerEnd={markerUrl}
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
