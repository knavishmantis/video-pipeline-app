import React, { useState, useEffect, useRef } from 'react';
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

  const getProfilePicture = (user: User) => {
    if (user.profile_picture) {
      if (user.profile_picture.startsWith('http')) return user.profile_picture;
      return user.profile_picture;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=2E2E3C&color=F5A623&size=32&bold=true`;
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
    opacity: isDragging ? 0.4 : 1,
  };

  // ── Status dot ──────────────────────────────────────────────────────────────
  const renderStatusDot = () => {
    const hasScript    = short.files?.some(f => f.file_type === 'script');
    const hasAudio     = short.files?.some(f => f.file_type === 'audio');
    const hasClipsZip  = short.files?.some(f => f.file_type === 'clips_zip');
    const hasFinalVideo= short.files?.some(f => f.file_type === 'final_video');

    const scriptUploaded  = column.id === 'script'  && hasScript && hasAudio;
    const scriptInProgress= column.id === 'script'  && scripter  && (!hasScript || !hasAudio);
    const scriptUnassigned= column.id === 'script'  && !scripter;

    let clipsUploaded = false;
    if (column.id === 'clips') { clipsUploaded = !!hasClipsZip; }
    else if (column.id === 'clip_changes' && hasClipsZip && short.entered_clip_changes_at) {
      const clipsFile = short.files?.find(f => f.file_type === 'clips_zip');
      if (clipsFile?.uploaded_at) {
        clipsUploaded = new Date(clipsFile.uploaded_at).getTime() >= new Date(short.entered_clip_changes_at).getTime();
      }
    }
    const clipsInProgress  = (column.id === 'clips' || column.id === 'clip_changes') && clipper && !clipsUploaded;
    const clipsUnassigned  = column.id === 'clips' && !clipper && !hasClipsZip;

    let editingUploaded = false;
    if (column.id === 'editing') { editingUploaded = !!hasFinalVideo; }
    else if (column.id === 'editing_changes' && hasFinalVideo && short.entered_editing_changes_at) {
      const finalFile = short.files?.find(f => f.file_type === 'final_video');
      if (finalFile?.uploaded_at) {
        editingUploaded = new Date(finalFile.uploaded_at).getTime() >= new Date(short.entered_editing_changes_at).getTime();
      }
    }
    const editingInProgress = (column.id === 'editing' || column.id === 'editing_changes') && editor && !editingUploaded;
    const editingUnassigned = column.id === 'editing' && !editor && !hasFinalVideo;

    // Determine color + title
    let dotColor = '#4A4A60';
    let title = '';

    if (column.id === 'clip_changes' || column.id === 'editing_changes') { dotColor = '#B39DFF'; title = 'Changes requested'; }
    else if (column.id === 'uploaded') { dotColor = '#A3E635'; title = 'Uploaded/Scheduled'; }
    else if (scriptUploaded || clipsUploaded || editingUploaded) { dotColor = '#22D3A0'; title = 'Uploaded'; }
    else if (scriptInProgress || clipsInProgress || editingInProgress) { dotColor = '#F5A623'; title = 'In progress'; }
    else if (scriptUnassigned || clipsUnassigned || editingUnassigned) { dotColor = '#4A4A60'; title = 'Not assigned'; }
    else return null;

    return (
      <div
        title={title}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          ...(dotColor === '#F5A623' ? {
            boxShadow: '0 0 6px rgba(245,166,35,0.6)',
          } : {}),
        }}
      />
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: '#1F1F28',
        border: '1px solid #32323E',
        borderLeft: `3px solid ${column.color}`,
        borderRadius: '5px',
        padding: '12px 12px 10px',
        cursor: onClick ? 'pointer' : 'default',
        transition: isDragging ? 'none' : 'all 0.15s ease-out',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.background = '#262632';
          e.currentTarget.style.borderColor = '#44445A';
          e.currentTarget.style.borderLeftColor = column.color;
          e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.4), inset 0 0 0 0 transparent`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.background = '#1F1F28';
          e.currentTarget.style.borderColor = '#32323E';
          e.currentTarget.style.borderLeftColor = column.color;
          e.currentTarget.style.boxShadow = 'none';
          setShowAssignMenu(false);
          setMenuPosition(null);
        }
      }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.drag-handle') &&
            !(e.target as HTMLElement).closest('.assign-menu') &&
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
            width: '24px',
            height: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: '4px',
            transition: 'all 0.15s ease-out',
            zIndex: 2,
            color: '#4A4A60',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#2E2E3C'; e.currentTarget.style.color = '#8888A8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4A4A60'; }}
          title="Edit settings"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      )}

      {/* Drag handle */}
      {isAdmin && (
        <div
          {...attributes}
          {...listeners}
          className="drag-handle"
          style={{
            position: 'absolute',
            top: '8px',
            right: !isDragging ? '36px' : '8px',
            width: '24px',
            height: '24px',
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isDragging ? 1 : 0.25,
            borderRadius: '4px',
            transition: isDragging ? 'none' : 'all 0.15s ease-out',
            color: isDragging ? '#F5A623' : '#8888A8',
          }}
          onMouseEnter={(e) => { if (!isDragging) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#2E2E3C'; } }}
          onMouseLeave={(e) => { if (!isDragging) { e.currentTarget.style.opacity = '0.25'; e.currentTarget.style.background = 'transparent'; } }}
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="4"  cy="3"  r="1.2" fill="currentColor"/>
            <circle cx="12" cy="3"  r="1.2" fill="currentColor"/>
            <circle cx="4"  cy="8"  r="1.2" fill="currentColor"/>
            <circle cx="12" cy="8"  r="1.2" fill="currentColor"/>
            <circle cx="4"  cy="13" r="1.2" fill="currentColor"/>
            <circle cx="12" cy="13" r="1.2" fill="currentColor"/>
          </svg>
        </div>
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
              right: !isDragging ? '64px' : '36px',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              transition: 'all 0.15s ease-out',
              zIndex: 3,
              color: '#4A4A60',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#2E2E3C'; e.currentTarget.style.color = '#8888A8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4A4A60'; }}
            title={column.id === 'script' ? (scripter ? 'Reassign Script Writer' : 'Assign Script Writer') : column.id === 'clips' ? (clipper ? 'Reassign Clipper' : 'Assign Clipper') : (editor ? 'Reassign Editor' : 'Assign Editor')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                background: '#1F1F28',
                border: '1px solid #3E3E54',
                borderRadius: '6px',
                padding: '10px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
                zIndex: 10000,
                minWidth: '240px',
                maxWidth: '300px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                fontSize: '10px',
                fontFamily: 'DM Mono, monospace',
                fontWeight: '500',
                letterSpacing: '0.08em',
                marginBottom: '8px',
                color: '#8888A8',
                textTransform: 'uppercase',
              }}>
                {(column.id === 'script' && scripter) || (column.id === 'clips' && clipper) || (column.id === 'editing' && editor)
                  ? `Reassign ${column.id === 'script' ? 'Script Writer' : column.id === 'clips' ? 'Clipper' : 'Editor'}`
                  : `Assign ${column.id === 'script' ? 'Script Writer' : column.id === 'clips' ? 'Clipper' : 'Editor'}`
                }
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                        padding: '7px 9px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontFamily: 'DM Mono, monospace',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.1s ease-out',
                        color: '#8888A8',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#2A2A38'; e.currentTarget.style.color = '#F0F0F8'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#AAAACC'; }}
                    >
                      {u.profile_picture && !u.profile_picture.startsWith('http') ? (
                        <span style={{ fontSize: '14px' }}>{u.profile_picture}</span>
                      ) : (
                        <img
                          src={getProfilePicture(u)}
                          alt={u.name}
                          style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.discord_username || u.name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>,
            document.body
          )}
        </>
      )}

      {renderStatusDot()}

      {/* Title */}
      <h4 style={{
        margin: 0,
        marginBottom: '6px',
        fontFamily: 'Syne, sans-serif',
        fontSize: '13px',
        fontWeight: '600',
        color: '#EEEEF5',
        lineHeight: '1.4',
        letterSpacing: '-0.01em',
        paddingRight: isAdmin ? '96px' : '24px',
        paddingLeft: '18px',
      }}>
        {short.title}
      </h4>

      {short.description && (
        <p style={{
          margin: '0 0 6px 0',
          fontFamily: 'DM Mono, monospace',
          fontSize: '11px',
          color: '#8888A8',
          lineHeight: '1.6',
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
          margin: '4px 0 0 0',
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          color: '#4A4A60',
          fontStyle: 'italic',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          💡 {short.idea}
        </p>
      )}

      {short.files?.some(f => f.file_type === 'script') && column.id === 'script' && (
        <p style={{
          margin: '4px 0 0 0',
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          color: '#22D3A0',
        }}>
          ✓ Script PDF uploaded
        </p>
      )}

      {/* Assignment */}
      {defaultRole && (
        <div style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          color: '#4A4A60',
        }}>
          {defaultRole.user.profile_picture && !defaultRole.user.profile_picture.startsWith('http') ? (
            <span style={{ fontSize: '12px' }}>{defaultRole.user.profile_picture}</span>
          ) : (
            <img
              src={getProfilePicture(defaultRole.user)}
              alt={defaultRole.user.name}
              style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover' }}
            />
          )}
          <span style={{ color: '#8888A8' }}>
            {defaultRole.type === 'scripter' ? 'SCRIPTER' : defaultRole.type === 'clipper' ? 'CLIPPER' : 'EDITOR'}:
          </span>
          <span style={{ color: '#EEEEF5' }}>
            {defaultRole.user.discord_username || defaultRole.user.name}
          </span>
          <div style={{ position: 'relative', zIndex: 1001 }}>
            <TimezoneDisplay timezone={defaultRole.user.timezone} size="small" showTime={false} />
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        right: '10px',
        fontFamily: 'DM Mono, monospace',
        fontSize: '9px',
        color: '#6E6E90',
        letterSpacing: '0.03em',
      }}>
        {new Date(short.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}
