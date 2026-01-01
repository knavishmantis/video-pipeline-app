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
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DroppableColumn } from '../components/DroppableColumn';
import { SortableCard } from '../components/SortableCard';
import { columns, statusToColumn, columnToStatus, getValidColumns, ColumnType, Column } from '../utils/dashboardUtils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';
  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();
  const { confirm, ConfirmComponent } = useConfirm();
  
  const [shorts, setShorts] = useState<Short[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnType>>(
    new Set(['script', 'clips', 'clip_changes', 'editing', 'editing_changes', 'ready_to_upload', 'uploaded'])
  );
  
  // Create/Edit Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createColumn, setCreateColumn] = useState<ColumnType | null>(null);
  const [createForm, setCreateForm] = useState({ title: '', description: '', idea: '' });
  const [creating, setCreating] = useState(false);
  
  // Content Modal State
  const [showContentModal, setShowContentModal] = useState(false);
  const [contentShort, setContentShort] = useState<Short | null>(null);
  const [contentColumn, setContentColumn] = useState<ColumnType | null>(null);
  const [contentForm, setContentForm] = useState<{
    script_content: string;
    file: File | null;
    scriptFile: File | null;
    audioFile: File | null;
  }>({ script_content: '', file: null, scriptFile: null, audioFile: null });
  const [uploading, setUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const REFRESH_INTERVAL = 30 * 1000; // 30 seconds

  useEffect(() => {
    loadData(); // Initial load

    const interval = setInterval(() => {
      // Only auto-refresh if no modals are open and not currently loading
      if (!showCreateModal && !showContentModal && !loading) {
        loadData(true); // Silent refresh
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval); // Cleanup on unmount
  }, [showAssignedOnly, showCreateModal, showContentModal, isAdmin]); // Added isAdmin to dependencies

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Load shorts based on toggle (all users can toggle)
      const shouldShowAssignedOnly = showAssignedOnly;

      // Load shorts first (required for all users)
      const shortsData = shouldShowAssignedOnly ? await shortsApi.getAssigned() : await shortsApi.getAll();
      setShorts(shortsData);

      // Load assignments and users (only if admin, or use my assignments for non-admin)
      if (isAdmin) {
        const [assignmentsData, usersData] = await Promise.all([
          assignmentsApi.getAll(),
          usersApi.getAll(),
        ]);
        setAssignments(assignmentsData || []);
        setUsers(usersData || []);
      } else {
        // Non-admin users only need their own assignments to check edit permissions
        // And they don't need to load all users
        const assignmentsData = await assignmentsApi.getMyAssignments().catch(error => {
          console.error('Failed to load user assignments:', error);
          return []; // Fallback to empty array
        });
        setAssignments(assignmentsData || []);
        setUsers([]); // Non-admin users don't need all users
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      // Don't fail completely - at least try to load shorts
      try {
        const shouldShowAssignedOnly = showAssignedOnly;
        const shortsData = shouldShowAssignedOnly ? await shortsApi.getAssigned() : await shortsApi.getAll();
        setShorts(shortsData);
      } catch (shortsError) {
        console.error('Failed to load shorts:', shortsError);
      }
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
    <React.Fragment>
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
    </React.Fragment>
  );
}
