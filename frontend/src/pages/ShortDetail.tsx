import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../hooks/useAlert';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { shortsApi, assignmentsApi, filesApi, usersApi } from '../services/api';
import { Short, File as FileInterface, FileType, User, ShortStatus, AssignmentRole } from '../../../shared/types';
import { triggerConfetti } from '../utils/confetti';
import { getErrorMessage } from '../utils/errorHandler';
import SceneEditor from '../components/SceneEditor';

// Helper to get profile picture (emoji, image URL, or fallback)
const getProfilePicture = (user: User | undefined): string => {
  if (!user) return '';
  if (user.profile_picture) {
    if (user.profile_picture.startsWith('http')) {
      return user.profile_picture;
    }
    // It's an emoji, return empty string (we'll render it as text)
    return '';
  }
  // Fallback to UI Avatars
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.discord_username || user.name || 'User')}&background=6366f1&color=fff&size=128&bold=true`;
};

export default function ShortDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useAlert();
  const { confirm, ConfirmComponent } = useConfirm();
  const { showToast, ToastComponent } = useToast();
  const [short, setShort] = useState<Short | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null); // Track which file type is uploading
  const [users, setUsers] = useState<User[]>([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignRole, setAssignRole] = useState<'script_writer' | 'clipper' | 'editor'>('clipper');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignTimeRange, setAssignTimeRange] = useState('4');
  const [assignRate, setAssignRate] = useState('');
  const [assignRateDescription, setAssignRateDescription] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';

  useEffect(() => {
    if (id) {
      loadShort();
      loadUsers();
    }
  }, [id]);

  const loadShort = async () => {
    if (!id) return;
    try {
      const data = await shortsApi.getById(parseInt(id));
      setShort(data);
      setAccessDenied(false);
    } catch (error: unknown) {
      console.error('Failed to load short:', error);
      // If 403 (forbidden), show access denied message
      if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'status' in error.response && error.response.status === 403) {
        setAccessDenied(true);
        setShort(null);
      } else {
        // For other errors (404, etc.), just set short to null
        setShort(null);
        setAccessDenied(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await usersApi.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleAssign = async () => {
    if (!id || !assignUserId) return;
    try {
      // If assigning script_writer, update the short directly
      if (assignRole === 'script_writer') {
        await shortsApi.update(parseInt(id), { script_writer_id: parseInt(assignUserId) });
      } else {
        // Delete existing assignment for this role first
        const existingAssignments = short?.assignments?.filter(a => a.role === assignRole) || [];
        for (const assignment of existingAssignments) {
          try {
            await assignmentsApi.delete(assignment.id);
          } catch (e) {
            // Ignore if doesn't exist
          }
        }
        
        await assignmentsApi.create({
          short_id: parseInt(id),
          user_id: parseInt(assignUserId),
          role: assignRole,
          due_date: assignDueDate || undefined,
          default_time_range: parseInt(assignTimeRange) || 4,
          rate: assignRate ? parseInt(assignRate) : undefined,
          rate_description: assignRateDescription || undefined,
        });
      }
      setShowAssignForm(false);
      setAssignUserId('');
      setAssignDueDate('');
      setAssignRate('');
      setAssignRateDescription('');
      loadShort();
    } catch (error) {
      console.error('Failed to create assignment:', error);
      showAlert('Failed to create assignment', { type: 'error' });
    }
  };

  const handleDeleteAssignment = async (assignmentId: number, role: string) => {
    const confirmed = await confirm({
      title: 'Remove Assignment',
      message: 'Are you sure you want to remove this assignment?',
      variant: 'danger',
      confirmText: 'Remove',
    });
    if (!confirmed) return;
    try {
      if (role === 'script_writer') {
        await shortsApi.update(parseInt(id!), { script_writer_id: null });
      } else {
        await assignmentsApi.delete(assignmentId);
      }
      loadShort();
      showToast('Assignment removed successfully', 'success');
    } catch (error) {
      console.error('Failed to delete assignment:', error);
      showAlert('Failed to delete assignment', { type: 'error' });
    }
  };

  const handleFileUpload = async (fileType: FileType, file: globalThis.File) => {
    if (!id) return;
    setUploading(fileType);
    try {
      await filesApi.upload(parseInt(id), fileType, file);
      await loadShort();
      showToast('File uploaded successfully', 'success');
      
      // Trigger confetti for specific file types
      if (fileType === 'script' || fileType === 'audio' || fileType === 'clips_zip' || fileType === 'final_video') {
        triggerConfetti();
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      showAlert('Failed to upload file', { type: 'error' });
    } finally {
      setUploading(null);
    }
  };

  const handleDownload = async (file: FileInterface) => {
    // Lazy load signed URL if not present
    let downloadUrl = file.download_url;
    if (!downloadUrl) {
      try {
        downloadUrl = await filesApi.getSignedUrl(file.id);
      } catch (error: any) {
        console.error('Failed to get signed URL:', error);
        showAlert('Failed to get download URL', { type: 'error' });
        return;
      }
    }
    
    if (!downloadUrl) {
      showAlert('Download URL not available', { type: 'error' });
      return;
    }
    try {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download file:', error);
      showAlert('Failed to download file', { type: 'error' });
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!id) return;
    const confirmed = await confirm({
      title: 'Delete File',
      message: 'Are you sure you want to delete this file? This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    
    try {
      await filesApi.delete(fileId);
      await loadShort();
      showToast('File deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete file:', error);
      showAlert('Failed to delete file', { type: 'error' });
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    try {
      await shortsApi.update(parseInt(id), { status: status as ShortStatus });
      loadShort();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading…</div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Access Denied</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Oops, you don't have access to view this page.</p>
        </div>
      </div>
    );
  }

  if (!short) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Short not found</div>
      </div>
    );
  }

  // const clips = short.files?.filter(f => f.file_type === 'clip') || [];
  const clipsZip = short.files?.filter(f => f.file_type === 'clips_zip') || [];
  const audioFiles = short.files?.filter(f => f.file_type === 'audio') || [];
  const finalVideos = short.files?.filter(f => f.file_type === 'final_video') || [];
  const scriptPdf = short.files?.find(f => f.file_type === 'script');
  
  const clipperAssignment = short.assignments?.find(a => a.role === 'clipper');
  const editorAssignment = short.assignments?.find(a => a.role === 'editor');
  const scriptWriterUser = short.script_writer;

  // Get users filtered by role
  const getUsersForRole = (role: 'script_writer' | 'clipper' | 'editor') => {
    return users.filter(u => {
      const userRoles = u.roles || (u.role ? [u.role] : []);
      return userRoles.includes(role) || userRoles.includes('admin');
    });
  };

  return (
    <div style={{ padding: '0 4px', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="px-2 py-0">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center text-sm mb-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{short.title}</h1>
              {short.description && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{short.description}</p>
              )}
            </div>
            <select
              value={short.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-4 py-2 rounded-lg"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              <option value="idea">Idea</option>
              <option value="script">Script</option>
              <option value="clipping">Clipping</option>
              <option value="clip_changes">Clip Changes</option>
              <option value="editing">Editing</option>
              <option value="editing_changes">Editing Changes</option>
            </select>
          </div>
        </div>

        {/* Assignments Section */}
        <section className="mb-8" style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Assignments</h2>
            {isAdmin && (
              <button
                onClick={() => setShowAssignForm(!showAssignForm)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: showAssignForm ? 'var(--bg-elevated)' : 'var(--gold)', color: showAssignForm ? 'var(--text-secondary)' : 'var(--bg-surface)', border: showAssignForm ? '1px solid var(--border-default)' : 'none', cursor: 'pointer' }}
              >
                {showAssignForm ? 'Cancel' : '+ Assign'}
              </button>
            )}
          </div>

          {showAssignForm && (
            <div className="px-6 py-4" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-default)' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Role</label>
                  <select
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value as AssignmentRole)}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  >
                    <option value="script_writer">Script Writer</option>
                    <option value="clipper">Clipper</option>
                    <option value="editor">Editor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>User</label>
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Select user</option>
                    {getUsersForRole(assignRole).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.discord_username || u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Due Date</label>
                  <input
                    type="datetime-local"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>
                {assignRole !== 'script_writer' && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Time Range (hours)</label>
                    <input
                      type="number"
                      value={assignTimeRange}
                      onChange={(e) => setAssignTimeRange(e.target.value)}
                      min="1"
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                )}
              </div>
              {assignRole !== 'script_writer' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Rate ($)</label>
                    <input
                      type="text"
                      value={assignRate}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setAssignRate(value);
                      }}
                      placeholder="40"
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Rate Description</label>
                    <input
                      type="text"
                      value={assignRateDescription}
                      onChange={(e) => setAssignRateDescription(e.target.value)}
                      placeholder='e.g., "$25 base + $10 if 200k views"'
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              )}
              <button
                onClick={handleAssign}
                className="px-6 py-2 rounded-lg font-semibold text-sm transition-all" style={{ background: 'var(--gold)', color: 'var(--bg-surface)', border: 'none', cursor: 'pointer' }}
              >
                Assign
              </button>
            </div>
          )}

          <div className="px-6 py-4 space-y-3">
            {/* Script Writer */}
            <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderLeft: '3px solid var(--col-script)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: 'var(--col-script-dim)', border: '1px solid var(--col-script-border)', color: 'var(--col-script)' }}>
                  S
                </div>
                <div>
                  <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Script Writer</div>
                  {scriptWriterUser ? (
                    <div className="flex items-center gap-2 mt-1">
                      {scriptWriterUser.profile_picture && !scriptWriterUser.profile_picture.startsWith('http') ? (
                        <span className="text-lg">{scriptWriterUser.profile_picture}</span>
                      ) : (
                        <img 
                          src={getProfilePicture(scriptWriterUser)} 
                          alt={scriptWriterUser.discord_username || scriptWriterUser.name}
                          className="w-5 h-5 rounded-full"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(scriptWriterUser.discord_username || scriptWriterUser.name || 'User')}&background=6366f1&color=fff&size=128&bold=true`;
                          }}
                        />
                      )}
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {scriptWriterUser.discord_username || scriptWriterUser.name || 'Unknown'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Not assigned</span>
                  )}
                </div>
              </div>
              {isAdmin && scriptWriterUser && (
                <button
                  onClick={() => handleDeleteAssignment(0, 'script_writer')}
                  className="px-3 py-1 text-sm rounded transition-colors"
                  style={{ color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Remove
                </button>
              )}
            </div>

            {/* Clipper */}
            <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderLeft: '3px solid var(--col-clips)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: 'var(--col-clips-dim)', border: '1px solid var(--col-clips-border)', color: 'var(--col-clips)' }}>
                  C
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Clipper</div>
                  {clipperAssignment?.user ? (
                    <div className="flex items-center gap-2 mt-1">
                      {clipperAssignment.user.profile_picture && !clipperAssignment.user.profile_picture.startsWith('http') ? (
                        <span className="text-lg">{clipperAssignment.user.profile_picture}</span>
                      ) : (
                        <img 
                          src={getProfilePicture(clipperAssignment.user)} 
                          alt={clipperAssignment.user.discord_username || clipperAssignment.user.name}
                          className="w-5 h-5 rounded-full"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(clipperAssignment.user?.discord_username || clipperAssignment.user?.name || 'User')}&background=6366f1&color=fff&size=128&bold=true`;
                          }}
                        />
                      )}
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {clipperAssignment.user.discord_username || clipperAssignment.user.name || 'Unknown'}
                      </span>
                      {clipperAssignment.due_date && (
                        <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                          Due: {new Date(clipperAssignment.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {clipperAssignment.completed_at && (
                        <span className="text-xs ml-2" style={{ color: 'var(--green)' }}>✓ Completed</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Not assigned</span>
                  )}
                </div>
              </div>
              {isAdmin && clipperAssignment && (
                <button
                  onClick={() => handleDeleteAssignment(clipperAssignment.id, 'clipper')}
                  className="px-3 py-1 text-sm rounded transition-colors"
                  style={{ color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Remove
                </button>
              )}
            </div>

            {/* Editor */}
            <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderLeft: '3px solid var(--col-editing)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: 'var(--col-editing-dim)', border: '1px solid var(--col-editing-border)', color: 'var(--col-editing)' }}>
                  E
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Editor</div>
                  {editorAssignment?.user ? (
                    <div className="flex items-center gap-2 mt-1">
                      {editorAssignment.user.profile_picture && !editorAssignment.user.profile_picture.startsWith('http') ? (
                        <span className="text-lg">{editorAssignment.user.profile_picture}</span>
                      ) : (
                        <img 
                          src={getProfilePicture(editorAssignment.user)} 
                          alt={editorAssignment.user.discord_username || editorAssignment.user.name}
                          className="w-5 h-5 rounded-full"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(editorAssignment.user?.discord_username || editorAssignment.user?.name || 'User')}&background=6366f1&color=fff&size=128&bold=true`;
                          }}
                        />
                      )}
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {editorAssignment.user.discord_username || editorAssignment.user.name || 'Unknown'}
                      </span>
                      {editorAssignment.due_date && (
                        <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                          Due: {new Date(editorAssignment.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {editorAssignment.completed_at && (
                        <span className="text-xs ml-2" style={{ color: 'var(--green)' }}>✓ Completed</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Not assigned</span>
                  )}
                </div>
              </div>
              {isAdmin && editorAssignment && (
                <button
                  onClick={() => handleDeleteAssignment(editorAssignment.id, 'editor')}
                  className="px-3 py-1 text-sm rounded transition-colors"
                  style={{ color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Script Section */}
        <section className="mb-8" style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Script</h2>
            <div className="flex gap-2 items-center">
              {(scriptWriterUser?.id === user?.id || isAdmin || (user?.roles?.includes('script_writer') && !scriptWriterUser) || (short.script_content && (isAdmin || user?.roles?.includes('script_writer')))) && (
                <>
                  <label className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-2 transition-opacity ${
                    uploading === 'script' ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
                  }`} style={{ background: 'var(--gold)', color: 'var(--bg-base)' }}>
                    {uploading === 'script' ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      scriptPdf ? 'Replace Script PDF' : 'Upload Script PDF'
                    )}
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload('script', file);
                      }}
                      className="hidden"
                      disabled={uploading === 'script'}
                    />
                  </label>
                  <label className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-2 transition-opacity ${
                    uploading === 'audio' ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
                  }`} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}>
                    {uploading === 'audio' ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      audioFiles.length > 0 ? 'Replace Audio MP3' : 'Upload Audio MP3'
                    )}
                    <input
                      type="file"
                      accept="audio/mpeg,.mp3"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload('audio', file);
                      }}
                      className="hidden"
                      disabled={uploading === 'audio'}
                    />
                  </label>
                </>
              )}
              {scriptPdf && (
                <button
                  onClick={() => handleDownload(scriptPdf)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </button>
              )}
            </div>
          </div>
          {short.idea && (
            <div className="px-6 pt-4 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Idea</h3>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{short.idea}</p>
            </div>
          )}

          {/* Scene Editor - Main Script + Scenes */}
          <SceneEditor
            shortId={short.id}
            scriptContent={short.script_content || ''}
            onScriptContentChange={async (content) => {
              try {
                await shortsApi.update(short.id, { script_content: content });
                loadShort();
              } catch (error) {
                console.error('Failed to save script:', error);
              }
            }}
            isAdmin={isAdmin || false}
          />

          <div className="px-6 py-4">
            {scriptPdf && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Script PDF</h3>
                <div className="p-3 rounded-lg" style={{ background: 'var(--col-script-dim)', border: '1px solid var(--col-script-border)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" style={{ color: 'var(--col-script)' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{scriptPdf.file_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDownload(scriptPdf)}
                        className="px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                        style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
                        title="Download file"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                      {(isAdmin || scriptWriterUser?.id === user?.id) && (
                        <button
                          onClick={() => handleDeleteFile(scriptPdf.id)}
                          className="px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                          style={{ background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}
                          title="Delete file"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(scriptPdf.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {audioFiles.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Audio Files ({audioFiles.length})</h3>
                <div className="space-y-2">
                  {audioFiles.map((audio) => (
                    <div key={audio.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" style={{ color: 'var(--green)' }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{audio.file_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleDownload(audio)}
                          className="px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                          style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
                          title="Download file"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                        {(isAdmin || scriptWriterUser?.id === user?.id) && (
                          <button
                            onClick={() => handleDeleteFile(audio.id)}
                            className="px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                            style={{ background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}
                            title="Delete file"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(audio.uploaded_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!scriptPdf && !audioFiles.length && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No script or audio uploaded yet</p>
            )}
          </div>
        </section>

        {/* Clips Section */}
        <section className="mb-8" style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Clips ({clipsZip.length})</h2>
            {(clipperAssignment?.user_id === user?.id || isAdmin) && (
              <label className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-2 transition-opacity ${
                uploading === 'clips_zip' ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
              }`} style={{ background: 'var(--gold)', color: 'var(--bg-base)' }}>
                {uploading === 'clips_zip' ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  clipsZip.length > 0 ? 'Replace Zip of Clips' : 'Upload Zip of Clips'
                )}
                <input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload('clips_zip', file);
                  }}
                  className="hidden"
                  disabled={uploading === 'clips_zip'}
                />
              </label>
            )}
          </div>
          <div className="px-6 py-4">
            {clipsZip.length > 0 ? (
              <div className="space-y-2">
                {clipsZip.map((clip) => (
                  <div key={clip.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" style={{ color: 'var(--col-clips)' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{clip.file_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDownload(clip)}
                        className="px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                        style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
                        title="Download file"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                      {(isAdmin || clipperAssignment?.user_id === user?.id) && (
                        <button
                          onClick={() => handleDeleteFile(clip.id)}
                          className="px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                          style={{ background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}
                          title="Delete file"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(clip.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : uploading === 'clips_zip' ? (
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                <svg className="animate-spin h-5 w-5" style={{ color: 'var(--gold)' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Uploading clips zip file...</span>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No clips uploaded yet</p>
            )}
          </div>
        </section>

        {/* Final Video Section */}
        <section className="mb-8" style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Final Video ({finalVideos.length})</h2>
            <div className="flex gap-2">
              {(editorAssignment?.user_id === user?.id || isAdmin) && (
                <label className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-2 transition-opacity ${
                  uploading === 'final_video' ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
                }`} style={{ background: 'var(--gold)', color: 'var(--bg-base)' }}>
                  {uploading === 'final_video' ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    finalVideos.length > 0 ? 'Replace Final Video' : 'Upload Final Video'
                  )}
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('final_video', file);
                    }}
                    className="hidden"
                    disabled={uploading === 'final_video'}
                  />
                </label>
              )}
              {isAdmin && (short.status === 'editing' || short.status === 'editing_changes') && finalVideos.length > 0 && (
                <button
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: 'Mark Editing Complete',
                      message: 'Mark editing as complete? This will create payments for the clipper and editor.',
                      confirmText: 'Mark Complete',
                    });
                    if (confirmed) {
                      try {
                        await shortsApi.markEditingComplete(short.id);
                        await loadShort();
                        showToast('Editing marked as complete! Payments have been created.', 'success');
                      } catch (error: unknown) {
                        showAlert(getErrorMessage(error, 'Failed to mark editing complete'), { type: 'error' });
                      }
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ background: 'var(--green)', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Mark Editing Complete
                </button>
              )}
            </div>
          </div>
          <div className="px-6 py-4">
            {finalVideos.length > 0 ? (
              <div className="space-y-2">
                {finalVideos.map((video) => (
                  <div key={video.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" style={{ color: 'var(--col-editing)' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{video.file_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDownload(video)}
                        className="px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                        style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
                        title="Download file"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                      {(isAdmin || editorAssignment?.user_id === user?.id) && (
                        <button
                          onClick={() => handleDeleteFile(video.id)}
                          className="px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                          style={{ background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}
                          title="Delete file"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(video.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : uploading === 'final_video' ? (
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                <svg className="animate-spin h-5 w-5" style={{ color: 'var(--gold)' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>Uploading final video...</span>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No final video uploaded yet</p>
            )}
          </div>
        </section>

        {/* Settings Section (Admin only) */}
        {isAdmin && (
          <section className="mb-8" style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Settings</h2>
            </div>
            <div className="px-6 py-4">
              <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--red) 8%, var(--bg-elevated))', border: '1px solid color-mix(in srgb, var(--red) 30%, var(--border-default))' }}>
                <h3 className="text-base font-bold mb-2" style={{ color: 'var(--red)' }}>Danger Zone</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  Deleting this short will permanently remove it and all associated files, assignments, and payments. This action cannot be undone.
                </p>
                <button
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: 'Delete Short',
                      message: `Are you sure you want to delete "${short.title}"? This action cannot be undone and will delete all associated files, assignments, and payments.`,
                      variant: 'danger',
                      confirmText: 'Delete',
                    });
                    if (confirmed) {
                      try {
                        await shortsApi.delete(short.id);
                        showToast('Short deleted successfully', 'success');
                        navigate('/');
                      } catch (error: unknown) {
                        console.error('Failed to delete short:', error);
                        showAlert(getErrorMessage(error, 'Failed to delete short'), { type: 'error' });
                      }
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Delete Short
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
      <AlertComponent />
      <ConfirmComponent />
      <ToastComponent />
    </div>
  );
}
