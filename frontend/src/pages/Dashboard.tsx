import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../hooks/useAlert';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { shortsApi, filesApi, assignmentsApi, usersApi } from '../services/api';
import { Short, CreateShortInput, Assignment, User } from '../../../shared/types';
import { triggerConfetti } from '../utils/confetti';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ColumnType = 'idea' | 'script' | 'clips' | 'clip_changes' | 'editing' | 'editing_changes' | 'ready_to_upload' | 'uploaded';

interface Column {
  id: ColumnType;
  title: string;
  color: string;
  canAdd?: boolean;
  order: number; // For validation
}

const columns: Column[] = [
  { id: 'idea', title: 'Idea', color: '#8B5CF6', canAdd: true, order: 0 },
  { id: 'script', title: 'Script', color: '#3B82F6', canAdd: true, order: 1 },
  { id: 'clips', title: 'Clips', color: '#F59E0B', order: 2 },
  { id: 'clip_changes', title: 'Clip Changes', color: '#EF4444', order: 3 },
  { id: 'editing', title: 'Editing', color: '#10B981', order: 4 },
  { id: 'editing_changes', title: 'Editing Changes', color: '#06B6D4', order: 5 },
  { id: 'ready_to_upload', title: 'Ready to Upload', color: '#6366F1', order: 6 },
  { id: 'uploaded', title: 'Uploaded/Scheduled', color: '#84CC16', order: 7 },
];

// Map database status to column
const statusToColumn = (status: string): ColumnType => {
  const map: Record<string, ColumnType> = {
    'idea': 'idea',
    'script': 'script',
    'clipping': 'clips',
    'clips': 'clips',
    'clip_changes': 'clip_changes',
    'editing': 'editing',
    'editing_changes': 'editing_changes',
    'completed': 'editing_changes',
    'ready_to_upload': 'ready_to_upload',
    'uploaded': 'uploaded',
  };
  return map[status] || 'idea';
};

// Map column to database status
const columnToStatus = (column: ColumnType): string => {
  const map: Record<ColumnType, string> = {
    'idea': 'idea',
    'script': 'script',
    'clips': 'clips',
    'clip_changes': 'clip_changes',
    'editing': 'editing',
    'editing_changes': 'editing_changes',
    'ready_to_upload': 'ready_to_upload',
    'uploaded': 'uploaded',
  };
  return map[column];
};

// Get valid columns for a given column (can move forward or backward one step, or admin can move to clip_changes/editing_changes)
// Also allows clips->editing and editing->ready_to_upload if marked complete
const getValidColumns = (currentColumn: ColumnType, isAdmin: boolean = false, short?: Short): ColumnType[] => {
  const current = columns.find(c => c.id === currentColumn);
  if (!current) return [];
  
  const valid: ColumnType[] = [];
  // Can move to previous column
  const prev = columns.find(c => c.order === current.order - 1);
  if (prev) valid.push(prev.id);
  // Can move to next column
  const next = columns.find(c => c.order === current.order + 1);
  if (next) valid.push(next.id);
  
  // Admin can also move to clip_changes or editing_changes from clips/editing
  if (isAdmin) {
    if (currentColumn === 'clips') {
      valid.push('clip_changes');
    } else if (currentColumn === 'editing') {
      valid.push('editing_changes');
    }
  }
  
  // Allow clips->editing if clips are marked complete
  if (currentColumn === 'clips' || currentColumn === 'clip_changes') {
    if (short?.clips_completed_at) {
      const editingColumn = columns.find(c => c.id === 'editing');
      if (editingColumn) valid.push('editing');
    }
  }
  
  // Allow editing->ready_to_upload if editing is marked complete
  if (currentColumn === 'editing' || currentColumn === 'editing_changes') {
    if (short?.editing_completed_at) {
      const readyColumn = columns.find(c => c.id === 'ready_to_upload');
      if (readyColumn) valid.push('ready_to_upload');
    }
  }
  
  return valid;
};

// Droppable Column Component
function DroppableColumn({ 
  column, 
  children, 
  shorts 
}: { 
  column: Column; 
  children: React.ReactNode;
  shorts: Short[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: '280px',
        background: isOver ? '#F8FAFC' : '#FFFFFF',
        borderRadius: '12px',
        padding: '16px',
        paddingBottom: '24px', // Extra bottom padding to account for scrollbar
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: isOver ? `2px dashed ${column.color}` : '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 180px)', // Column height
        transition: 'all 0.2s',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
}

// Sortable Card Component
function SortableCard({ 
  short, 
  column, 
  onClick,
  assignments,
  users,
  isAdmin,
  currentUserId,
  onAssign,
  navigate,
}: { 
  short: Short; 
  column: Column; 
  onClick?: () => void;
  assignments: Assignment[];
  users: User[];
  isAdmin: boolean;
  currentUserId?: number;
  onAssign: (shortId: number, role: 'clipper' | 'editor', userId: number) => void;
  navigate: (path: string) => void;
}) {
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
  
  const isDisabled = !canEdit && (column.id === 'clips' || column.id === 'editing' || column.id === 'clip_changes' || column.id === 'editing_changes');
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
        }
      }}
      onClick={(e) => {
        // Don't trigger click if clicking on drag handle or assign menu
        if (!(e.target as HTMLElement).closest('.drag-handle') && 
            !(e.target as HTMLElement).closest('.assign-menu')) {
          onClick?.();
        }
      }}
    >
      {/* Admin Settings Gear Icon and Delete Button */}
      {isAdmin && !isDragging && (
        <>
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
        </>
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
            e.stopPropagation(); // Prevent card click when clicking drag handle
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
      <h4 style={{
        margin: 0,
        marginBottom: '6px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#1E293B',
        lineHeight: '1.4',
        paddingRight: isAdmin ? '60px' : '32px', // Space for gear icon and drag handle
      paddingLeft: '32px', // Space for upload status icon
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
      {/* Upload Status Icons - Show checkmark when uploaded, clock when in progress */}
      {(() => {
        const hasScript = short.files?.some(f => f.file_type === 'script');
        const hasAudio = short.files?.some(f => f.file_type === 'audio');
        const hasClipsZip = short.files?.some(f => f.file_type === 'clips_zip');
        const hasFinalVideo = short.files?.some(f => f.file_type === 'final_video');
        
        // Check if assigned (in progress)
        const scriptInProgress = column.id === 'script' && scripter && (!hasScript || !hasAudio);
        const clipsInProgress = (column.id === 'clips' || column.id === 'clip_changes') && clipper && !hasClipsZip;
        const editingInProgress = (column.id === 'editing' || column.id === 'editing_changes') && editor && !hasFinalVideo;
        
        // Check if uploaded
        // For clip_changes and editing_changes, only show checkmark if file was uploaded AFTER entering that status
        const scriptUploaded = column.id === 'script' && hasScript && hasAudio;
        
        let clipsUploaded = false;
        if (column.id === 'clips') {
          clipsUploaded = hasClipsZip ?? false;
        } else if (column.id === 'clip_changes') {
          // Only show checkmark if clips_zip was uploaded after entering clip_changes
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
          // Only show checkmark if final_video was uploaded after entering editing_changes
          if (hasFinalVideo && short.entered_editing_changes_at) {
            const finalVideoFile = short.files?.find(f => f.file_type === 'final_video');
            if (finalVideoFile && finalVideoFile.uploaded_at) {
              const fileUploadTime = new Date(finalVideoFile.uploaded_at).getTime();
              const enteredTime = new Date(short.entered_editing_changes_at).getTime();
              editingUploaded = fileUploadTime >= enteredTime;
            }
          }
        }
        
        if (scriptUploaded) {
          return (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} title="Script & Audio uploaded">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          );
        } else if (scriptInProgress) {
          return (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} title="In progress">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          );
        }
        
        if (clipsUploaded) {
          return (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} title="Clips ZIP uploaded">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          );
        } else if (clipsInProgress) {
          return (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} title="In progress">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          );
        }
        
        if (editingUploaded) {
          return (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} title="Final video uploaded">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          );
        } else if (editingInProgress) {
          return (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} title="In progress">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          );
        }
        
        return null;
      })()}
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
      {/* Assignments Section */}
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
          // Show all assignments on hover
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
              </div>
            )}
            {!scripter && !clipper && !editor && (
              <span style={{ fontStyle: 'italic' }}>No assignments</span>
            )}
          </div>
        ) : defaultRole ? (
          // Show only relevant role by default
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
          </div>
        ) : null}
      </div>
      
      {/* Assign Button (Admin only or when not assigned) */}
      {isAdmin && (column.id === 'clips' || column.id === 'editing') && (
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
            {clipper && column.id === 'clips' ? 'Reassign' : editor && column.id === 'editing' ? 'Reassign' : 'Assign'}
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
                Assign {column.id === 'clips' ? 'Clipper' : 'Editor'}
              </div>
              {users
                .filter(u => {
                  const hasRole = column.id === 'clips' 
                    ? u.roles?.includes('clipper') || u.role === 'clipper'
                    : u.roles?.includes('editor') || u.role === 'editor';
                  return hasRole;
                })
                .map(u => (
                  <div
                    key={u.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssign(short.id, column.id === 'clips' ? 'clipper' : 'editor', u.id);
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
                    <span>{u.discord_username || u.name}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();
  const { confirm, ConfirmComponent } = useConfirm();
  const [shorts, setShorts] = useState<Short[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  // Non-admin users should always see all shorts (read-only), only admins can filter to "assigned only"
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  // Initialize visible columns - exclude 'uploaded' and 'ready_to_upload' by default
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnType>>(
    new Set(columns.filter(c => c.id !== 'uploaded' && c.id !== 'ready_to_upload').map(c => c.id))
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createColumn, setCreateColumn] = useState<ColumnType | null>(null);
  const [createForm, setCreateForm] = useState<CreateShortInput>({
    title: '',
    description: '',
    idea: '',
  });
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showContentModal, setShowContentModal] = useState(false);
  const [contentShort, setContentShort] = useState<Short | null>(null);
  const [contentColumn, setContentColumn] = useState<ColumnType | null>(null);
  const [contentForm, setContentForm] = useState({
    script_content: '',
    file: null as globalThis.File | null,
    scriptFile: null as globalThis.File | null,
    audioFile: null as globalThis.File | null,
  });
  const [uploading, setUploading] = useState(false);

  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadData();
  }, [showAssignedOnly]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Non-admin users always see all shorts (read-only), only admins can filter
      const shouldShowAssignedOnly = isAdmin && showAssignedOnly;
      const [shortsData, assignmentsData, usersData] = await Promise.all([
        shouldShowAssignedOnly ? shortsApi.getAssigned() : shortsApi.getAll(),
        assignmentsApi.getAll(),
        usersApi.getAll(),
      ]);
      setShorts(shortsData);
      setAssignments(assignmentsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAssign = async (shortId: number, role: 'clipper' | 'editor', userId: number) => {
    try {
      // Check if assignment already exists and delete it first
      const existingAssignment = assignments.find(
        a => a.short_id === shortId && a.role === role
      );
      
      if (existingAssignment) {
        await assignmentsApi.delete(existingAssignment.id);
      }
      
      await assignmentsApi.create({
        short_id: shortId,
        user_id: userId,
        role,
        default_time_range: role === 'clipper' ? 4 : 2,
      });
      await loadData();
      showToast('Assignment created successfully', 'success');
    } catch (error: any) {
      console.error('Failed to assign:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to assign user';
      showAlert(errorMsg, { type: 'error' });
    }
  };

  const getShortsForColumn = (columnId: ColumnType): Short[] => {
    return shorts.filter(short => statusToColumn(short.status) === columnId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const shortId = parseInt((active.id as string).replace('short-', ''));
    const targetColumnId = (over.id as string).replace('column-', '') as ColumnType;
    
    if (!targetColumnId || !columns.find(c => c.id === targetColumnId)) return;

    const short = shorts.find(s => s.id === shortId);
    if (!short) return;

    const currentColumn = statusToColumn(short.status);
    const validColumns = getValidColumns(currentColumn, isAdmin, short);

    // Only allow moving to valid columns (adjacent or clip_changes/editing_changes for admin)
    if (!validColumns.includes(targetColumnId)) {
      return;
    }

    try {
      const newStatus = columnToStatus(targetColumnId);
      
      // If moving to clip_changes or editing_changes, we need to create payments
      // This will be handled by the backend
      await shortsApi.update(shortId, { status: newStatus as any });
      await loadData();
      showToast('Short status updated successfully', 'success');
    } catch (error: any) {
      console.error('Failed to update short status:', error);
      const errorMessage = error.response?.data?.error || 'Failed to update short status';
      showAlert(errorMessage, { type: 'warning' });
    }
  };

  const handleCreateClick = (columnId: ColumnType) => {
    setCreateColumn(columnId);
    setCreateForm({ title: '', description: '', idea: '' });
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createColumn || !createForm.title.trim()) return;

    setCreating(true);
    try {
      const newShort = await shortsApi.create({
        ...createForm,
        title: createForm.title.trim(),
      });
      
      if (createColumn === 'script') {
        await shortsApi.update(newShort.id, { status: 'script' });
      }
      
      setShowCreateModal(false);
      setCreateColumn(null);
      setCreateForm({ title: '', description: '', idea: '' });
      await loadData();
      showToast('Short created successfully', 'success');
    } catch (error) {
      console.error('Failed to create short:', error);
      showAlert('Failed to create short. Please try again.', { type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleCardClick = async (short: Short, column: Column) => {
    if (!short) return;
    
    // Check permissions
    const canEdit = isAdmin || (
      (column.id === 'clips' || column.id === 'clip_changes') && 
      assignments.some(a => a.short_id === short.id && a.role === 'clipper' && a.user_id === user?.id)
    ) || (
      (column.id === 'editing' || column.id === 'editing_changes') && 
      assignments.some(a => a.short_id === short.id && a.role === 'editor' && a.user_id === user?.id)
    );
    
    if (!canEdit && (column.id === 'clips' || column.id === 'editing' || column.id === 'clip_changes' || column.id === 'editing_changes')) {
      return; // Don't allow editing if not assigned
    }
    
    // Open content modal based on column
    if (column.id === 'script' && !short.script_content) {
      // Load full short data with files
      try {
        const fullShort = await shortsApi.getById(short.id);
        setContentShort(fullShort);
        setContentColumn(column.id);
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      } catch (error) {
        console.error('Failed to load short:', error);
        // Fallback to using existing short data
        setContentShort(short);
        setContentColumn(column.id);
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      }
    } else if (column.id === 'clips' || column.id === 'clip_changes') {
      // Load full short data with files
      try {
        const fullShort = await shortsApi.getById(short.id);
        setContentShort(fullShort);
        setContentColumn('clips'); // Use 'clips' for both clips and clip_changes
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      } catch (error) {
        console.error('Failed to load short:', error);
        // Fallback to using existing short data
        setContentShort(short);
        setContentColumn('clips');
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      }
    } else if (column.id === 'editing' || column.id === 'editing_changes') {
      // Load full short data with files
      try {
        const fullShort = await shortsApi.getById(short.id);
        setContentShort(fullShort);
        setContentColumn('editing'); // Use 'editing' for both editing and editing_changes
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      } catch (error) {
        console.error('Failed to load short:', error);
        // Fallback to using existing short data
        setContentShort(short);
        setContentColumn('editing');
        setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
        setShowContentModal(true);
      }
    } else {
      // Navigate to detail page
      navigate(`/shorts/${short.id}`);
    }
  };

  const handleContentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentShort || !contentColumn) return;

    setUploading(true);
    try {
      if (contentColumn === 'script') {
        if (!contentForm.scriptFile || !contentForm.audioFile) {
          showAlert('Both Script PDF and Audio MP3 are required', { type: 'warning' });
          setUploading(false);
          return;
        }
        await filesApi.upload(contentShort.id, 'script', contentForm.scriptFile);
        await filesApi.upload(contentShort.id, 'audio', contentForm.audioFile);
      } else if ((contentColumn === 'clips' || contentColumn === 'clip_changes') && contentForm.file) {
        await filesApi.upload(contentShort.id, 'clips_zip', contentForm.file);
      } else if ((contentColumn === 'editing' || contentColumn === 'editing_changes') && contentForm.file) {
        await filesApi.upload(contentShort.id, 'final_video', contentForm.file);
      }

      setShowContentModal(false);
      setContentShort(null);
      setContentColumn(null);
      
      // Determine which file types were uploaded for confetti
      let uploadedFileType: string | null = null;
      if (contentColumn === 'script') {
        uploadedFileType = 'script'; // Both script and audio uploaded, trigger once
      } else if (contentColumn === 'clips' || contentColumn === 'clip_changes') {
        uploadedFileType = 'clips_zip';
      } else if (contentColumn === 'editing' || contentColumn === 'editing_changes') {
        uploadedFileType = 'final_video';
      }
      
      setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
      await loadData();
      showToast('Content saved successfully', 'success');
      
      // Trigger confetti for specific file types
      if (uploadedFileType === 'script' || uploadedFileType === 'clips_zip' || uploadedFileType === 'final_video') {
        triggerConfetti();
      }
    } catch (error) {
      console.error('Failed to save content:', error);
      showAlert('Failed to save content. Please try again.', { type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFile = async (file: any) => {
    if (!file.download_url) {
      showAlert('Download URL not available', { type: 'error' });
      return;
    }
    try {
      // Fetch the file as a blob to download it properly
      const response = await fetch(file.download_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
      showAlert('Failed to download file', { type: 'error' });
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    const confirmed = await confirm({
      title: 'Delete File',
      message: 'Are you sure you want to delete this file? This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    
    try {
      await filesApi.delete(fileId);
      // Reload the short to get updated file list
      if (contentShort) {
        const updatedShort = await shortsApi.getById(contentShort.id);
        setContentShort(updatedShort);
      }
      await loadData();
      showToast('File deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete file:', error);
      showAlert('Failed to delete file', { type: 'error' });
    }
  };

  const activeShort = activeId ? shorts.find(s => `short-${s.id}` === activeId) : null;

  const toggleColumnView = (viewType: 'clipper' | 'script' | 'idea' | 'editing' | 'ready_to_upload' | 'uploaded') => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      let columnsToToggle: ColumnType[] = [];
      
      if (viewType === 'clipper') {
        columnsToToggle = ['clips', 'clip_changes'];
      } else if (viewType === 'script') {
        columnsToToggle = ['script'];
      } else if (viewType === 'idea') {
        columnsToToggle = ['idea'];
      } else if (viewType === 'editing') {
        columnsToToggle = ['editing', 'editing_changes'];
      } else if (viewType === 'ready_to_upload') {
        columnsToToggle = ['ready_to_upload'];
      } else if (viewType === 'uploaded') {
        columnsToToggle = ['uploaded'];
      }
      
      const allVisible = columnsToToggle.every(col => newSet.has(col));
      if (allVisible) {
        columnsToToggle.forEach(col => newSet.delete(col));
      } else {
        columnsToToggle.forEach(col => newSet.add(col));
      }
      
      return newSet;
    });
  };

  // Filter columns: hide 'idea' for non-admins, only show visible columns
  const filteredColumns = columns.filter(col => {
    if (col.id === 'idea' && !isAdmin) return false;
    return visibleColumns.has(col.id);
  });

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        /* Always show horizontal scrollbar to reserve space and prevent overlap */
        div[data-kanban-grid]::-webkit-scrollbar {
          height: 24px;
        }
        div[data-kanban-grid]::-webkit-scrollbar-track {
          background: #F1F5F9;
          border-radius: 8px;
        }
        div[data-kanban-grid]::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 8px;
        }
        div[data-kanban-grid]::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
        div[data-kanban-grid] {
          scrollbar-width: auto; /* Firefox - make it thicker */
          scrollbar-color: #CBD5E1 #F1F5F9; /* Firefox */
        }
      `}</style>
    <div>
        {/* Filter Controls */}
        <div style={{ 
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          {/* Toggle Switch for Assigned/Show All - Only show for admins */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: '#475569', fontWeight: '500' }}>
                Show All
              </span>
              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '48px',
                height: '24px',
              }}>
                <input
                  type="checkbox"
                  checked={showAssignedOnly}
                  onChange={(e) => setShowAssignedOnly(e.target.checked)}
                  style={{
                    opacity: 0,
                    width: 0,
                    height: 0,
                  }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: showAssignedOnly ? '#3B82F6' : '#E2E8F0',
                  transition: '0.3s',
                  borderRadius: '24px',
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    transition: '0.3s',
                    borderRadius: '50%',
                    transform: showAssignedOnly ? 'translateX(24px)' : 'translateX(0)',
                  }} />
                </span>
              </label>
              <span style={{ fontSize: '14px', color: '#475569', fontWeight: '500' }}>
                Assigned to Me
              </span>
            </div>
          )}

          {/* View Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
            {isAdmin && (
              <button
                onClick={() => toggleColumnView('idea')}
                style={{
                  padding: '6px 12px',
                  background: visibleColumns.has('idea') ? '#8B5CF6' : '#E2E8F0',
                  color: visibleColumns.has('idea') ? '#FFFFFF' : '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                }}
              >
                Idea View
              </button>
            )}
            <button
              onClick={() => toggleColumnView('script')}
              style={{
                padding: '6px 12px',
                background: visibleColumns.has('script') ? '#3B82F6' : '#E2E8F0',
                color: visibleColumns.has('script') ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
            >
              Script View
            </button>
            <button
              onClick={() => toggleColumnView('clipper')}
              style={{
                padding: '6px 12px',
                background: (visibleColumns.has('clips') || visibleColumns.has('clip_changes')) ? '#F59E0B' : '#E2E8F0',
                color: (visibleColumns.has('clips') || visibleColumns.has('clip_changes')) ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
            >
              Clipper View
            </button>
            <button
              onClick={() => toggleColumnView('editing')}
              style={{
                padding: '6px 12px',
                background: (visibleColumns.has('editing') || visibleColumns.has('editing_changes')) ? '#10B981' : '#E2E8F0',
                color: (visibleColumns.has('editing') || visibleColumns.has('editing_changes')) ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
            >
              Editing View
            </button>
            <button
              onClick={() => toggleColumnView('ready_to_upload')}
              style={{
                padding: '6px 12px',
                background: visibleColumns.has('ready_to_upload') ? '#6366F1' : '#E2E8F0',
                color: visibleColumns.has('ready_to_upload') ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
            >
              Ready to Upload
            </button>
            <button
              onClick={() => toggleColumnView('uploaded')}
              style={{
                padding: '6px 12px',
                background: visibleColumns.has('uploaded') ? '#84CC16' : '#E2E8F0',
                color: visibleColumns.has('uploaded') ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
            >
              Uploaded/Scheduled
            </button>
          </div>
        </div>

      {/* Kanban Board */}
      {loading ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          color: '#64748B',
          fontSize: '16px'
        }}>
          Loading...
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div 
            data-kanban-grid
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${filteredColumns.length}, 1fr)`,
              gap: '16px',
              overflowX: filteredColumns.length > 0 ? 'scroll' : 'visible', // Always show scrollbar
              overflowY: 'hidden',
              paddingBottom: '0px', // No padding - scrollbar needs its own space
              marginBottom: '24px', // Space reserved for scrollbar (matches height)
              height: 'calc(100vh - 160px)', // Dashboard height
              scrollbarGutter: 'stable', // Reserve space for scrollbar
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
                            assignments.some(a => a.short_id === short.id && a.role === 'clipper' && a.user_id === user?.id)
                          ) || (
                            (column.id === 'editing' || column.id === 'editing_changes') && 
                            assignments.some(a => a.short_id === short.id && a.role === 'editor' && a.user_id === user?.id)
                          );
                          
                          return (
                            <SortableCard
                              key={short.id}
                              short={short}
                              column={column}
                              onClick={canEdit ? () => handleCardClick(short, column) : undefined}
                              assignments={assignments}
                              users={users}
                              isAdmin={isAdmin}
                              currentUserId={user?.id}
                              onAssign={handleAssign}
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
                      onClick={() => handleCreateClick(column.id)}
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
      )}

      {/* Create Modal */}
      {showCreateModal && createColumn && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: '600',
              color: '#1E293B',
            }}>
              Add to {columns.find(c => c.id === createColumn)?.title}
            </h2>
            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter short title"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  Description
                </label>
                <textarea
                  value={createForm.description || ''}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Enter description (optional)"
                />
              </div>
              {createColumn === 'idea' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    Idea
                  </label>
                  <textarea
                    value={createForm.idea || ''}
                    onChange={(e) => setCreateForm({ ...createForm, idea: e.target.value })}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                    placeholder="Enter idea details (optional)"
                  />
                </div>
              )}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '24px',
              }}>
                <button
                  type="button"
                  onClick={() => !creating && setShowCreateModal(false)}
                  disabled={creating}
                  style={{
                    padding: '10px 20px',
                    background: '#F3F4F6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createForm.title.trim()}
                  style={{
                    padding: '10px 20px',
                    background: creating ? '#9CA3AF' : columns.find(c => c.id === createColumn)?.color || '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: creating || !createForm.title.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content Modal */}
      {showContentModal && contentShort && contentColumn && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => {
            if (!uploading) {
              setShowContentModal(false);
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: '600',
              color: '#1E293B',
            }}>
              {contentColumn === 'script' && (() => {
                const hasScript = contentShort.files?.some(f => f.file_type === 'script');
                const hasAudio = contentShort.files?.some(f => f.file_type === 'audio');
                return (hasScript || hasAudio) ? 'Replace Script & Audio' : 'Upload Script & Audio';
              })()}
              {(contentColumn === 'clips' || contentColumn === 'clip_changes') && (
                contentShort.files?.some(f => f.file_type === 'clips_zip') ? 'Replace Zip of Clips' : 'Upload Zip of Clips'
              )}
              {(contentColumn === 'editing' || contentColumn === 'editing_changes') && (
                contentShort.files?.some(f => f.file_type === 'final_video') ? 'Replace Final Video' : 'Upload Final Video'
              )}
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '14px' }}>
              {contentShort.title}
            </p>
            <form onSubmit={handleContentSubmit}>
              {contentColumn === 'script' ? (
                <>
                  {/* Show existing files */}
                  {contentShort.files && (
                    <div style={{ 
                      marginBottom: '16px', 
                      padding: '12px', 
                      background: '#F0F9FF', 
                      borderRadius: '8px',
                      border: '1px solid #BAE6FD'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#0369A1', marginBottom: '8px' }}>
                        File Status:
                      </div>
                      <div style={{ fontSize: '12px', color: contentShort.files.some(f => f.file_type === 'script') ? '#0C4A6E' : '#64748B', marginBottom: '4px' }}>
                        {contentShort.files.some(f => f.file_type === 'script') ? '✓ Script PDF uploaded' : '✗ Script PDF not uploaded'}
                      </div>
                      <div style={{ fontSize: '12px', color: contentShort.files.some(f => f.file_type === 'audio') ? '#0C4A6E' : '#64748B' }}>
                        {contentShort.files.some(f => f.file_type === 'audio') ? '✓ Audio MP3 uploaded' : '✗ Audio MP3 not uploaded'}
                      </div>
                    </div>
                  )}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                    }}>
                      Script PDF File *
                    </label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setContentForm({ ...contentForm, scriptFile: e.target.files?.[0] || null })}
                      required
                      disabled={uploading}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        opacity: uploading ? 0.6 : 1,
                        cursor: uploading ? 'not-allowed' : 'pointer',
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                    }}>
                      Audio MP3 File *
                    </label>
                    <input
                      type="file"
                      accept="audio/mpeg,.mp3,audio/*"
                      onChange={(e) => setContentForm({ ...contentForm, audioFile: e.target.files?.[0] || null })}
                      required
                      disabled={uploading}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        opacity: uploading ? 0.6 : 1,
                        cursor: uploading ? 'not-allowed' : 'pointer',
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Show existing files for clips/editing */}
                  {contentShort.files && (
                    <div style={{ 
                      marginBottom: '16px', 
                      padding: '12px', 
                      background: '#F0F9FF', 
                      borderRadius: '8px',
                      border: '1px solid #BAE6FD'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#0369A1', marginBottom: '8px' }}>
                        File Status:
                      </div>
                      {(contentColumn === 'clips' || contentColumn === 'clip_changes') && (
                        <div style={{ fontSize: '12px', color: contentShort.files.some(f => f.file_type === 'clips_zip') ? '#0C4A6E' : '#64748B' }}>
                          {contentShort.files.some(f => f.file_type === 'clips_zip') 
                            ? `✓ Clips ZIP uploaded: ${contentShort.files.find(f => f.file_type === 'clips_zip')?.file_name}`
                            : '✗ Clips ZIP not uploaded'}
                        </div>
                      )}
                      {(contentColumn === 'editing' || contentColumn === 'editing_changes') && (
                        <div style={{ fontSize: '12px', color: contentShort.files.some(f => f.file_type === 'final_video') ? '#0C4A6E' : '#64748B' }}>
                          {contentShort.files.some(f => f.file_type === 'final_video')
                            ? `✓ Final video uploaded: ${contentShort.files.find(f => f.file_type === 'final_video')?.file_name}`
                            : '✗ Final video not uploaded'}
                        </div>
                      )}
                    </div>
                  )}
                  {/* File Management for Clips/Editing */}
                  {(() => {
                    const currentFile = (contentColumn === 'clips' || contentColumn === 'clip_changes')
                      ? contentShort.files?.find(f => f.file_type === 'clips_zip')
                      : contentShort.files?.find(f => f.file_type === 'final_video');
                    
                    // Get dependency files
                    const scriptPdf = contentShort.files?.find(f => f.file_type === 'script');
                    const audioFile = contentShort.files?.find(f => f.file_type === 'audio');
                    const clipsZip = contentShort.files?.find(f => f.file_type === 'clips_zip');
                    
                    // Check permissions - only assigned clipper/editor or admin
                    const shortAssignments = assignments.filter(a => a.short_id === contentShort.id);
                    const clipperAssignment = shortAssignments.find(a => a.role === 'clipper');
                    const editorAssignment = shortAssignments.find(a => a.role === 'editor');
                    const canEdit = isAdmin || 
                      ((contentColumn === 'clips' || contentColumn === 'clip_changes') && clipperAssignment?.user_id === user?.id) ||
                      ((contentColumn === 'editing' || contentColumn === 'editing_changes') && editorAssignment?.user_id === user?.id);
                    
                    if (!canEdit) {
                      return (
                        <div style={{ 
                          padding: '12px', 
                          background: '#FEF3C7', 
                          borderRadius: '8px',
                          border: '1px solid #FCD34D',
                          color: '#92400E',
                          fontSize: '14px'
                        }}>
                          You don't have permission to edit this file. Only the assigned {contentColumn === 'clips' || contentColumn === 'clip_changes' ? 'clipper' : 'editor'} or admin can manage files.
                        </div>
                      );
                    }
                    
                    return (
                      <div style={{ marginBottom: '16px' }}>
                        {/* Current File Section (if exists) */}
                        {currentFile && (
                          <div style={{
                            marginBottom: '16px',
                            padding: '12px',
                            background: '#F0F9FF',
                            borderRadius: '8px',
                            border: '1px solid #BAE6FD'
                          }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0369A1', marginBottom: '8px' }}>
                              {(contentColumn === 'clips' || contentColumn === 'clip_changes') ? 'Your Clips ZIP' : 'Your Final Video'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#0C4A6E', marginBottom: '12px' }}>
                              {currentFile.file_name}
                              {currentFile.file_size && (
                                <span style={{ color: '#64748B', marginLeft: '8px' }}>
                                  ({(currentFile.file_size / (1024 * 1024)).toFixed(2)} MB)
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {currentFile.download_url && (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadFile(currentFile)}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#3B82F6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                  Download
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteFile(currentFile.id)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#DC2626',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Download Dependencies Section for Clippers */}
                        {((contentColumn === 'clips' || contentColumn === 'clip_changes') && (scriptPdf?.download_url || audioFile?.download_url)) && (
                          <div style={{
                            marginBottom: '16px',
                            padding: '12px',
                            background: '#F0FDF4',
                            borderRadius: '8px',
                            border: '1px solid #86EFAC'
                          }}>
                            <div style={{ fontSize: '12px', color: '#15803D', marginBottom: '12px', lineHeight: '1.5' }}>
                              <div style={{ marginBottom: '6px' }}>
                                📖 Refer to the <a href="/guide" target="_blank" style={{ color: '#166534', textDecoration: 'underline', fontWeight: '500' }}>Guide</a> and <a href="/flashback-reference" target="_blank" style={{ color: '#166534', textDecoration: 'underline', fontWeight: '500' }}>Flashback Reference</a> for clip creation guidelines.
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {scriptPdf?.download_url && (
                                <div>
                                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                    Editing Script of Short:
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(scriptPdf)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      background: 'white',
                                      color: '#166534',
                                      border: '1px solid #86EFAC',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                      <polyline points="7 10 12 15 17 10"></polyline>
                                      <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    {scriptPdf.file_name}
                                  </button>
                                </div>
                              )}
                              {audioFile?.download_url && (
                                <div>
                                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                    Audio of Short:
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(audioFile)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      background: 'white',
                                      color: '#166534',
                                      border: '1px solid #86EFAC',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                      <polyline points="7 10 12 15 17 10"></polyline>
                                      <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    {audioFile.file_name}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Download Dependencies Section for Editors */}
                        {((contentColumn === 'editing' || contentColumn === 'editing_changes') && (scriptPdf?.download_url || audioFile?.download_url || clipsZip?.download_url)) && (
                          <div style={{
                            marginBottom: '16px',
                            padding: '12px',
                            background: '#F0FDF4',
                            borderRadius: '8px',
                            border: '1px solid #86EFAC'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {scriptPdf?.download_url && (
                                <div>
                                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                    Editing Script of Short:
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(scriptPdf)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      background: 'white',
                                      color: '#166534',
                                      border: '1px solid #86EFAC',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                      <polyline points="7 10 12 15 17 10"></polyline>
                                      <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    {scriptPdf.file_name}
                                  </button>
                                </div>
                              )}
                              {audioFile?.download_url && (
                                <div>
                                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                    Audio of Short:
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(audioFile)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      background: 'white',
                                      color: '#166534',
                                      border: '1px solid #86EFAC',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                      <polyline points="7 10 12 15 17 10"></polyline>
                                      <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    {audioFile.file_name}
                                  </button>
                                </div>
                              )}
                              {clipsZip?.download_url && (
                                <div>
                                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                    Flashback Clips of Short:
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(clipsZip)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      background: 'white',
                                      color: '#166534',
                                      border: '1px solid #86EFAC',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                      <polyline points="7 10 12 15 17 10"></polyline>
                                      <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    {clipsZip.file_name}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Upload/Replace Section */}
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                          }}>
                            {currentFile ? 'Replace File' : 'Upload File'} *
                          </label>
                          <input
                            type="file"
                            accept={(contentColumn === 'clips' || contentColumn === 'clip_changes') ? '.zip,application/zip' : 'video/*'}
                            onChange={(e) => setContentForm({ ...contentForm, file: e.target.files?.[0] || null })}
                            disabled={uploading}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #D1D5DB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                              opacity: uploading ? 0.6 : 1,
                              cursor: uploading ? 'not-allowed' : 'pointer',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
              
              {/* Mark Complete Button (Admin only, for clips/editing) */}
              {isAdmin && (contentColumn === 'clips' || contentColumn === 'clip_changes' || contentColumn === 'editing' || contentColumn === 'editing_changes') && (
                <div style={{
                  marginTop: '20px',
                  padding: '16px',
                  background: '#F0FDF4',
                  borderRadius: '8px',
                  border: '1px solid #86EFAC',
                  borderStyle: 'dashed',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#166534', marginBottom: '8px' }}>
                    {contentColumn === 'clips' || contentColumn === 'clip_changes' ? 'Mark Clips Complete' : 'Mark Editing Complete'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#15803D', marginBottom: '12px' }}>
                    {contentColumn === 'clips' || contentColumn === 'clip_changes' 
                      ? 'Mark this short\'s clips as complete. This will create a payment for the assigned clipper and allow moving to editing.'
                      : 'Mark this short\'s editing as complete. This will create a payment for the assigned editor and allow moving to ready to upload.'}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!contentShort) return;
                      const hasRequiredFile = (contentColumn === 'clips' || contentColumn === 'clip_changes')
                        ? contentShort.files?.some(f => f.file_type === 'clips_zip')
                        : contentShort.files?.some(f => f.file_type === 'final_video');
                      
                      if (!hasRequiredFile) {
                        showAlert(
                          contentColumn === 'clips' || contentColumn === 'clip_changes'
                            ? 'Cannot mark complete. Clips ZIP file is required.'
                            : 'Cannot mark complete. Final video file is required.',
                          { type: 'warning' }
                        );
                        return;
                      }
                      
                      // Check for assignment and rate before calling API
                      const shortAssignments = assignments.filter(a => a.short_id === contentShort.id);
                      const relevantAssignment = (contentColumn === 'clips' || contentColumn === 'clip_changes')
                        ? shortAssignments.find(a => a.role === 'clipper')
                        : shortAssignments.find(a => a.role === 'editor');
                      
                      if (!relevantAssignment) {
                        showAlert(
                          contentColumn === 'clips' || contentColumn === 'clip_changes'
                            ? 'Cannot mark complete. No clipper assignment found for this short.'
                            : 'Cannot mark complete. No editor assignment found for this short.',
                          { type: 'error' }
                        );
                        return;
                      }
                      
                      if (!relevantAssignment.rate || relevantAssignment.rate <= 0) {
                        showAlert(
                          contentColumn === 'clips' || contentColumn === 'clip_changes'
                            ? 'Cannot mark complete. Rate must be set for the clipper assignment before marking complete.'
                            : 'Cannot mark complete. Rate must be set for the editor assignment before marking complete.',
                          { type: 'error' }
                        );
                        return;
                      }
                      
                      try {
                        if (contentColumn === 'clips' || contentColumn === 'clip_changes') {
                          await shortsApi.markClipsComplete(contentShort.id);
                        } else {
                          await shortsApi.markEditingComplete(contentShort.id);
                        }
                        await loadData();
                        // Reload the short data
                        const updatedShort = await shortsApi.getById(contentShort.id);
                        setContentShort(updatedShort);
                        showToast(
                          contentColumn === 'clips' || contentColumn === 'clip_changes'
                            ? 'Clips marked as complete'
                            : 'Editing marked as complete',
                          'success'
                        );
                      } catch (error: any) {
                        console.error('Failed to mark complete:', error);
                        const errorMessage = error.response?.data?.error || 'Failed to mark complete';
                        showAlert(errorMessage, { type: 'error' });
                      }
                    }}
                    disabled={uploading || (
                      (contentColumn === 'clips' || contentColumn === 'clip_changes')
                        ? !contentShort.files?.some(f => f.file_type === 'clips_zip')
                        : !contentShort.files?.some(f => f.file_type === 'final_video')
                    )}
                    style={{
                      padding: '10px 20px',
                      background: (contentColumn === 'clips' || contentColumn === 'clip_changes')
                        ? (!contentShort.files?.some(f => f.file_type === 'clips_zip') || uploading)
                          ? '#9CA3AF'
                          : '#10B981'
                        : (!contentShort.files?.some(f => f.file_type === 'final_video') || uploading)
                          ? '#9CA3AF'
                          : '#10B981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: (uploading || (
                        (contentColumn === 'clips' || contentColumn === 'clip_changes')
                          ? !contentShort.files?.some(f => f.file_type === 'clips_zip')
                          : !contentShort.files?.some(f => f.file_type === 'final_video')
                      )) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {contentColumn === 'clips' || contentColumn === 'clip_changes' ? 'Mark Clips Complete' : 'Mark Editing Complete'}
                  </button>
                  {((contentColumn === 'clips' || contentColumn === 'clip_changes') && contentShort.clips_completed_at) && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#15803D' }}>
                      ✓ Completed on {new Date(contentShort.clips_completed_at).toLocaleDateString()}
                    </div>
                  )}
                  {((contentColumn === 'editing' || contentColumn === 'editing_changes') && contentShort.editing_completed_at) && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#15803D' }}>
                      ✓ Completed on {new Date(contentShort.editing_completed_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
              
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '24px',
              }}>
                <button
                  type="button"
                  onClick={() => {
                    if (!uploading) {
                      setShowContentModal(false);
                    }
                  }}
                  disabled={uploading}
                  style={{
                    padding: '10px 20px',
                    background: '#F3F4F6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Cancel
                </button>
                {(contentColumn === 'script' || contentForm.file) && (
                <button
                  type="submit"
                  disabled={uploading || (contentColumn === 'script' ? (!contentForm.scriptFile || !contentForm.audioFile) : !contentForm.file)}
                  style={{
                    padding: '10px 20px',
                    background: uploading ? '#9CA3AF' : columns.find(c => c.id === contentColumn)?.color || '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {uploading && (
                    <svg style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {uploading 
                    ? 'Uploading...' 
                    : (() => {
                        if (contentColumn === 'script') {
                          const hasScript = contentShort.files?.some(f => f.file_type === 'script');
                          const hasAudio = contentShort.files?.some(f => f.file_type === 'audio');
                          return (hasScript || hasAudio) ? 'Replace' : 'Upload';
                        } else if (contentColumn === 'clips' || contentColumn === 'clip_changes') {
                          const hasClipsZip = contentShort.files?.some(f => f.file_type === 'clips_zip');
                          return hasClipsZip ? 'Replace' : 'Upload';
                        } else if (contentColumn === 'editing' || contentColumn === 'editing_changes') {
                          const hasFinalVideo = contentShort.files?.some(f => f.file_type === 'final_video');
                          return hasFinalVideo ? 'Replace' : 'Upload';
                        }
                        return 'Upload';
                      })()}
                </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
      <AlertComponent />
      <ToastComponent />
      <ConfirmComponent />
    </div>
    </>
  );
}
