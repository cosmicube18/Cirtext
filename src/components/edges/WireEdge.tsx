import React from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

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
        interactionWidth={0}
      />

      {/* Wide invisible hit-target so the thin wire is easy to click and select */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={7}
        style={{ pointerEvents: 'all', cursor: 'pointer' }}
      />
    </>
  );
};
