import React, { useState, useEffect, useRef } from 'react';
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
  const [assignMenuPosition, setAssignMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const assignButtonRef = useRef<HTMLButtonElement>(null);
  
  const shortAssignments = assignments.filter(a => a.short_id === short.id);
  const scripter = short.script_writer;
  const clipper = shortAssignments.find(a => a.role === 'clipper')?.user;
  const editor = shortAssignments.find(a => a.role === 'editor')?.user;
  
  // Determine which role to show by default based on column
  const getDefaultRole = () => {
    if (column.id === 'script' && scripter) return { type: 'scripter', user: scripter };
    if ((column.id === 'clips' || column.id === 'clip_changes') && clipper) return { type: 'clipper', user: clipper };
    if ((column.id === 'editing' || column.id === 'editing_changes') && editor) return { type: 'editor', user: editor };
    return null;
  };
  
  const defaultRole = getDefaultRole();
  
  
  const getProfilePicture = (user: User) => {
    if (user.profile_picture) {
      if (user.profile_picture.startsWith('http')) {
        return user.profile_picture;
      }
      return user.profile_picture; // emoji
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=6366f1&color=fff&size=32&bold=true`;
  };
  
  const canEdit = isAdmin || (
    (column.id === 'clips' || column.id === 'clip_changes') && clipper?.id === currentUserId
  ) || (
    (column.id === 'editing' || column.id === 'editing_changes') && editor?.id === currentUserId
  );
  
  // Cards are no longer grayed out - users can always view them
  const isDisabled = false;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `short-${short.id}`,
    disabled: !isAdmin, // Only admins can drag cards
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Upload status icon logic
  const renderUploadStatusIcon = () => {
    const hasScript = short.files?.some(f => f.file_type === 'script');
    const hasAudio = short.files?.some(f => f.file_type === 'audio');
    const hasClipsZip = short.files?.some(f => f.file_type === 'clips_zip');
    const hasFinalVideo = short.files?.some(f => f.file_type === 'final_video');
    
    // Check if assigned (in progress)
    const scriptInProgress = column.id === 'script' && scripter && (!hasScript || !hasAudio);
    const clipsInProgress = (column.id === 'clips' || column.id === 'clip_changes') && clipper && !hasClipsZip;
    const editingInProgress = (column.id === 'editing' || column.id === 'editing_changes') && editor && !hasFinalVideo;
    
    // Check if uploaded
    const scriptUploaded = column.id === 'script' && hasScript && hasAudio;
    
    let clipsUploaded = false;
    if (column.id === 'clips') {
      clipsUploaded = hasClipsZip ?? false;
    } else if (column.id === 'clip_changes') {
      if (hasClipsZip && short.entered_clip_changes_at) {
        const clipsFile = short.files?.find(f => f.file_type === 'clips_zip');
        if (clipsFile && clipsFile.uploaded_at) {
          const fileUploadTime = new Date(clipsFile.uploaded_at).getTime();
          const enteredTime = new Date(short.entered_clip_changes_at).getTime();
          clipsUploaded = fileUploadTime >= enteredTime;
        }
      }
    }
    
    let editingUploaded = false;
    if (column.id === 'editing') {
      editingUploaded = hasFinalVideo ?? false;
    } else if (column.id === 'editing_changes') {
      if (hasFinalVideo && short.entered_editing_changes_at) {
        const finalVideoFile = short.files?.find(f => f.file_type === 'final_video');
        if (finalVideoFile && finalVideoFile.uploaded_at) {
          const fileUploadTime = new Date(finalVideoFile.uploaded_at).getTime();
          const enteredTime = new Date(short.entered_editing_changes_at).getTime();
          editingUploaded = fileUploadTime >= enteredTime;
        }
      }
    }
    
    const StatusIcon = ({ color, title, isCheckmark, isUnassigned, isChanges }: { color: string; title: string; isCheckmark: boolean; isUnassigned?: boolean; isChanges?: boolean }) => (
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} title={title}>
        {isCheckmark ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ) : isUnassigned ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
          </svg>
        ) : isChanges ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        )}
      </div>
    );
    
    // Check for changes columns first (these should always show an icon)
    if (column.id === 'clip_changes') {
      return <StatusIcon color="#9333EA" title="Changes requested" isCheckmark={false} isChanges />;
    }
    if (column.id === 'editing_changes') {
      return <StatusIcon color="#9333EA" title="Changes requested" isCheckmark={false} isChanges />;
    }
    // Check for uploaded column (should always show an icon)
    if (column.id === 'uploaded') {
      return <StatusIcon color="#84CC16" title="Uploaded/Scheduled" isCheckmark />;
    }
    
    // Check for incomplete and unassigned
    const scriptUnassigned = column.id === 'script' && !scripter && (!hasScript || !hasAudio);
    const clipsUnassigned = column.id === 'clips' && !clipper && !hasClipsZip;
    const editingUnassigned = column.id === 'editing' && !editor && !hasFinalVideo;
    
    if (scriptUploaded) return <StatusIcon color="#10B981" title="Script & Audio uploaded" isCheckmark />;
    if (scriptInProgress) return <StatusIcon color="#F59E0B" title="In progress" isCheckmark={false} />;
    if (scriptUnassigned) return <StatusIcon color="#9CA3AF" title="Not assigned" isCheckmark={false} isUnassigned />;
    if (clipsUploaded) return <StatusIcon color="#10B981" title="Clips ZIP uploaded" isCheckmark />;
    if (clipsInProgress) return <StatusIcon color="#F59E0B" title="In progress" isCheckmark={false} />;
    if (clipsUnassigned) return <StatusIcon color="#9CA3AF" title="Not assigned" isCheckmark={false} isUnassigned />;
    if (editingUploaded) return <StatusIcon color="#10B981" title="Final video uploaded" isCheckmark />;
    if (editingInProgress) return <StatusIcon color="#F59E0B" title="In progress" isCheckmark={false} />;
    if (editingUnassigned) return <StatusIcon color="#9CA3AF" title="Not assigned" isCheckmark={false} isUnassigned />;
    
    return null;
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isDisabled ? '#F8FAFC' : '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '14px',
        cursor: isDisabled ? 'not-allowed' : (onClick ? 'pointer' : 'default'),
        transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        position: 'relative',
        opacity: isDisabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = column.color;
          e.currentTarget.style.boxShadow = `0 8px 16px ${column.color}30, 0 4px 8px rgba(0, 0, 0, 0.12)`;
          e.currentTarget.style.transform = 'translateY(-3px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = '#E2E8F0';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)';
          e.currentTarget.style.transform = 'translateY(0)';
          setShowAssignMenu(false);
          setAssignMenuPosition(null);
        }
      }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.drag-handle') && 
            !(e.target as HTMLElement).closest('.assign-menu')) {
          onClick?.();
        }
      }}
    >
      {/* Admin Settings Gear Icon */}
      {isAdmin && !isDragging && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/shorts/${short.id}`);
          }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: '8px',
            transition: 'all 0.2s ease-in-out',
            zIndex: 2,
            opacity: 0.6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)';
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.opacity = '0.6';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Edit settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      )}
      
      {/* Drag handle area - only visible and functional for admins */}
      {isAdmin && (
        <div
          {...attributes}
          {...listeners}
          className="drag-handle"
          style={{
            position: 'absolute',
            top: '8px',
            right: !isDragging ? '40px' : '8px',
            width: '28px',
            height: '28px',
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isDragging ? 1 : 0.3,
            borderRadius: '8px',
            transition: isDragging ? 'none' : 'all 0.2s ease-in-out',
            background: isDragging ? '#E2E8F0' : 'transparent',
          }}
          onMouseEnter={(e) => {
            if (!isDragging) {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.background = 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDragging) {
              e.currentTarget.style.opacity = '0.3';
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="4" r="1.5" fill={isDragging ? "#3B82F6" : "#64748B"}/>
            <circle cx="12" cy="4" r="1.5" fill={isDragging ? "#3B82F6" : "#64748B"}/>
            <circle cx="4" cy="8" r="1.5" fill={isDragging ? "#3B82F6" : "#64748B"}/>
            <circle cx="12" cy="8" r="1.5" fill={isDragging ? "#3B82F6" : "#64748B"}/>
            <circle cx="4" cy="12" r="1.5" fill={isDragging ? "#3B82F6" : "#64748B"}/>
            <circle cx="12" cy="12" r="1.5" fill={isDragging ? "#3B82F6" : "#64748B"}/>
          </svg>
        </div>
      )}
      
      {renderUploadStatusIcon()}
      
      {/* Assign/Reassign Icon (Admin only, top right, to the left of gear and move icons) */}
      {isAdmin && (column.id === 'script' || column.id === 'clips' || column.id === 'editing') && !isDragging && (
        <button
          ref={assignButtonRef}
          onClick={(e) => {
            e.stopPropagation();
            if (!showAssignMenu && assignButtonRef.current) {
              const rect = assignButtonRef.current.getBoundingClientRect();
              setAssignMenuPosition({
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
              });
            }
            setShowAssignMenu(!showAssignMenu);
          }}
          style={{
            position: 'absolute',
            top: '8px',
            right: !isDragging ? '76px' : '40px',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: '8px',
            transition: 'all 0.2s ease-in-out',
            zIndex: 2,
            opacity: 0.6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)';
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.opacity = '0.6';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={(() => {
            if (column.id === 'script') {
              return scripter ? 'Reassign Script Writer' : 'Assign Script Writer';
            } else if (column.id === 'clips') {
              return clipper ? 'Reassign Clipper' : 'Assign Clipper';
            } else {
              return editor ? 'Reassign Editor' : 'Assign Editor';
            }
          })()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
        </button>
      )}
      
      <h4 style={{
        margin: 0,
        marginBottom: '8px',
        fontSize: '15px',
        fontWeight: '600',
        color: '#0F172A',
        lineHeight: '1.5',
        letterSpacing: '-0.01em',
        paddingRight: '32px',
        paddingLeft: '32px',
      }}>
        {short.title}
      </h4>
      
      {short.description && column.id !== 'idea' && (
        <p style={{
          margin: 0,
          marginBottom: '8px',
          fontSize: '13px',
          color: '#64748B',
          lineHeight: '1.6',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {short.description}
        </p>
      )}
      
      {short.idea && column.id === 'idea' && (
        <p style={{
          margin: '6px 0 0 0',
          fontSize: '11px',
          color: '#94A3B8',
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
          margin: '6px 0 0 0',
          fontSize: '11px',
          color: '#94A3B8',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          📄 Script PDF uploaded
        </p>
      )}
      
      {/* Assignments Section - Show default role by column, all on card hover (hover expansion temporarily disabled) */}
      {defaultRole ? (
        <div 
          style={{
            marginTop: '10px',
            padding: '6px 8px',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#64748B',
            backgroundColor: 'transparent',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {defaultRole.user.profile_picture && !defaultRole.user.profile_picture.startsWith('http') ? (
              <span style={{ fontSize: '14px' }}>{defaultRole.user.profile_picture}</span>
            ) : (
              <img 
                src={getProfilePicture(defaultRole.user)} 
                alt={defaultRole.user.name}
                style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }}
              />
            )}
            <span>
              {defaultRole.type === 'scripter' ? 'Scripter' : defaultRole.type === 'clipper' ? 'Clipper' : 'Editor'}: 
              {' '}{defaultRole.user.discord_username || defaultRole.user.name}
            </span>
            <div style={{ position: 'relative', zIndex: 1001 }}>
              <TimezoneDisplay timezone={defaultRole.user.timezone} size="small" showTime={false} />
            </div>
          </div>
        </div>
      ) : null}
      
      {/* Assign Menu (Admin only) */}
      {isAdmin && (column.id === 'script' || column.id === 'clips' || column.id === 'editing') && showAssignMenu && assignMenuPosition && (
        <div
          className="assign-menu"
          style={{
            position: 'fixed',
            top: `${assignMenuPosition.top}px`,
            right: `${assignMenuPosition.right}px`,
            background: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)',
            zIndex: 10000,
            minWidth: '280px',
            maxWidth: '320px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ 
            fontSize: '13px', 
            fontWeight: '700', 
            marginBottom: '12px', 
            color: '#0F172A',
            letterSpacing: '-0.01em',
          }}>
            {(column.id === 'script' && scripter) || 
             (column.id === 'clips' && clipper) || 
             (column.id === 'editing' && editor)
              ? `Reassign ${column.id === 'script' ? 'Script Writer' : column.id === 'clips' ? 'Clipper' : 'Editor'}`
              : `Assign ${column.id === 'script' ? 'Script Writer' : column.id === 'clips' ? 'Clipper' : 'Editor'}`
            }
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            {users
              .filter(u => {
                if (column.id === 'script') {
                  return u.roles?.includes('script_writer') || u.role === 'script_writer';
                } else if (column.id === 'clips') {
                  return u.roles?.includes('clipper') || u.role === 'clipper';
                } else {
                  return u.roles?.includes('editor') || u.role === 'editor';
                }
              })
              .map(u => (
                <div
                  key={u.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    const role = column.id === 'script' ? 'script_writer' : column.id === 'clips' ? 'clipper' : 'editor';
                    onAssign(short.id, role, u.id);
                    setShowAssignMenu(false);
                    setAssignMenuPosition(null);
                  }}
                  style={{
                    padding: '8px 10px',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease-in-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#F1F5F9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {u.profile_picture && !u.profile_picture.startsWith('http') ? (
                    <span style={{ fontSize: '16px', lineHeight: '1' }}>{u.profile_picture}</span>
                  ) : (
                    <img
                      src={getProfilePicture(u)}
                      alt={u.name}
                      style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  )}
                  <span style={{ color: '#1E293B', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.discord_username || u.name}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
      
      {/* Created timestamp in bottom right */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        fontSize: '10px',
        color: '#94A3B8',
        whiteSpace: 'nowrap',
        fontWeight: '500',
        letterSpacing: '0.01em',
      }}>
        {new Date(short.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

