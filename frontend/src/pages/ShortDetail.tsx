import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { shortsApi, assignmentsApi, filesApi, usersApi } from '../services/api';
import { Short, Assignment, File, FileType, User } from '../../../shared/types';

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
  const [short, setShort] = useState<Short | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignRole, setAssignRole] = useState<'script_writer' | 'clipper' | 'editor'>('clipper');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignTimeRange, setAssignTimeRange] = useState('4');
  const [assignRate, setAssignRate] = useState('');
  const [assignRateDescription, setAssignRateDescription] = useState('');

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
    } catch (error) {
      console.error('Failed to load short:', error);
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
        await shortsApi.update(parseInt(id), { script_writer_id: parseInt(assignUserId) } as any);
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
      alert('Failed to create assignment');
    }
  };

  const handleDeleteAssignment = async (assignmentId: number, role: string) => {
    if (!confirm('Are you sure you want to remove this assignment?')) return;
    try {
      if (role === 'script_writer') {
        await shortsApi.update(parseInt(id!), { script_writer_id: null } as any);
      } else {
        await assignmentsApi.delete(assignmentId);
      }
      loadShort();
    } catch (error) {
      console.error('Failed to delete assignment:', error);
      alert('Failed to delete assignment');
    }
  };

  const handleFileUpload = async (fileType: FileType, file: File) => {
    if (!id) return;
    try {
      await filesApi.upload(parseInt(id), fileType, file);
      loadShort();
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file');
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    try {
      await shortsApi.update(parseInt(id), { status: status as any });
      loadShort();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-neutral-600">Loading...</div>
      </div>
    );
  }
  
  if (!short) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-neutral-600">Short not found</div>
      </div>
    );
  }

  const clips = short.files?.filter(f => f.file_type === 'clip') || [];
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
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link 
            to="/" 
            className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900 mb-4"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">{short.title}</h1>
              {short.description && (
                <p className="text-neutral-600">{short.description}</p>
              )}
            </div>
            <select
              value={short.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-4 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="idea">Idea</option>
              <option value="script">Script</option>
              <option value="clipping">Clipping</option>
              <option value="clip_changes">Clip Changes</option>
              <option value="editing">Editing</option>
              <option value="editing_changes">Editing Changes</option>
              <option value="ready_to_upload">Ready to Upload</option>
            </select>
          </div>
        </div>

        {/* Assignments Section */}
        <section className="mb-8 bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-neutral-900">Assignments</h2>
            {isAdmin && (
              <button
                onClick={() => setShowAssignForm(!showAssignForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                {showAssignForm ? 'Cancel' : '+ Assign'}
              </button>
            )}
          </div>

          {showAssignForm && (
            <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Role</label>
                  <select
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="script_writer">Script Writer</option>
                    <option value="clipper">Clipper</option>
                    <option value="editor">Editor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">User</label>
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Due Date</label>
                  <input
                    type="datetime-local"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {assignRole !== 'script_writer' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Time Range (hours)</label>
                    <input
                      type="number"
                      value={assignTimeRange}
                      onChange={(e) => setAssignTimeRange(e.target.value)}
                      min="1"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
              {assignRole !== 'script_writer' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Rate ($)</label>
                    <input
                      type="text"
                      value={assignRate}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setAssignRate(value);
                      }}
                      placeholder="40"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Rate Description</label>
                    <input
                      type="text"
                      value={assignRateDescription}
                      onChange={(e) => setAssignRateDescription(e.target.value)}
                      placeholder='e.g., "$25 base + $10 if 200k views"'
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
              <button
                onClick={handleAssign}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Assign
              </button>
            </div>
          )}

          <div className="px-6 py-4 space-y-3">
            {/* Script Writer */}
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                  S
                </div>
                <div>
                  <div className="font-medium text-neutral-900">Script Writer</div>
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
                      <span className="text-sm text-neutral-600">
                        {scriptWriterUser.discord_username || scriptWriterUser.name || 'Unknown'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-neutral-400">Not assigned</span>
                  )}
                </div>
              </div>
              {isAdmin && scriptWriterUser && (
                <button
                  onClick={() => handleDeleteAssignment(0, 'script_writer')}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Clipper */}
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold">
                  C
                </div>
                <div className="flex-1">
                  <div className="font-medium text-neutral-900">Clipper</div>
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
                      <span className="text-sm text-neutral-600">
                        {clipperAssignment.user.discord_username || clipperAssignment.user.name || 'Unknown'}
                      </span>
                      {clipperAssignment.due_date && (
                        <span className="text-xs text-neutral-500 ml-2">
                          Due: {new Date(clipperAssignment.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {clipperAssignment.completed_at && (
                        <span className="text-xs text-green-600 ml-2">✓ Completed</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-neutral-400">Not assigned</span>
                  )}
                </div>
              </div>
              {isAdmin && clipperAssignment && (
                <button
                  onClick={() => handleDeleteAssignment(clipperAssignment.id, 'clipper')}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Editor */}
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold">
                  E
                </div>
                <div className="flex-1">
                  <div className="font-medium text-neutral-900">Editor</div>
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
                      <span className="text-sm text-neutral-600">
                        {editorAssignment.user.discord_username || editorAssignment.user.name || 'Unknown'}
                      </span>
                      {editorAssignment.due_date && (
                        <span className="text-xs text-neutral-500 ml-2">
                          Due: {new Date(editorAssignment.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {editorAssignment.completed_at && (
                        <span className="text-xs text-green-600 ml-2">✓ Completed</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-neutral-400">Not assigned</span>
                  )}
                </div>
              </div>
              {isAdmin && editorAssignment && (
                <button
                  onClick={() => handleDeleteAssignment(editorAssignment.id, 'editor')}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Script Section */}
        <section className="mb-8 bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-neutral-900">Script</h2>
            {scriptPdf ? (
              <a
                href={scriptPdf.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                View PDF
              </a>
            ) : (
              <span className="text-sm text-neutral-400">No script uploaded</span>
            )}
          </div>
          {short.idea && (
            <div className="px-6 py-4">
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Idea</h3>
              <p className="text-neutral-600 whitespace-pre-wrap">{short.idea}</p>
            </div>
          )}
        </section>

        {/* Clips Section */}
        <section className="mb-8 bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-neutral-900">Clips ({clips.length})</h2>
            {(clipperAssignment?.user_id === user?.id || isAdmin) && (
              <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium cursor-pointer">
                Upload Clip
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload('clip', file);
                  }}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="px-6 py-4">
            {clips.length > 0 ? (
              <div className="space-y-2">
                {clips.map((clip) => (
                  <div key={clip.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                    <a 
                      href={clip.download_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {clip.file_name}
                    </a>
                    <span className="text-xs text-neutral-500">
                      {new Date(clip.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-neutral-400">No clips uploaded yet</p>
            )}
          </div>
        </section>

        {/* Final Video Section */}
        <section className="mb-8 bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-neutral-900">Final Video ({finalVideos.length})</h2>
            {(editorAssignment?.user_id === user?.id || isAdmin) && (
              <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium cursor-pointer">
                Upload Final Video
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload('final_video', file);
                  }}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="px-6 py-4">
            {finalVideos.length > 0 ? (
              <div className="space-y-2">
                {finalVideos.map((video) => (
                  <div key={video.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                    <a 
                      href={video.download_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {video.file_name}
                    </a>
                    <span className="text-xs text-neutral-500">
                      {new Date(video.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-neutral-400">No final video uploaded yet</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
