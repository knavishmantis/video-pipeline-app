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
        background: isOver ? '#F8FAFC' : '#FFFFFF',
        borderRadius: '12px',
        padding: '16px',
        paddingBottom: '24px', // Extra bottom padding to account for scrollbar
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: isOver ? `2px dashed ${column.color}` : '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 180px)', // Column height
        transition: 'all 0.2s',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
}

