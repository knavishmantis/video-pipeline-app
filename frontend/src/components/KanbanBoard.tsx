import React from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  useSensors,
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
  sensors: ReturnType<typeof useSensors>;
  activeId: string | null;
  activeShort: Short | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => Promise<void>;
  onCardClick: (short: Short, column: Column) => Promise<void>;
  onAssign: (shortId: number, role: 'clipper' | 'editor' | 'script_writer', userId: number) => Promise<void>;
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
          height: 'calc(100vh - 180px)',
          scrollbarGutter: 'stable',
          boxSizing: 'border-box',
        } as React.CSSProperties}
      >
        {filteredColumns.map((column) => {
          const columnShorts = getShortsForColumn(column.id);
          const sortableIds = columnShorts.map(s => `short-${s.id}`);

          return (
            <div
              key={column.id}
              style={{
                opacity: 1,
                transition: 'opacity 0.3s ease-in-out',
                minWidth: '280px',
              }}
            >
              <DroppableColumn column={column} shorts={columnShorts}>
              {/* Column Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '20px',
                paddingBottom: '14px',
                borderBottom: '1px solid #E8ECF1',
              }}>
                <div style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${column.color} 0%, ${column.color}dd 100%)`,
                  boxShadow: `0 2px 8px ${column.color}50`,
                }} />
                <h3 style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: '700',
                  color: '#0F172A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {column.title}
                </h3>
                <span style={{
                  marginLeft: 'auto',
                  background: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)',
                  color: '#475569',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
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
                      // Cards are always clickable - users can view even if not assigned
                      return (
                        <SortableCard
                          key={short.id}
                          short={short}
                          column={column}
                          onClick={() => onCardClick(short, column)}
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
              {/* Note: 'script' column no longer has add button - use Script Pipeline instead */}
              {isAdmin && column.canAdd && column.id !== 'script' && (
                <button
                  onClick={() => onCreateClick(column.id)}
                  style={{
                    marginTop: '16px',
                    padding: '10px 16px',
                    background: `linear-gradient(135deg, ${column.color} 0%, ${column.color}dd 100%)`,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease-in-out',
                    boxShadow: `0 2px 4px ${column.color}40`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = `0 4px 8px ${column.color}50`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = `0 2px 4px ${column.color}40`;
                  }}
                >
                  <span>+</span> Add {column.title}
                </button>
              )}
            </DroppableColumn>
            </div>
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

