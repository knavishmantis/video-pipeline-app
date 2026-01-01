import React from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DroppableColumn } from './DroppableColumn';
import { SortableCard } from './SortableCard';
import { Column, ColumnType } from '../utils/dashboardUtils';
import { Short, Assignment, User } from '../../../shared/types';

interface KanbanBoardProps {
  filteredColumns: Column[];
  shorts: Short[];
  assignments: Assignment[];
  users: User[];
  isAdmin: boolean;
  currentUserId?: number;
  sensors: any;
  activeId: string | null;
  activeShort: Short | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => Promise<void>;
  onCardClick: (short: Short, column: Column) => Promise<void>;
  onAssign: (shortId: number, role: 'clipper' | 'editor', userId: number) => Promise<void>;
  onCreateClick: (columnId: ColumnType) => void;
  navigate: (path: string) => void;
  getShortsForColumn: (columnId: ColumnType) => Short[];
}

export function KanbanBoard({
  filteredColumns,
  shorts,
  assignments,
  users,
  isAdmin,
  currentUserId,
  sensors,
  activeId,
  activeShort,
  onDragStart,
  onDragEnd,
  onCardClick,
  onAssign,
  onCreateClick,
  navigate,
  getShortsForColumn,
}: KanbanBoardProps) {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div 
        data-kanban-grid
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${filteredColumns.length}, 1fr)`,
          gap: '16px',
          overflowX: filteredColumns.length > 0 ? 'scroll' : 'visible',
          overflowY: 'hidden',
          paddingBottom: '0px',
          marginBottom: '24px',
          height: 'calc(100vh - 160px)',
          scrollbarGutter: 'stable',
          boxSizing: 'border-box',
        } as React.CSSProperties}
      >
        {filteredColumns.map((column) => {
          const columnShorts = getShortsForColumn(column.id);
          const sortableIds = columnShorts.map(s => `short-${s.id}`);

          return (
            <DroppableColumn key={column.id} column={column} shorts={columnShorts}>
              {/* Column Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '2px solid #F1F5F9',
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: column.color,
                  boxShadow: `0 0 8px ${column.color}40`,
                }} />
                <h3 style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1E293B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {column.title}
                </h3>
                <span style={{
                  marginLeft: 'auto',
                  background: '#F1F5F9',
                  color: '#64748B',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}>
                  {columnShorts.length}
                </span>
              </div>

              {/* Column Content */}
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <div style={{
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  flex: 1,
                  minHeight: 0,
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    paddingTop: '4px',
                    paddingBottom: '4px',
                  }}>
                    {columnShorts.map((short) => {
                      const canEdit = isAdmin || (
                        (column.id === 'clips' || column.id === 'clip_changes') && 
                        assignments.some(a => a.short_id === short.id && a.role === 'clipper' && a.user_id === currentUserId)
                      ) || (
                        (column.id === 'editing' || column.id === 'editing_changes') && 
                        assignments.some(a => a.short_id === short.id && a.role === 'editor' && a.user_id === currentUserId)
                      );
                      
                      return (
                        <SortableCard
                          key={short.id}
                          short={short}
                          column={column}
                          onClick={canEdit ? () => onCardClick(short, column) : undefined}
                          assignments={assignments}
                          users={users}
                          isAdmin={isAdmin}
                          currentUserId={currentUserId}
                          onAssign={onAssign}
                          navigate={navigate}
                        />
                      );
                    })}
                    {columnShorts.length === 0 && (
                      <div style={{
                        textAlign: 'center',
                        padding: '24px 12px',
                        color: '#94A3B8',
                        fontSize: '12px',
                      }}>
                        No items
                      </div>
                    )}
                  </div>
                </div>
              </SortableContext>

              {/* Add Button for Admin - at bottom */}
              {isAdmin && column.canAdd && (
                <button
                  onClick={() => onCreateClick(column.id)}
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: column.color,
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span>+</span> Add {column.title}
                </button>
              )}
            </DroppableColumn>
          );
        })}
      </div>

      <DragOverlay>
        {activeShort ? (
          <div style={{
            background: '#FFFFFF',
            border: '2px solid #3B82F6',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
            opacity: 0.9,
          }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
              {activeShort.title}
            </h4>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

