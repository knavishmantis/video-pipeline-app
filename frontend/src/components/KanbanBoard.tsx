import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  useSensors,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
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

// ─── Script sub-column draggable card ────────────────────────────────────────
function DraggableScriptCard({ short, onClick, currentUserId, isDragging }: {
  short: Short;
  onClick: () => void;
  currentUserId?: number;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `sub-${short.id}`, data: { shortId: short.id } });
  const isActive = !!short.is_active;
  const writer = short.script_writer;
  const isYou = writer && currentUserId && writer.id === currentUserId;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{
        background: isActive ? 'color-mix(in srgb, var(--gold) 6%, var(--card-bg))' : 'var(--card-bg)',
        border: '1px solid var(--border-default)',
        borderLeft: isActive ? '4px solid var(--gold)' : '4px solid transparent',
        borderRadius: '10px',
        padding: '11px 13px',
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'background 0.12s, box-shadow 0.12s',
        boxShadow: isActive ? '0 0 0 1px var(--gold-border)' : undefined,
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
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

// ─── Script expanded sub-column (droppable) ───────────────────────────────────
function ScriptSubColumn({ id, title, color, cards, onCardClick, isAdmin, currentUserId, onCreateClick, showAdd, activeDragId }: {
  id: string;
  title: string;
  color: string;
  cards: Short[];
  onCardClick: (short: Short) => void;
  isAdmin: boolean;
  currentUserId?: number;
  onCreateClick?: () => void;
  showAdd?: boolean;
  activeDragId?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div style={{
      background: isOver ? `color-mix(in srgb, ${color} 6%, var(--bg-base))` : 'var(--bg-base)',
      border: isOver ? `1px solid color-mix(in srgb, ${color} 45%, var(--border-subtle))` : '1px solid var(--border-subtle)',
      borderRadius: '10px',
      display: 'flex',
      flexDirection: 'column',
      minWidth: '220px',
      height: '100%',
      overflow: 'hidden',
      transition: 'background 0.12s, border-color 0.12s',
    }}>
      {/* Minimal header — dot + title + count */}
      <div style={{ padding: '10px 12px 9px', display: 'flex', alignItems: 'center', gap: '7px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0, display: 'block', opacity: 0.85 }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', flex: 1 }}>{title}</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color, background: `color-mix(in srgb, ${color} 12%, transparent)`, borderRadius: '5px', padding: '1px 7px', minWidth: '22px', textAlign: 'center' }}>
          <AnimatedCount target={cards.length} />
        </span>
      </div>

      {/* Cards */}
      <div ref={setNodeRef} style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', minHeight: '40px' }}>
          {cards.map((short, index) => (
            <motion.div key={short.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.2, ease: [0.4, 0, 0.2, 1] }}>
              <DraggableScriptCard
                short={short}
                onClick={() => onCardClick(short)}
                currentUserId={currentUserId}
                isDragging={activeDragId === `sub-${short.id}`}
              />
            </motion.div>
          ))}
          {cards.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 10px', color: isOver ? color : 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', transition: 'color 0.12s' }}>
              {isOver ? 'Drop here' : 'Empty'}
            </div>
          )}
        </div>
      </div>

      {/* Add button (idea sub-column only) */}
      {isAdmin && showAdd && onCreateClick && (
        <div style={{ padding: '7px 10px 10px', flexShrink: 0 }}>
          <button
            onClick={onCreateClick}
            style={{ padding: '7px 10px', background: 'transparent', color, border: `1.5px dashed ${color}40`, borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', width: '100%', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = `${color}12`; e.currentTarget.style.borderColor = `${color}80`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `${color}40`; }}
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
  onSubStageChange: (shortId: number, stage: 'idea' | 'written' | 'scenes') => Promise<void>;
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
  onSubStageChange,
}: KanbanBoardProps) {
  const [scriptExpanded, setScriptExpandedState] = useState(() => {
    try { return sessionStorage.getItem('kanban_script_expanded') === '1'; } catch { return false; }
  });
  const setScriptExpanded = (val: boolean) => {
    try { sessionStorage.setItem('kanban_script_expanded', val ? '1' : '0'); } catch {}
    setScriptExpandedState(val);
  };

  const [subActiveDragId, setSubActiveDragId] = useState<string | null>(null);
  const subSensors = [useSensor(PointerSensor, { activationConstraint: { distance: 6 } })];

  // Sub-column data (computed when script column is expanded)
  const scriptColumn = filteredColumns.find(c => c.id === 'script');
  const scriptCards = getShortsForColumn('script');

  const subActiveShort = subActiveDragId
    ? scriptCards.find(s => `sub-${s.id}` === subActiveDragId) ?? null
    : null;
  const hasScriptContent = useCallback((s: Short) =>
    !!s.script_content || !!s.files?.some(f => f.file_type === 'script'), []);

  // Determine sub-stage: explicit override takes priority, else auto-detect
  const getSubStage = useCallback((s: Short): 'idea' | 'written' | 'scenes' => {
    if (s.script_sub_stage) return s.script_sub_stage;
    if (s.scene_count) return 'scenes';
    if (hasScriptContent(s)) return 'written';
    return 'idea';
  }, [hasScriptContent]);

  const ideaCards    = scriptCards.filter(s => getSubStage(s) === 'idea');
  const writtenCards = scriptCards.filter(s => getSubStage(s) === 'written');
  const scenesCards  = scriptCards.filter(s => getSubStage(s) === 'scenes');

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
        <div style={{
          marginBottom: '24px',
          border: `1px solid color-mix(in srgb, ${scriptColor} 25%, var(--border-default))`,
          borderRadius: '14px',
          background: `color-mix(in srgb, ${scriptColor} 3%, var(--column-bg))`,
          overflow: 'hidden',
          height: 'calc(100vh - 180px)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Container header — Script label + collapse */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 16px 11px',
            borderBottom: `1px solid color-mix(in srgb, ${scriptColor} 18%, var(--border-subtle))`,
            background: `color-mix(in srgb, ${scriptColor} 6%, var(--bg-elevated))`,
            flexShrink: 0,
          }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: colDim('script'), border: `1px solid ${colBorder('script')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: scriptColor, flexShrink: 0 }}>
              <IconFileText size={13} stroke={2} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Script</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{scriptCards.length} total</span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setScriptExpanded(false)}
              style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '5px', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 10px', transition: 'color 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.color = scriptColor; e.currentTarget.style.borderColor = `color-mix(in srgb, ${scriptColor} 40%, var(--border-default))`; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            >
              ← All Columns
            </button>
          </div>

          {/* 3 sub-columns */}
          <DndContext
            sensors={subSensors}
            onDragStart={e => setSubActiveDragId(String(e.active.id))}
            onDragEnd={e => {
              setSubActiveDragId(null);
              const shortId = e.active.data.current?.shortId as number | undefined;
              const toStage = e.over?.id as 'idea' | 'written' | 'scenes' | undefined;
              if (shortId && toStage && ['idea', 'written', 'scenes'].includes(toStage)) {
                onSubStageChange(shortId, toStage);
              }
            }}
            onDragCancel={() => setSubActiveDragId(null)}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '12px', flex: 1, minHeight: 0 }}>
              <ScriptSubColumn
                id="idea"
                title="Idea"
                color={scriptColor}
                cards={ideaCards}
                onCardClick={s => navigate(`/shorts/${s.id}/scenes`)}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                showAdd
                onCreateClick={() => onCreateClick('script')}
                activeDragId={subActiveDragId}
              />
              <ScriptSubColumn
                id="written"
                title="Script Written"
                color={scriptColor}
                cards={writtenCards}
                onCardClick={s => navigate(`/shorts/${s.id}/scenes`)}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                activeDragId={subActiveDragId}
              />
              <ScriptSubColumn
                id="scenes"
                title="Scenes Ready"
                color="var(--green)"
                cards={scenesCards}
                onCardClick={s => onCardClick(s, scriptColumn)}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                activeDragId={subActiveDragId}
              />
            </div>
            <DragOverlay dropAnimation={null}>
              {subActiveShort ? (
                <div style={{
                  width: '220px',
                  background: !!subActiveShort.is_active ? 'color-mix(in srgb, var(--gold) 6%, var(--card-bg))' : 'var(--card-bg)',
                  border: '1px solid var(--border-default)',
                  borderLeft: !!subActiveShort.is_active ? '4px solid var(--gold)' : '4px solid transparent',
                  borderRadius: '10px',
                  padding: '11px 13px',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
                  cursor: 'grabbing',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: (subActiveShort.description || subActiveShort.idea) ? '5px' : '8px', letterSpacing: '-0.01em' }}>
                    {subActiveShort.title}
                  </div>
                  {(subActiveShort.description || subActiveShort.idea) && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {subActiveShort.description || subActiveShort.idea}
                    </div>
                  )}
                  {subActiveShort.script_writer && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px', lineHeight: 1 }}>{subActiveShort.script_writer.profile_picture || '👤'}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {subActiveShort.script_writer.name || subActiveShort.script_writer.discord_username}
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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

      <DragOverlay dropAnimation={null}>
        {activeShort ? (() => {
          const col = filteredColumns.find(c => c.id === activeShort.status);
          const isActive = !!activeShort.is_active && col?.id === 'script';
          const leftColor = isActive ? 'var(--gold)' : (col?.color ?? 'var(--text-muted)');
          return (
            <div style={{
              width: '270px',
              background: isActive ? 'color-mix(in srgb, var(--gold) 6%, var(--card-bg))' : 'var(--card-bg)',
              border: isActive ? '1px solid var(--gold-border)' : '1px solid var(--border-default)',
              borderLeft: isActive ? '4px solid var(--gold)' : `4px solid ${leftColor}`,
              borderRadius: '8px',
              padding: '11px 12px 34px',
              boxShadow: '0 8px 28px rgba(0,0,0,0.32)',
              position: 'relative',
              cursor: 'grabbing',
            }}>
              {/* Status dot */}
              <div style={{ position: 'absolute', top: '13px', left: '12px', width: '10px', height: '10px', borderRadius: '50%', background: leftColor }} />
              {/* Title */}
              <h4 style={{ margin: 0, marginBottom: '5px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.45', letterSpacing: '-0.01em', paddingLeft: '18px', paddingRight: '20px' }}>
                {activeShort.title}
              </h4>
              {(activeShort.description || activeShort.idea) && (
                <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.55', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                  {activeShort.description || (activeShort.idea ? `💡 ${activeShort.idea}` : '')}
                </p>
              )}
              {/* Bottom right: column label */}
              <div style={{ position: 'absolute', bottom: '8px', right: '10px' }}>
                <span style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: leftColor }}>
                  {col?.title ?? ''}
                </span>
              </div>
            </div>
          );
        })() : null}
      </DragOverlay>
    </DndContext>
  );
}
