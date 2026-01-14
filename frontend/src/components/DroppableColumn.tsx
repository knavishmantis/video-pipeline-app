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
        background: isOver 
          ? `linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)` 
          : `linear-gradient(135deg, #FFFFFF 0%, #FAFBFC 100%)`,
        borderRadius: '16px',
        padding: '24px',
        paddingBottom: '24px', // Extra bottom padding to account for scrollbar
        boxShadow: isOver 
          ? `0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)` 
          : `0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)`,
        border: isOver ? `2px solid ${column.color}40` : `1px solid #E8ECF1`,
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 220px)', // Column height
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      {children}
    </div>
  );
}

