import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Column, ColumnType, colDim, colBorder } from '../utils/dashboardUtils';
import { Short, Assignment, User } from '../../../shared/types';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const COLUMN_ICONS: Record<string, React.ReactNode> = {
  script:          <IconFileText    size={15} stroke={2} />,
  clips:           <IconScissors   size={15} stroke={2} />,
  clip_changes:    <IconAlertCircle size={15} stroke={2} />,
  editing:         <IconVideo       size={15} stroke={2} />,
  editing_changes: <IconRefresh     size={15} stroke={2} />,
  ready_to_upload: <IconCloudUpload size={15} stroke={2} />,
  uploaded:        <IconCircleCheck size={15} stroke={2} />,
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

// ─── Script sub-column static card ───────────────────────────────────────────
function StaticScriptCard({ short, onClick, isAdmin, currentUserId }: {
  short: Short;
  onClick: () => void;
  isAdmin: boolean;
  currentUserId?: number;
}) {
  const isActive = !!short.is_active;
  const writer = short.script_writer;
  const isYou = writer && currentUserId && writer.id === currentUserId;

  return (
    <div
      onClick={onClick}
      style={{
        background: isActive
          ? 'color-mix(in srgb, var(--gold) 6%, var(--card-bg))'
          : 'var(--card-bg)',
        border: '1px solid var(--border-default)',
        borderLeft: isActive ? '4px solid var(--gold)' : '4px solid transparent',
        borderRadius: '10px',
        padding: '11px 13px',
        cursor: 'pointer',
        transition: 'background 0.12s, border-color 0.12s, box-shadow 0.12s',
        boxShadow: isActive ? '0 0 0 1px var(--gold-border)' : undefined,
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = isActive
          ? 'color-mix(in srgb, var(--gold) 10%, var(--card-hover-bg))'
          : 'var(--card-hover-bg)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--card-hover-shadow)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = isActive
          ? 'color-mix(in srgb, var(--gold) 6%, var(--card-bg))'
          : 'var(--card-bg)';
        (e.currentTarget as HTMLElement).style.boxShadow = isActive ? '0 0 0 1px var(--gold-border)' : '';
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: short.description || short.idea ? '5px' : '8px', letterSpacing: '-0.01em' }}>
        {short.title}
      </div>
      {(short.description || short.idea) && (
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {short.description || short.idea}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
        {writer ? (
          <>
            <span style={{ fontSize: '15px', lineHeight: 1 }}>{writer.profile_picture || '👤'}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {writer.name || writer.discord_username}
            </span>
            {isYou && (
              <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'color-mix(in srgb, var(--gold) 15%, transparent)', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>YOU</span>
            )}
          </>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
        )}
      </div>
    </div>
  );
}

// ─── Script expanded sub-column ────────────────────────────────────────────────
function ScriptSubColumn({ title, color, cards, onCardClick, isAdmin, currentUserId, onCreateClick, showAdd }: {
  title: string;
  color: string;
  cards: Short[];
  onCardClick: (short: Short) => void;
  isAdmin: boolean;
  currentUserId?: number;
  onCreateClick?: () => void;
  showAdd?: boolean;
}) {
  return (
    <div style={{
      background: 'var(--column-bg)',
      border: '1px solid var(--border-default)',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      minWidth: '270px',
      height: 'calc(100vh - 220px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
          <IconFileText size={15} stroke={2} />
        </div>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </h3>
        <div style={{ fontSize: '12px', fontWeight: 700, color, background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, borderRadius: '6px', padding: '2px 8px', minWidth: '28px', textAlign: 'center', flexShrink: 0 }}>
          <AnimatedCount target={cards.length} />
        </div>
      </div>

      {/* Cards */}
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {cards.map((short, index) => (
            <motion.div key={short.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.22, ease: [0.4, 0, 0.2, 1] }}>
              <StaticScriptCard short={short} onClick={() => onCardClick(short)} isAdmin={isAdmin} currentUserId={currentUserId} />
            </motion.div>
          ))}
          {cards.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>Empty</div>
          )}
        </div>
      </div>

      {/* Add button (idea sub-column only) */}
      {isAdmin && showAdd && onCreateClick && (
        <div style={{ padding: '8px 12px 14px', flexShrink: 0 }}>
          <button
            onClick={onCreateClick}
            style={{ padding: '8px 12px', background: 'transparent', color, border: `1.5px dashed ${color}50`, borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', transition: 'background 0.18s' }}
            onMouseEnter={e => { e.currentTarget.style.background = `${color}16`; e.currentTarget.style.borderColor = color; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `${color}50`; }}
          >
            + Add Script
          </button>
        </div>
      )}
    </div>
  );
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
  onUnassign: (shortId: number, role: 'clipper' | 'editor' | 'script_writer') => Promise<void>;
  onToggleActive: (shortId: number) => Promise<void>;
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
  onUnassign,
  onToggleActive,
  onCreateClick,
  navigate,
  getShortsForColumn,
}: KanbanBoardProps) {
  const [scriptExpanded, setScriptExpanded] = useState(false);

  // Sub-column data (computed when script column is expanded)
  const scriptColumn = filteredColumns.find(c => c.id === 'script');
  const scriptCards = getShortsForColumn('script');
  const hasScriptContent = useCallback((s: Short) =>
    !!s.script_content || !!s.files?.some(f => f.file_type === 'script'), []);

  const ideaCards    = scriptCards.filter(s => !hasScriptContent(s));
  const writtenCards = scriptCards.filter(s => hasScriptContent(s) && !(s.scene_count));
  const scenesCards  = scriptCards.filter(s => !!(s.scene_count));

  const scriptColor  = scriptColumn?.color ?? 'var(--col-script)';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <style>{`
        div[data-kanban-grid]::-webkit-scrollbar { height: 6px; }
        div[data-kanban-grid]::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); border-radius: 4px; }
        div[data-kanban-grid]::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 4px; }
        div[data-kanban-grid]::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.35); }
        div[data-kanban-grid] { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.2) rgba(0,0,0,0.05); transition: grid-template-columns 0.3s ease-in-out; }
      `}</style>

      {/* ── Script expanded view ── */}
      {scriptExpanded && scriptColumn && (
        <div style={{ marginBottom: '24px' }}>
          {/* Back bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <button
              onClick={() => setScriptExpanded(false)}
              style={{ fontSize: '11px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 0 }}
            >
              ← All Columns
            </button>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>·</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Script</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{scriptCards.length} total</span>
          </div>
          {/* 3 sub-columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <ScriptSubColumn
              title="Idea"
              color={scriptColor}
              cards={ideaCards}
              onCardClick={s => navigate(`/shorts/${s.id}/scenes`)}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              showAdd
              onCreateClick={() => onCreateClick('script')}
            />
            <ScriptSubColumn
              title="Script Written"
              color={scriptColor}
              cards={writtenCards}
              onCardClick={s => navigate(`/shorts/${s.id}/scenes`)}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
            />
            <ScriptSubColumn
              title="Scenes Ready"
              color="var(--green)"
              cards={scenesCards}
              onCardClick={s => onCardClick(s, scriptColumn)}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      )}

      <div
        data-kanban-grid
        style={{
          display: scriptExpanded ? 'none' : 'grid',
          gridTemplateColumns: `repeat(${filteredColumns.length}, 1fr)`,
          gap: '14px',
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
                  padding: '16px 16px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  borderBottom: '1px solid var(--border-subtle)',
                  flexShrink: 0,
                }}>
                  {/* Icon badge */}
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: colDim(column.id),
                    border: `1px solid ${colBorder(column.id)}`,
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
                    fontSize: '13px',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {column.title}
                  </h3>

                  {/* Count badge */}
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: column.color,
                    background: colDim(column.id),
                    border: `1px solid ${colBorder(column.id)}`,
                    borderRadius: '6px',
                    padding: '2px 8px',
                    flexShrink: 0,
                    minWidth: '28px',
                    textAlign: 'center',
                  }}>
                    <AnimatedCount target={columnShorts.length} />
                  </div>

                  {/* Expand sub-columns button (script column only) */}
                  {column.id === 'script' && (
                    <button
                      onClick={() => setScriptExpanded(true)}
                      title="View by stage: Idea → Script → Scenes"
                      style={{
                        width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--border-default)',
                        background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        fontSize: '13px', lineHeight: 1, padding: 0,
                        transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = colDim('script'); e.currentTarget.style.color = column.color; e.currentTarget.style.borderColor = colBorder('script'); }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                    >
                      ⊞
                    </button>
                  )}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {columnShorts.map((short, index) => (
                        <motion.div
                          key={short.id}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04, duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
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
                            onUnassign={onUnassign}
                            onToggleActive={onToggleActive}
                            navigate={navigate}
                          />
                        </motion.div>
                      ))}

                      {columnShorts.length === 0 && (
                        <div style={{
                          textAlign: 'center',
                          padding: '28px 12px',
                          color: 'var(--text-muted)',
                          fontSize: '12px',
                          fontStyle: 'italic',
                          letterSpacing: '0.01em',
                        }}>
                          Empty
                        </div>
                      )}
                    </div>
                  </div>
                </SortableContext>

                {/* ── Add button (admin only) ── */}
                {isAdmin && column.canAdd && (
                  <div style={{ padding: '8px 12px 14px' }}>
                    <button
                      onClick={() => onCreateClick(column.id)}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        color: column.color,
                        border: `1.5px dashed ${column.color}50`,
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'background 0.18s ease, border-color 0.18s ease',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${column.color}16`;
                        e.currentTarget.style.borderColor = column.color;
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = `${column.color}50`;
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      + Add {column.title}
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
            background: 'var(--card-hover-bg)',
            border: '1.5px solid var(--gold-border)',
            borderRadius: '8px',
            padding: '12px 14px',
            boxShadow: 'var(--card-hover-shadow)',
            opacity: 0.96,
          }}>
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {activeShort.title}
            </h4>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
