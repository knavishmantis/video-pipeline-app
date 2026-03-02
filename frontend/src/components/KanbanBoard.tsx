import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
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
import {
  IconFileText,
  IconScissors,
  IconAlertCircle,
  IconVideo,
  IconRefresh,
  IconCloudUpload,
  IconCircleCheck,
} from '@tabler/icons-react';
import { DroppableColumn } from './DroppableColumn';
import { SortableCard } from './SortableCard';
import { Column, ColumnType } from '../utils/dashboardUtils';
import { Short, Assignment, User } from '../../../shared/types';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const COLUMN_ICONS: Record<string, React.ReactNode> = {
  script:          <IconFileText    size={16} stroke={2} />,
  clips:           <IconScissors   size={16} stroke={2} />,
  clip_changes:    <IconAlertCircle size={16} stroke={2} />,
  editing:         <IconVideo       size={16} stroke={2} />,
  editing_changes: <IconRefresh     size={16} stroke={2} />,
  ready_to_upload: <IconCloudUpload size={16} stroke={2} />,
  uploaded:        <IconCircleCheck size={16} stroke={2} />,
};

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedCount({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const from = countRef.current;
    const duration = 450;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (target - from) * eased);
      countRef.current = current;
      setCount(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        countRef.current = target;
        setCount(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target]);

  return <>{count}</>;
}

// ─── Props ────────────────────────────────────────────────────────────────────
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

// ─── Board ────────────────────────────────────────────────────────────────────
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
      <style>{`
        div[data-kanban-grid]::-webkit-scrollbar { height: 6px; }
        div[data-kanban-grid]::-webkit-scrollbar-track { background: #13131A; }
        div[data-kanban-grid]::-webkit-scrollbar-thumb { background: #2E2E3C; border-radius: 3px; }
        div[data-kanban-grid]::-webkit-scrollbar-thumb:hover { background: #F5A623; }
        div[data-kanban-grid] { scrollbar-width: thin; scrollbar-color: #2E2E3C #13131A; transition: grid-template-columns 0.3s ease-in-out; }
      `}</style>

      <div
        data-kanban-grid
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${filteredColumns.length}, 1fr)`,
          gap: '12px',
          overflowX: filteredColumns.length > 0 ? 'scroll' : 'visible',
          overflowY: 'hidden',
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
            <div key={column.id} style={{ minWidth: '270px' }}>
              <DroppableColumn column={column} shorts={columnShorts}>

                {/* ── Column header ── */}
                <div style={{
                  padding: '14px 16px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  borderBottom: '1px solid #2E2E3E',
                  flexShrink: 0,
                }}>
                  {/* Icon badge */}
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '5px',
                    background: `${column.color}18`,
                    border: `1px solid ${column.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: column.color,
                    flexShrink: 0,
                  }}>
                    {COLUMN_ICONS[column.id]}
                  </div>

                  {/* Column title */}
                  <h3 style={{
                    margin: 0,
                    fontFamily: 'Syne, sans-serif',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#EEEEF5',
                    letterSpacing: '-0.01em',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {column.title.toUpperCase()}
                  </h3>

                  {/* Count badge */}
                  <div style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: column.color,
                    background: `${column.color}15`,
                    border: `1px solid ${column.color}30`,
                    borderRadius: '4px',
                    padding: '2px 8px',
                    flexShrink: 0,
                    minWidth: '28px',
                    textAlign: 'center',
                  }}>
                    <AnimatedCount target={columnShorts.length} />
                  </div>
                </div>

                {/* ── Cards ── */}
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <div style={{
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    flex: 1,
                    minHeight: 0,
                    padding: '12px',
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}>
                      {columnShorts.map((short, index) => (
                        <motion.div
                          key={short.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: index * 0.04,
                            duration: 0.22,
                            ease: [0.4, 0, 0.2, 1],
                          }}
                        >
                          <SortableCard
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
                        </motion.div>
                      ))}

                      {columnShorts.length === 0 && (
                        <div style={{
                          textAlign: 'center',
                          padding: '24px 12px',
                          color: '#6E6E90',
                          fontSize: '12px',
                          fontFamily: 'DM Mono, monospace',
                          letterSpacing: '0.04em',
                        }}>
                          — EMPTY —
                        </div>
                      )}
                    </div>
                  </div>
                </SortableContext>

                {/* ── Add button (admin only) ── */}
                {isAdmin && column.canAdd && column.id !== 'script' && (
                  <div style={{ padding: '8px 12px 12px' }}>
                    <button
                      onClick={() => onCreateClick(column.id)}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        color: column.color,
                        border: `1px dashed ${column.color}40`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontFamily: 'DM Mono, monospace',
                        fontWeight: '500',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease-out',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${column.color}10`;
                        e.currentTarget.style.borderStyle = 'solid';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderStyle = 'dashed';
                      }}
                    >
                      + ADD {column.title.toUpperCase()}
                    </button>
                  </div>
                )}

              </DroppableColumn>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeShort ? (
          <div style={{
            background: '#1C1C24',
            border: '1px solid #F5A623',
            borderRadius: '5px',
            padding: '12px 14px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 16px rgba(245,166,35,0.2)',
            opacity: 0.95,
          }}>
            <h4 style={{ margin: 0, fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: '600', color: '#EEEEF5' }}>
              {activeShort.title}
            </h4>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
