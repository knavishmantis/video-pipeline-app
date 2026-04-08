import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Short, Assignment, User } from '../../../shared/types';
import { Column } from '../utils/dashboardUtils';
import { TimezoneDisplay } from './TimezoneDisplay';

interface SortableCardProps {
  short: Short;
  column: Column;
  onClick?: () => void;
  assignments: Assignment[];
  users: User[];
  isAdmin: boolean;
  currentUserId?: number;
  onAssign: (shortId: number, role: 'clipper' | 'editor' | 'script_writer', userId: number) => void;
  onUnassign?: (shortId: number, role: 'clipper' | 'editor' | 'script_writer') => void;
  onToggleActive?: (shortId: number) => Promise<void>;
  navigate: (path: string) => void;
}

export function SortableCard({
  short,
  column,
  onClick,
  assignments,
  users,
  isAdmin,
  currentUserId,
  onAssign,
  onUnassign,
  onToggleActive,
  navigate,
}: SortableCardProps) {
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const assignButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const shortAssignments = assignments.filter(a => a.short_id === short.id);
  const scripter = short.script_writer;
  const clipper = shortAssignments.find(a => a.role === 'clipper')?.user;
  const editor = shortAssignments.find(a => a.role === 'editor')?.user;

  const getDefaultRole = () => {
    if (column.id === 'script' && scripter) return { type: 'scripter', user: scripter };
    if ((column.id === 'clips' || column.id === 'clip_changes') && clipper) return { type: 'clipper', user: clipper };
    if ((column.id === 'editing' || column.id === 'editing_changes') && editor) return { type: 'editor', user: editor };
    return null;
  };

  const defaultRole = getDefaultRole();

  // ── Card state computation ────────────────────────────────────────────────────
  const hasScript     = short.files?.some(f => f.file_type === 'script');
  const hasAudio      = short.files?.some(f => f.file_type === 'audio');
  const hasClipsZip   = short.files?.some(f => f.file_type === 'clips_zip');
  const hasFinalVideo = short.files?.some(f => f.file_type === 'final_video');

  type CardState = 'unassigned' | 'in_progress' | 'complete' | 'changes' | 'done';
  const getCardState = (): CardState => {
    if (column.id === 'clip_changes' || column.id === 'editing_changes') return 'changes';
    if (column.id === 'uploaded') return 'done';
    if (column.id === 'script') {
      if (!scripter) return 'unassigned';
      const scriptDone = short.status === 'script' || !!hasScript || !!short.script_content;
      if (!scriptDone || !hasAudio) return 'in_progress';
      return 'complete';
    }
    if (column.id === 'clips') {
      if (!clipper) return 'unassigned';
      if (!hasClipsZip) return 'in_progress';
      return 'complete';
    }
    if (column.id === 'editing') {
      if (!editor) return 'unassigned';
      if (!hasFinalVideo) return 'in_progress';
      return 'complete';
    }
    return 'in_progress';
  };
  const cardState = getCardState();
  const isMyCard = !!defaultRole && defaultRole.user.id === currentUserId;

  const stateConfig: Record<CardState, { label: string; color: string; dotSize: number; glow: boolean }> = {
    unassigned:  { label: 'Unassigned',  color: 'var(--text-muted)',  dotSize: 10, glow: false },
    in_progress: { label: 'In Progress', color: 'var(--gold)',           dotSize: 10, glow: true  },
    complete:    { label: 'Ready',       color: 'var(--green)',         dotSize: 10, glow: false },
    changes:     { label: 'Changes',     color: 'var(--gold)',            dotSize: 10, glow: true  },
    done:        { label: 'Done',        color: 'var(--green)',         dotSize: 10, glow: false },
  };
  const cfg = stateConfig[cardState];

  const getProfilePicture = (user: User) => {
    if (user.profile_picture) {
      if (user.profile_picture.startsWith('http')) return user.profile_picture;
      return user.profile_picture;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=F0EBE0&color=B8922E&size=32&bold=true`;
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `short-${short.id}`,
    disabled: !isAdmin,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  // ── Status dot ───────────────────────────────────────────────────────────────
  const renderStatusDot = () => (
    <div
      title={cfg.label}
      style={{
        position: 'absolute',
        top: '13px',
        left: '12px',
        width: `${cfg.dotSize}px`,
        height: `${cfg.dotSize}px`,
        borderRadius: '50%',
        background: cfg.color,
        flexShrink: 0,
        transition: 'box-shadow 0.2s',
        ...(cfg.glow ? { boxShadow: `0 0 0 3px ${cfg.color}22, 0 0 8px ${cfg.color}55` } : {}),
      }}
    />
  );

  const isActive = !!short.is_active && column.id === 'script';

  return (
    <div
      ref={setNodeRef}
      {...(isAdmin ? attributes : {})}
      {...(isAdmin ? listeners : {})}
      style={{
        ...style,
        background: isActive ? 'color-mix(in srgb, var(--gold) 6%, var(--card-bg))' : isMyCard ? 'var(--bg-elevated)' : 'var(--card-bg)',
        border: isActive ? '1px solid var(--gold-border)' : '1px solid var(--border-default)',
        borderLeft: isActive ? '4px solid var(--gold)' : `4px solid ${cfg.color}`,
        borderRadius: '8px',
        padding: '11px 12px 34px',
        cursor: isAdmin ? (isDragging ? 'grabbing' : 'grab') : (onClick ? 'pointer' : 'default'),
        transition: isDragging ? 'none' : 'background 0.15s ease-out, box-shadow 0.15s ease-out, transform 0.15s ease-out',
        position: 'relative',
        boxShadow: isActive ? '0 0 0 1px var(--gold-border), var(--card-shadow)' : 'var(--card-shadow)',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.background = 'var(--card-hover-bg)';
          e.currentTarget.style.boxShadow = 'var(--card-hover-shadow)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.background = isActive
            ? 'color-mix(in srgb, var(--gold) 6%, var(--card-bg))'
            : isMyCard ? 'var(--bg-elevated)' : 'var(--card-bg)';
          e.currentTarget.style.boxShadow = isActive ? '0 0 0 1px var(--gold-border), var(--card-shadow)' : 'var(--card-shadow)';
          e.currentTarget.style.transform = 'translateY(0)';
          setShowAssignMenu(false);
          setMenuPosition(null);
        }
      }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.assign-menu') &&
            !(e.target as HTMLElement).closest('.assign-button')) {
          onClick?.();
        }
      }}
    >
      {/* Admin settings button */}
      {isAdmin && !isDragging && (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/shorts/${short.id}`); }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '22px',
            height: '22px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: '6px',
            transition: 'all 0.15s ease',
            zIndex: 2,
            color: 'var(--text-muted)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          title="Edit settings"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      )}

      {/* Active toggle button */}
      {isAdmin && onToggleActive && !isDragging && column.id === 'script' && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleActive(short.id); }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '34px',
            width: '22px',
            height: '22px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isActive ? 'color-mix(in srgb, var(--gold) 20%, transparent)' : 'transparent',
            border: isActive ? '1px solid var(--gold-border)' : 'none',
            borderRadius: '6px',
            transition: 'all 0.15s ease',
            zIndex: 2,
            color: isActive ? 'var(--gold)' : 'var(--text-muted)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isActive ? 'color-mix(in srgb, var(--gold) 30%, transparent)' : 'var(--border-subtle)';
            e.currentTarget.style.color = 'var(--gold)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isActive ? 'color-mix(in srgb, var(--gold) 20%, transparent)' : 'transparent';
            e.currentTarget.style.color = isActive ? 'var(--gold)' : 'var(--text-muted)';
          }}
          title={isActive ? 'Mark as inactive' : 'Mark as active'}
        >
          {/* Bolt/lightning icon */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </button>
      )}


      {/* Assign button */}
      {isAdmin && (column.id === 'script' || column.id === 'clips' || column.id === 'editing') && !isDragging && (
        <>
          <button
            ref={assignButtonRef}
            className="assign-button"
            onClick={(e) => {
              e.stopPropagation();
              if (!showAssignMenu && assignButtonRef.current) {
                const rect = assignButtonRef.current.getBoundingClientRect();
                setMenuPosition({ top: rect.bottom + 4, left: rect.left });
                setShowAssignMenu(true);
              } else {
                setShowAssignMenu(false);
                setMenuPosition(null);
              }
            }}
            style={{
              position: 'absolute',
              top: '8px',
              right: column.id === 'script' ? '60px' : '34px',
              width: '22px',
              height: '22px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              transition: 'all 0.15s ease',
              zIndex: 3,
              color: 'var(--text-muted)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title={column.id === 'script' ? (scripter ? 'Reassign Script Writer' : 'Assign Script Writer') : column.id === 'clips' ? (clipper ? 'Reassign Clipper' : 'Assign Clipper') : (editor ? 'Reassign Editor' : 'Assign Editor')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          </button>

          {showAssignMenu && menuPosition && createPortal(
            <div
              className="assign-menu"
              style={{
                position: 'fixed',
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                background: 'var(--modal-bg)',
                border: '1px solid var(--modal-border)',
                borderRadius: '8px',
                padding: '10px',
                boxShadow: 'var(--modal-shadow)',
                zIndex: 10000,
                minWidth: '220px',
                maxWidth: '280px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.06em',
                marginBottom: '8px',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                paddingLeft: '4px',
              }}>
                {(column.id === 'script' && scripter) || (column.id === 'clips' && clipper) || (column.id === 'editing' && editor)
                  ? `Reassign ${column.id === 'script' ? 'Script Writer' : column.id === 'clips' ? 'Clipper' : 'Editor'}`
                  : `Assign ${column.id === 'script' ? 'Script Writer' : column.id === 'clips' ? 'Clipper' : 'Editor'}`
                }
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {users
                  .filter(u => {
                    if (column.id === 'script') return u.roles?.includes('script_writer') || u.role === 'script_writer';
                    if (column.id === 'clips') return u.roles?.includes('clipper') || u.role === 'clipper';
                    return u.roles?.includes('editor') || u.role === 'editor';
                  })
                  .map(u => (
                    <div
                      key={u.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        const role = column.id === 'script' ? 'script_writer' : column.id === 'clips' ? 'clipper' : 'editor';
                        onAssign(short.id, role, u.id);
                        setShowAssignMenu(false);
                        setMenuPosition(null);
                      }}
                      style={{
                        padding: '7px 8px',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.15s ease',
                        color: 'var(--text-primary)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gold-dim)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {u.profile_picture && !u.profile_picture.startsWith('http') ? (
                        <span style={{ fontSize: '14px' }}>{u.profile_picture}</span>
                      ) : (
                        <img
                          src={getProfilePicture(u)}
                          alt={u.name}
                          style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-default)' }}
                        />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.discord_username || u.name}
                      </span>
                    </div>
                  ))}
              </div>
              {onUnassign && ((column.id === 'script' && scripter) || (column.id === 'clips' && clipper) || (column.id === 'editing' && editor)) && (
                <>
                  <div style={{ height: '1px', background: 'var(--border-default)', margin: '8px 0' }} />
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const role = column.id === 'script' ? 'script_writer' : column.id === 'clips' ? 'clipper' : 'editor';
                      onUnassign(short.id, role);
                      setShowAssignMenu(false);
                      setMenuPosition(null);
                    }}
                    style={{
                      padding: '7px 8px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: 'var(--col-changes)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--col-changes-dim)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    Unassign
                  </div>
                </>
              )}
            </div>,
            document.body
          )}
        </>
      )}

      {renderStatusDot()}

      {/* Title */}
      <h4 style={{
        margin: 0,
        marginBottom: '5px',
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--text-primary)',
        lineHeight: '1.45',
        letterSpacing: '-0.01em',
        paddingRight: isAdmin ? '90px' : '20px',
        paddingLeft: '18px',
        paddingBottom: '2px',
      }}>
        {short.title}
      </h4>

      {short.description && (
        <p style={{
          margin: '0 0 4px 0',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          lineHeight: '1.55',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {short.description}
        </p>
      )}

      {short.idea && (
        <p style={{
          margin: '3px 0 0 0',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          💡 {short.idea}
        </p>
      )}

      {/* ── Bottom row: assignment (left) + state+date (right) ── */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '12px',
        right: '10px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '4px',
        minWidth: 0,
      }}>
        {/* Assignment */}
        {defaultRole ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            color: 'var(--text-secondary)',
            fontWeight: '500',
            minWidth: 0,
            overflow: 'hidden',
          }}>
            {defaultRole.user.profile_picture && !defaultRole.user.profile_picture.startsWith('http') ? (
              <span style={{ fontSize: '15px', flexShrink: 0 }}>{defaultRole.user.profile_picture}</span>
            ) : (
              <img
                src={getProfilePicture(defaultRole.user)}
                alt={defaultRole.user.name}
                style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${isMyCard ? column.color : 'var(--border-default)'}`, flexShrink: 0 }}
              />
            )}
            <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
              {defaultRole.type === 'scripter' ? 'Writer' : defaultRole.type === 'clipper' ? 'Clipper' : 'Editor'}:
            </span>
            <span style={{ color: isMyCard ? column.color : 'var(--text-primary)', fontWeight: isMyCard ? '700' : '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {defaultRole.user.discord_username || defaultRole.user.name}
            </span>
            {isMyCard && (
              <span style={{ fontSize: '9px', fontWeight: '700', color: column.color, background: `color-mix(in srgb, ${column.color} 15%, transparent)`, padding: '1px 4px', borderRadius: '3px', flexShrink: 0, letterSpacing: '0.04em' }}>
                YOU
              </span>
            )}
            <TimezoneDisplay timezone={defaultRole.user.timezone} size="small" showTime={false} />
          </div>
        ) : (
          <div />
        )}

        {/* State + Date stacked right */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
          <span style={{
            fontSize: '9px',
            fontWeight: '700',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: cfg.color,
          }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', letterSpacing: '0.01em' }}>
            {new Date(short.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
