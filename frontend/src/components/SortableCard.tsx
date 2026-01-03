import React, { useState, useEffect } from 'react';
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
  const [showAllAssignments, setShowAllAssignments] = useState(false);
  
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
  
  // Reset showAllAssignments when column or short changes
  useEffect(() => {
    setShowAllAssignments(false);
  }, [column.id, short.id]);
  
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
    
    const StatusIcon = ({ color, title, isCheckmark, isUnassigned }: { color: string; title: string; isCheckmark: boolean; isUnassigned?: boolean }) => (
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
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        )}
      </div>
    );
    
    // Check for incomplete and unassigned
    const scriptUnassigned = column.id === 'script' && !scripter && (!hasScript || !hasAudio);
    const clipsUnassigned = (column.id === 'clips' || column.id === 'clip_changes') && !clipper && !hasClipsZip;
    const editingUnassigned = (column.id === 'editing' || column.id === 'editing_changes') && !editor && !hasFinalVideo;
    
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
        borderRadius: '8px',
        padding: '12px',
        cursor: isDisabled ? 'not-allowed' : (onClick ? 'pointer' : 'default'),
        transition: isDragging ? 'none' : 'all 0.2s',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        position: 'relative',
        opacity: isDisabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = column.color;
          e.currentTarget.style.boxShadow = `0 4px 12px ${column.color}20`;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = '#E2E8F0';
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
          e.currentTarget.style.transform = 'translateY(0)';
          // Reset showAllAssignments when mouse leaves card
          setShowAllAssignments(false);
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
            width: '24px',
            height: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: '4px',
            transition: 'all 0.2s',
            zIndex: 2,
            opacity: 0.6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F1F5F9';
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.opacity = '0.6';
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
            right: !isDragging ? '36px' : '8px',
            width: '24px',
            height: '24px',
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isDragging ? 1 : 0.3,
            borderRadius: '4px',
            transition: isDragging ? 'none' : 'opacity 0.2s',
            background: isDragging ? '#E2E8F0' : 'transparent',
          }}
          onMouseEnter={(e) => {
            if (!isDragging) {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.background = '#F1F5F9';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDragging) {
              e.currentTarget.style.opacity = '0.3';
              e.currentTarget.style.background = 'transparent';
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
      
      <h4 style={{
        margin: 0,
        marginBottom: '6px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#1E293B',
        lineHeight: '1.4',
        paddingRight: isAdmin ? '60px' : '32px',
        paddingLeft: '32px',
      }}>
        {short.title}
      </h4>
      
      {short.description && column.id !== 'idea' && (
        <p style={{
          margin: 0,
          fontSize: '12px',
          color: '#64748B',
          lineHeight: '1.4',
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
      
      {/* Assignments Section - Show default role by column, all on hover */}
      <div 
        style={{
          marginTop: '8px',
          fontSize: '11px',
          color: '#94A3B8',
        }}
        onMouseEnter={() => setShowAllAssignments(true)}
        onMouseLeave={() => setShowAllAssignments(false)}
      >
        {showAllAssignments ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {scripter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {scripter.profile_picture && !scripter.profile_picture.startsWith('http') ? (
                  <span style={{ fontSize: '14px' }}>{scripter.profile_picture}</span>
                ) : (
                  <img 
                    src={getProfilePicture(scripter)} 
                    alt={scripter.name}
                    style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                )}
                <span>Scripter: {scripter.discord_username || scripter.name}</span>
                <TimezoneDisplay timezone={scripter.timezone} size="small" showTime={false} />
              </div>
            )}
            {clipper && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {clipper.profile_picture && !clipper.profile_picture.startsWith('http') ? (
                  <span style={{ fontSize: '14px' }}>{clipper.profile_picture}</span>
                ) : (
                  <img 
                    src={getProfilePicture(clipper)} 
                    alt={clipper.name}
                    style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                )}
                <span>Clipper: {clipper.discord_username || clipper.name}</span>
                <TimezoneDisplay timezone={clipper.timezone} size="small" showTime={false} />
              </div>
            )}
            {editor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {editor.profile_picture && !editor.profile_picture.startsWith('http') ? (
                  <span style={{ fontSize: '14px' }}>{editor.profile_picture}</span>
                ) : (
                  <img 
                    src={getProfilePicture(editor)} 
                    alt={editor.name}
                    style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                )}
                <span>Editor: {editor.discord_username || editor.name}</span>
                <TimezoneDisplay timezone={editor.timezone} size="small" showTime={false} />
              </div>
            )}
            {!scripter && !clipper && !editor && (
              <span style={{ fontStyle: 'italic' }}>No assignments</span>
            )}
          </div>
        ) : defaultRole ? (
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
            <TimezoneDisplay timezone={defaultRole.user.timezone} size="small" showTime={false} />
          </div>
        ) : null}
      </div>
      
      {/* Assign Button (Admin only) */}
      {isAdmin && (column.id === 'script' || column.id === 'clips' || column.id === 'editing') && (
        <div style={{ position: 'relative', marginTop: '8px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAssignMenu(!showAssignMenu);
            }}
            style={{
              padding: '4px 8px',
              background: '#F1F5F9',
              color: '#475569',
              border: '1px solid #E2E8F0',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '500',
            }}
          >
            {(() => {
              if (column.id === 'script') {
                return scripter ? 'Reassign' : 'Assign';
              } else if (column.id === 'clips') {
                return clipper ? 'Reassign' : 'Assign';
              } else {
                return editor ? 'Reassign' : 'Assign';
              }
            })()}
          </button>
          {showAssignMenu && (
            <div 
              className="assign-menu"
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                marginBottom: '4px',
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                padding: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 10,
                minWidth: '200px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '6px', color: '#1E293B' }}>
                Assign {column.id === 'script' ? 'Script Writer' : column.id === 'clips' ? 'Clipper' : 'Editor'}
              </div>
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
                    }}
                    style={{
                      padding: '6px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F1F5F9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {u.profile_picture && !u.profile_picture.startsWith('http') ? (
                      <span style={{ fontSize: '14px' }}>{u.profile_picture}</span>
                    ) : (
                      <img 
                        src={getProfilePicture(u)} 
                        alt={u.name}
                        style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    )}
                    <span style={{ flex: 1 }}>{u.discord_username || u.name}</span>
                    <TimezoneDisplay timezone={u.timezone} size="small" showTime={false} />
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

