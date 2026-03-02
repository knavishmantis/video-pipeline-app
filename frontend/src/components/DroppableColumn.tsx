import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Column } from '../utils/dashboardUtils';
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
        background: isOver ? '#1F1F28' : '#18181F',
        borderRadius: '6px',
        border: isOver
          ? `1px solid ${column.color}66`
          : '1px solid #32323E',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 220px)',
        transition: 'all 0.2s ease-out',
        boxSizing: 'border-box',
        overflow: 'visible',
        /* Top accent line in the column's color */
        borderTop: isOver
          ? `2px solid ${column.color}`
          : `2px solid ${column.color}`,
        boxShadow: isOver
          ? `0 0 0 1px ${column.color}22, inset 0 0 32px ${column.color}08`
          : 'none',
      }}
    >
      {children}
    </div>
  );
}
