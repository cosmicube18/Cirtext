import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { PinDefinition } from '../../types/circuit.ts';
import { InlineValueEditor } from './InlineValueEditor.tsx';

export type BaseNodeLayout = 'horizontal' | 'vertical' | 'ground';

export interface BaseNodeProps {
  id: string;
  title: string;
  subtitle?: React.ReactNode;
  editableValue?: string;
  selected?: boolean;
  pins: PinDefinition[];
  layout?: BaseNodeLayout;
  children: React.ReactNode;
}

const POSITION_MAP: Record<'top' | 'bottom' | 'left' | 'right', Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

const LAYOUT_CLASS: Record<BaseNodeLayout, string> = {
  horizontal: 'w-20 h-9',
  vertical: 'w-11 h-12',
  ground: 'w-9 h-9',
};

const LABEL_POSITION_CLASS: Record<BaseNodeLayout, string> = {
  horizontal: 'bottom-full mb-1',
  vertical: 'top-full mt-1',
  ground: 'top-full mt-1',
};

export const BaseNode: React.FC<BaseNodeProps> = ({
  id,
  title,
  subtitle,
  editableValue,
  selected = false,
  pins,
  layout = 'horizontal',
  children,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const canEdit = editableValue !== undefined;
  const labelEditable = canEdit && selected;

  const openEditor = (e: React.MouseEvent) => {
    if (!canEdit) return;
    e.stopPropagation();
    setIsEditing(true);
  };

  const hasSubtitle = subtitle !== undefined && subtitle !== null && subtitle !== '';

  return (
    <div
      onDoubleClick={canEdit ? openEditor : undefined}
      className={`relative group select-none transition-all duration-150 ${LAYOUT_CLASS[layout]} ${
        selected ? 'rounded ring-1 ring-amber-400/70' : ''
      }`}
    >
      {isEditing && canEdit && (
        <InlineValueEditor
          nodeId={id}
          initialValue={editableValue}
          onClose={() => setIsEditing(false)}
        />
      )}

      {/* Compact floating schematic label */}
      <span
        onClick={labelEditable ? openEditor : undefined}
        title={canEdit ? 'Double-click to edit value' : undefined}
        className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] leading-none ${
          LABEL_POSITION_CLASS[layout]
        } ${
          labelEditable
            ? 'nodrag nopan pointer-events-auto cursor-text text-amber-200 hover:text-amber-100'
            : 'pointer-events-none'
        }`}
      >
        <span className="text-sky-300 font-semibold">{title}</span>
        {hasSubtitle && (
          <>
            <span className="mx-0.5 text-slate-500">·</span>
            {typeof subtitle === 'string' ? (
              <span className="text-amber-300 font-medium">{subtitle}</span>
            ) : (
              subtitle
            )}
          </>
        )}
      </span>

      {/* Bare SVG schematic symbol */}
      <div className="w-full h-full flex items-center justify-center">
        {children}
      </div>

      {/* Terminal pin handles flush with symbol lead ends */}
      {pins.map((pin) => {
        const rfPosition = POSITION_MAP[pin.position];

        const badgePositionClass = {
          top: '-top-6 left-1/2 -translate-x-1/2',
          bottom: '-bottom-6 left-1/2 -translate-x-1/2',
          left: '-left-7 top-1/2 -translate-y-1/2',
          right: '-right-7 top-1/2 -translate-y-1/2',
        }[pin.position];

        return (
          <React.Fragment key={pin.id}>
            <Handle
              type="source"
              position={rfPosition}
              id={pin.id}
              className="!w-2.5 !h-2.5 !border !border-sky-400 !bg-slate-950 hover:!bg-sky-400 hover:!scale-125 transition-all"
            />
            <span
              className={`absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono font-semibold px-1 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700 shadow z-20 ${badgePositionClass}`}
            >
              {pin.id}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};
