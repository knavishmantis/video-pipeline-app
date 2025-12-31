import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { shortsApi, filesApi, assignmentsApi, usersApi } from '../services/api';
import { Short, CreateShortInput, FileType, Assignment, User } from '../../../shared/types';
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

type ColumnType = 'idea' | 'script' | 'clips' | 'clip_changes' | 'editing' | 'editing_changes' | 'ready_to_upload';

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
];

// Map database status to column
const statusToColumn = (status: string): ColumnType => {
  const map: Record<string, ColumnType> = {
    'idea': 'idea',
    'script': 'script',
    'clipping': 'clips',
    'editing': 'editing',
    'completed': 'editing_changes',
    'ready_to_upload': 'ready_to_upload',
  };
  return map[status] || 'idea';
};

// Map column to database status
const columnToStatus = (column: ColumnType): string => {
  const map: Record<ColumnType, string> = {
    'idea': 'idea',
    'script': 'script',
    'clips': 'clipping',
    'clip_changes': 'clipping',
    'editing': 'editing',
    'editing_changes': 'editing',
    'ready_to_upload': 'ready_to_upload',
  };
  return map[column];
};

// Get valid columns for a given column (can move forward or backward one step)
const getValidColumns = (currentColumn: ColumnType): ColumnType[] => {
  const current = columns.find(c => c.id === currentColumn);
  if (!current) return [];
  
  const valid: ColumnType[] = [];
  // Can move to previous column
  const prev = columns.find(c => c.order === current.order - 1);
  if (prev) valid.push(prev.id);
  // Can move to next column
  const next = columns.find(c => c.order === current.order + 1);
  if (next) valid.push(next.id);
  
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
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: isOver ? `2px dashed ${column.color}` : '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 200px)',
        transition: 'all 0.2s',
        marginBottom: '4px', // Space for scrollbar
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
  const [shorts, setShorts] = useState<Short[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnType>>(new Set(columns.map(c => c.id)));
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
    file: null as File | null,
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
      const [shortsData, assignmentsData, usersData] = await Promise.all([
        showAssignedOnly ? shortsApi.getAssigned() : shortsApi.getAll(),
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
    } catch (error: any) {
      console.error('Failed to assign:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to assign user';
      alert(errorMsg);
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
    const validColumns = getValidColumns(currentColumn);

    // Only allow moving to adjacent columns
    if (!validColumns.includes(targetColumnId)) {
      return;
    }

    try {
      const newStatus = columnToStatus(targetColumnId);
      await shortsApi.update(shortId, { status: newStatus as any });
      await loadData();
    } catch (error) {
      console.error('Failed to update short status:', error);
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
    } catch (error) {
      console.error('Failed to create short:', error);
      alert('Failed to create short. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleCardClick = (short: Short, column: Column) => {
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
      setContentShort(short);
      setContentColumn(column.id);
      setContentForm({ script_content: '', file: null });
      setShowContentModal(true);
    } else if (column.id === 'clips') {
      setContentShort(short);
      setContentColumn(column.id);
      setContentForm({ script_content: '', file: null });
      setShowContentModal(true);
    } else if (column.id === 'editing') {
      setContentShort(short);
      setContentColumn(column.id);
      setContentForm({ script_content: '', file: null });
      setShowContentModal(true);
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
      if (contentColumn === 'script' && contentForm.file) {
        await filesApi.upload(contentShort.id, 'script', contentForm.file);
      } else if (contentColumn === 'clips' && contentForm.file) {
        await filesApi.upload(contentShort.id, 'clip', contentForm.file);
      } else if (contentColumn === 'editing' && contentForm.file) {
        await filesApi.upload(contentShort.id, 'final_video', contentForm.file);
      }

      setShowContentModal(false);
      setContentShort(null);
      setContentColumn(null);
      setContentForm({ script_content: '', file: null });
      await loadData();
    } catch (error) {
      console.error('Failed to save content:', error);
      alert('Failed to save content. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const activeShort = activeId ? shorts.find(s => `short-${s.id}` === activeId) : null;

  const toggleColumnView = (viewType: 'clipper' | 'script' | 'idea' | 'editing') => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      let columnsToToggle: ColumnType[] = [];
      
      if (viewType === 'clipper') {
        columnsToToggle = ['clips', 'clip_changes'];
      } else if (viewType === 'script') {
        columnsToToggle = ['script'];
      } else if (viewType === 'idea') {
        columnsToToggle = ['idea'];
      } else       if (viewType === 'editing') {
        columnsToToggle = ['editing', 'editing_changes'];
      } else if (viewType === 'upload') {
        columnsToToggle = ['ready_to_upload'];
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

  const filteredColumns = columns.filter(col => visibleColumns.has(col.id));

  return (
    <div>
        {/* Filter Controls */}
        <div style={{ 
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          {/* Toggle Switch for Assigned/Show All */}
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

          {/* View Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
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
              onClick={() => toggleColumnView('upload')}
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
              Upload View
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${filteredColumns.length}, 1fr)`,
            gap: '16px',
            overflowX: filteredColumns.length > 0 ? 'auto' : 'visible',
            overflowY: 'hidden',
            paddingBottom: '20px',
            marginBottom: '4px',
            height: 'calc(100vh - 200px)',
          }}>
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
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      overflowY: 'auto',
                      overflowX: 'visible',
                      flex: 1,
                      minHeight: 0, // Allow flex to shrink
                      paddingTop: '4px', // Space for hover effect at top
                      paddingBottom: '4px', // Space for hover effect at bottom
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
          onClick={() => !uploading && setShowContentModal(false)}
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
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: '600',
              color: '#1E293B',
            }}>
              {contentColumn === 'script' && 'Upload Script PDF'}
              {contentColumn === 'clips' && 'Upload Clip'}
              {contentColumn === 'editing' && 'Upload Final Video'}
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '14px' }}>
              {contentShort.title}
            </p>
            <form onSubmit={handleContentSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                }}>
                  {contentColumn === 'script' && 'Script PDF File *'}
                  {contentColumn === 'clips' && 'Clip File *'}
                  {contentColumn === 'editing' && 'Final Video File *'}
                </label>
                <input
                  type="file"
                  accept={contentColumn === 'script' ? 'application/pdf' : 'video/*'}
                  onChange={(e) => setContentForm({ ...contentForm, file: e.target.files?.[0] || null })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '24px',
              }}>
                <button
                  type="button"
                  onClick={() => !uploading && setShowContentModal(false)}
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
                <button
                  type="submit"
                  disabled={uploading || !contentForm.file}
                  style={{
                    padding: '10px 20px',
                    background: uploading ? '#9CA3AF' : columns.find(c => c.id === contentColumn)?.color || '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
