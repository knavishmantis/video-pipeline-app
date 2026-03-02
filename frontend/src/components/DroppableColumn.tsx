import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Column, colBorder, colDim } from '../utils/dashboardUtils';
import { Short } from '../../../shared/types';

interface DroppableColumnProps {
  column: Column;
  children: React.ReactNode;
  shorts: Short[];
}

export function DroppableColumn({ column, children, shorts }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: '280px',
        background: isOver ? 'var(--column-hover-bg)' : 'var(--column-bg)',
        borderRadius: '10px',
        border: isOver
          ? `1px solid ${colBorder(column.id)}`
          : '1px solid var(--column-border)',
        borderTop: `3px solid ${column.color}`,
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 220px)',
        transition: 'background 0.15s ease-out, border-color 0.15s ease-out, box-shadow 0.15s ease-out',
        boxSizing: 'border-box',
        overflow: 'visible',
        boxShadow: isOver
          ? `0 0 0 2px ${colDim(column.id)}`
          : 'none',
      }}
    >
      {children}
    </div>
  );
}
