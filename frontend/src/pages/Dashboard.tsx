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
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { DashboardFilters } from '../components/DashboardFilters';
import { KanbanBoard } from '../components/KanbanBoard';
import { CreateShortModal } from '../components/CreateShortModal';
import { ContentModal } from '../components/ContentModal';
import { useCardClick } from '../hooks/useCardClick';
import { columns, statusToColumn, columnToStatus, getValidColumns, ColumnType, Column } from '../utils/dashboardUtils';
import { getErrorMessage } from '../utils/errorHandler';
import { File as FileType, ShortStatus } from '../../../shared/types';

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
    new Set(['script', 'clips', 'clip_changes', 'editing', 'editing_changes'])
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null); // fileId of file being downloaded
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

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

      // Load assignments and users
      if (isAdmin) {
        const [assignmentsData, usersData] = await Promise.all([
          assignmentsApi.getAll(),
          usersApi.getAll(),
        ]);
        setAssignments(assignmentsData || []);
        setUsers(usersData || []);
      } else {
        // Non-admin users load all public assignments (to see who's assigned to cards)
        // but don't need to load all users
        const assignmentsData = await assignmentsApi.getAllPublic().catch(error => {
          console.error('Failed to load public assignments:', error);
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
  
  const handleAssign = async (shortId: number, role: 'clipper' | 'editor' | 'script_writer', userId: number) => {
    try {
      if (role === 'script_writer') {
        // For script writers, update the short's script_writer_id
        await shortsApi.update(shortId, { script_writer_id: userId });
      } else {
        // For clippers and editors, use assignments table
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
      }
      await loadData();
      showToast('Assignment created successfully', 'success');
    } catch (error: unknown) {
      console.error('Failed to assign:', error);
      showAlert(getErrorMessage(error, 'Failed to assign user'), { type: 'error' });
    }
  };

  const getShortsForColumn = (columnId: ColumnType): Short[] => {
    const filtered = shorts.filter(short => statusToColumn(short.status) === columnId);
    
    // Sort 'clips' and 'script' columns by created_at (oldest first)
    if (columnId === 'clips' || columnId === 'script') {
      return [...filtered].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateA - dateB; // Oldest first
      });
    }
    
    return filtered;
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
      await shortsApi.update(shortId, { status: newStatus as ShortStatus });
      await loadData();
      showToast('Short status updated successfully', 'success');
    } catch (error: unknown) {
      console.error('Failed to update short status:', error);
      showAlert(getErrorMessage(error, 'Failed to update short status'), { type: 'warning' });
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

  const { handleCardClick } = useCardClick({
    assignments,
    user: user || null,
    isAdmin,
    setContentShort,
    setContentColumn,
    setContentForm,
    setShowContentModal,
    navigate,
  });

  const handleContentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentShort || !contentColumn) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      if (contentColumn === 'script') {
        if (!contentForm.scriptFile || !contentForm.audioFile) {
          showAlert('Both Script PDF and Audio MP3 are required', { type: 'warning' });
          setUploading(false);
          setUploadProgress(null);
          return;
        }
        // Calculate total file size for accurate progress
        const scriptFileSize = contentForm.scriptFile.size;
        const audioFileSize = contentForm.audioFile.size;
        const totalSize = scriptFileSize + audioFileSize;
        let uploadedBytes = 0;
        
        // Upload script file directly to GCS (0-50% of total)
        const scriptUploadUrl = await filesApi.getUploadUrl(
          contentShort.id,
          'script',
          contentForm.scriptFile.name,
          contentForm.scriptFile.size,
          contentForm.scriptFile.type
        );
        await filesApi.uploadDirectToGCS(
          scriptUploadUrl.upload_url,
          contentForm.scriptFile,
          (progress) => {
            uploadedBytes = progress.loaded;
            const percent = Math.round((uploadedBytes / totalSize) * 100);
            setUploadProgress(Math.min(percent, 50));
          }
        );
        await filesApi.confirmUpload(
          contentShort.id,
          'script',
          scriptUploadUrl.bucket_path,
          contentForm.scriptFile.name,
          contentForm.scriptFile.size,
          contentForm.scriptFile.type
        );
        
        // Upload audio file directly to GCS (50-100% of total)
        const audioUploadUrl = await filesApi.getUploadUrl(
          contentShort.id,
          'audio',
          contentForm.audioFile.name,
          contentForm.audioFile.size,
          contentForm.audioFile.type
        );
        await filesApi.uploadDirectToGCS(
          audioUploadUrl.upload_url,
          contentForm.audioFile,
          (progress) => {
            uploadedBytes = scriptFileSize + progress.loaded;
            const percent = Math.round((uploadedBytes / totalSize) * 100);
            setUploadProgress(Math.min(percent, 100));
          }
        );
        await filesApi.confirmUpload(
          contentShort.id,
          'audio',
          audioUploadUrl.bucket_path,
          contentForm.audioFile.name,
          contentForm.audioFile.size,
          contentForm.audioFile.type
        );
      } else if ((contentColumn === 'clips' || contentColumn === 'clip_changes') && contentForm.file) {
        // Get signed upload URL
        const uploadUrlData = await filesApi.getUploadUrl(
          contentShort.id,
          'clips_zip',
          contentForm.file.name,
          contentForm.file.size,
          contentForm.file.type
        );
        
        // Upload directly to GCS
        await filesApi.uploadDirectToGCS(
          uploadUrlData.upload_url,
          contentForm.file,
          (progress) => {
            // Use actual upload progress (0-100%)
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(percent);
          }
        );
        
        // Confirm upload completion
        await filesApi.confirmUpload(
          contentShort.id,
          'clips_zip',
          uploadUrlData.bucket_path,
          contentForm.file.name,
          contentForm.file.size,
          contentForm.file.type
        );
      } else if ((contentColumn === 'editing' || contentColumn === 'editing_changes') && contentForm.file) {
        // Get signed upload URL
        const uploadUrlData = await filesApi.getUploadUrl(
          contentShort.id,
          'final_video',
          contentForm.file.name,
          contentForm.file.size,
          contentForm.file.type
        );
        
        // Upload directly to GCS
        await filesApi.uploadDirectToGCS(
          uploadUrlData.upload_url,
          contentForm.file,
          (progress) => {
            // Use actual upload progress (0-100%)
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(percent);
          }
        );
        
        // Confirm upload completion
        await filesApi.confirmUpload(
          contentShort.id,
          'final_video',
          uploadUrlData.bucket_path,
          contentForm.file.name,
          contentForm.file.size,
          contentForm.file.type
        );
      }

      // Upload is complete (100%)
      setUploadProgress(100);
      
      // Determine which file types were uploaded for confetti
      let uploadedFileType: string | null = null;
      if (contentColumn === 'script') {
        uploadedFileType = 'script'; // Both script and audio uploaded, trigger once
      } else if (contentColumn === 'clips' || contentColumn === 'clip_changes') {
        uploadedFileType = 'clips_zip';
      } else if (contentColumn === 'editing' || contentColumn === 'editing_changes') {
        uploadedFileType = 'final_video';
      }
      
      // Trigger confetti for specific file types (before closing modal so it's visible)
      if (uploadedFileType === 'script' || uploadedFileType === 'clips_zip' || uploadedFileType === 'final_video') {
        triggerConfetti();
      }
      
      // Show success toast
      showToast('Content saved successfully', 'success');
      
      // Wait a moment to show 100% completion and confetti, then close modal
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Close modal and reset form
      setShowContentModal(false);
      setContentShort(null);
      setContentColumn(null);
      setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
      
      // Reload data in the background (don't wait for it)
      loadData().catch(error => {
        console.warn('Failed to reload data after upload:', error);
        // Don't show error to user - file is already uploaded successfully
      });
    } catch (error: any) {
      console.error('Failed to save content:', error);
      
      // Handle network errors
      if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
        // If upload reached 100%, the file likely uploaded successfully but server processing timed out
        if (uploadProgress === 100 || uploadProgress === null) {
          showToast('Upload completed but server is still processing. Checking...', 'info');
          // Wait a bit then check if file exists
          setTimeout(async () => {
            try {
              await loadData();
              // Try to reload the short to see if file was uploaded
              if (contentShort) {
                const updatedShort = await shortsApi.getById(contentShort.id);
                setContentShort(updatedShort);
                // Check if the file exists
                const expectedFileType = contentColumn === 'script' ? 'script' : 
                                       (contentColumn === 'clips' || contentColumn === 'clip_changes') ? 'clips_zip' : 'final_video';
                const fileExists = updatedShort.files?.some(f => f.file_type === expectedFileType);
                if (fileExists) {
                  showToast('File uploaded successfully!', 'success');
                  triggerConfetti();
                  setShowContentModal(false);
                  setContentShort(null);
                  setContentColumn(null);
                  setContentForm({ script_content: '', file: null, scriptFile: null, audioFile: null });
                } else {
                  showAlert('Upload may have completed, but file not found. Please refresh the page to check.', { type: 'warning' });
                }
              }
            } catch (checkError) {
              showAlert('Upload may have completed, but could not verify. Please refresh the page to check.', { type: 'warning' });
            }
          }, 2000);
        } else {
          showAlert(
            'Network error: Unable to connect to the server. Please check your internet connection and try again.',
            { type: 'error' }
          );
        }
      } else if (error?.code === 'ECONNABORTED') {
        // Timeout error
        if (uploadProgress === 100) {
          // Upload may have completed but response timed out
          showToast('Upload may have completed. Refreshing...', 'info');
          loadData().then(() => {
            showToast('File uploaded successfully', 'success');
          }).catch(() => {
            showAlert('Upload may have completed, but could not verify. Please refresh the page.', { type: 'warning' });
          });
        } else {
          showAlert('Upload timed out. The file may be too large. Please try again or contact support.', { type: 'error' });
        }
      } else {
        const errorMessage = error?.response?.data?.error || error?.message || 'Failed to save content. Please try again.';
        showAlert(errorMessage, { type: 'error' });
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDownloadFile = async (file: FileType) => {
    if (!file.download_url) {
      showAlert('Download URL not available', { type: 'error' });
      return;
    }
    try {
      setDownloading(file.id);
      setDownloadProgress(0);
      
      // Fetch the file with progress tracking
      const response = await fetch(file.download_url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }
      
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        // Update progress if we know the total size
        if (total > 0) {
          const progress = Math.round((receivedLength / total) * 100);
          setDownloadProgress(progress);
        } else {
          // If we don't know the total, show indeterminate progress
          setDownloadProgress(null);
        }
      }
      
      // Combine all chunks into a single blob
      const allChunks = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }
      
      const blob = new Blob([allChunks]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setDownloadProgress(100);
      showToast('File downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to download file:', error);
      showAlert('Failed to download file', { type: 'error' });
    } finally {
      setDownloading(null);
      setDownloadProgress(null);
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
        try {
          const updatedShort = await shortsApi.getById(contentShort.id);
          setContentShort(updatedShort);
        } catch (error) {
          // If we can't reload the short, just reload data
          console.warn('Failed to reload short after delete, reloading all data:', error);
        }
      }
      await loadData();
      showToast('File deleted successfully', 'success');
    } catch (error: any) {
      console.error('Failed to delete file:', error);
      const errorMessage = error?.response?.status === 404 
        ? 'File not found. It may have already been deleted.'
        : error?.response?.data?.error || 'Failed to delete file';
      showAlert(errorMessage, { type: 'error' });
    }
  };

  const activeShort = activeId ? shorts.find(s => `short-${s.id}` === activeId) : null;

  const toggleColumnView = (viewType: 'clipper' | 'script' | 'idea' | 'editing' | 'uploaded') => {
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
      } else if (viewType === 'uploaded') {
        columnsToToggle = ['ready_to_upload', 'uploaded'];
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
  // Also hide 'clip_changes' and 'editing_changes' if they're empty
  const filteredColumns = columns.filter(col => {
    if (col.id === 'idea' && !isAdmin) return false;
    if (!visibleColumns.has(col.id)) return false;
    
    // Hide clip_changes and editing_changes columns if they're empty
    if (col.id === 'clip_changes' || col.id === 'editing_changes') {
      const columnShorts = shorts.filter(short => statusToColumn(short.status) === col.id);
      if (columnShorts.length === 0) return false;
    }
    
    return true;
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
          transition: grid-template-columns 0.3s ease-in-out;
        }
      `}</style>
    <div style={{
      padding: '0 4px',
    }}>
      <DashboardFilters
        showAssignedOnly={showAssignedOnly}
        setShowAssignedOnly={setShowAssignedOnly}
        visibleColumns={visibleColumns}
        toggleColumnView={toggleColumnView}
        isAdmin={isAdmin}
      />

      <KanbanBoard
        filteredColumns={filteredColumns}
        shorts={shorts}
        assignments={assignments}
        users={users}
        isAdmin={isAdmin}
        currentUserId={user?.id}
        sensors={sensors}
        activeId={activeId}
        activeShort={activeShort || null}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onCardClick={handleCardClick}
        onAssign={handleAssign}
        onCreateClick={handleCreateClick}
        navigate={navigate}
        getShortsForColumn={getShortsForColumn}
      />

      <CreateShortModal
        isOpen={showCreateModal}
        createColumn={createColumn}
        createForm={createForm}
        creating={creating}
        onClose={() => {
          setShowCreateModal(false);
          setCreateColumn(null);
          setCreateForm({ title: '', description: '', idea: '' });
        }}
        onSubmit={handleCreateSubmit}
        onFormChange={setCreateForm}
      />

      <ContentModal
        isOpen={showContentModal}
        contentShort={contentShort}
        contentColumn={contentColumn}
        contentForm={contentForm}
        uploading={uploading}
        uploadProgress={uploadProgress}
        downloading={downloading}
        downloadProgress={downloadProgress}
        assignments={assignments}
        user={user || null}
        isAdmin={isAdmin}
        onClose={() => {
          setShowContentModal(false);
          setContentShort(null);
          setContentColumn(null);
          setUploadProgress(null);
          setDownloading(null);
          setDownloadProgress(null);
        }}
        onSubmit={handleContentSubmit}
        onFormChange={setContentForm}
        onDownloadFile={handleDownloadFile}
        onDeleteFile={handleDeleteFile}
        onMarkComplete={async (shortId, column) => {
          try {
            if (column === 'clips' || column === 'clip_changes') {
              await shortsApi.markClipsComplete(shortId);
            } else {
              await shortsApi.markEditingComplete(shortId);
            }
            await loadData();
            // Reload the short data
            const updatedShort = await shortsApi.getById(shortId);
            setContentShort(updatedShort);
            showToast(
              column === 'clips' || column === 'clip_changes'
                ? 'Clips marked as complete'
                : 'Editing marked as complete',
              'success'
            );
          } catch (error: unknown) {
            console.error('Failed to mark complete:', error);
            showAlert(getErrorMessage(error, 'Failed to mark complete'), { type: 'error' });
          }
        }}
        showAlert={showAlert}
        loadData={loadData}
        setContentShort={setContentShort}
      />
    </div>
    <AlertComponent />
    <ToastComponent />
      <ConfirmComponent />
      
      {/* Version number in bottom right */}
      <div style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        fontSize: '12px',
        color: '#9CA3AF',
        zIndex: 10,
        fontFamily: 'monospace',
      }}>
        v1.1.9
      </div>
    </React.Fragment>
  );
}
