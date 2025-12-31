import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { usersApi } from '../services/api';
import { User, UserRole } from '../../../shared/types';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const BottomGradient = () => {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
};

export default function UserManagement() {
  const { user } = useAuth();
  const { confirm, ConfirmComponent } = useConfirm();
  const { showToast, ToastComponent } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    roles: [] as UserRole[],
  });
  const [editUser, setEditUser] = useState({
    email: '',
    discord_username: '',
    paypal_email: '',
    roles: [] as UserRole[],
  });
  const [error, setError] = useState('');

  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';

  // Redirect non-admins immediately
  if (user && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [filterRole, isAdmin]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = filterRole !== 'all' ? { role: filterRole } : undefined;
      const data = await usersApi.getAll(params);
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (role: UserRole) => {
    setNewUser(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newUser.email || newUser.roles.length === 0) {
      setError('Email and at least one role are required');
      return;
    }

    setCreating(true);
    try {
      await usersApi.create(newUser);
      setShowAddModal(false);
      setNewUser({ email: '', roles: [] });
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUser({
      email: user.email,
      discord_username: user.discord_username || '',
      paypal_email: user.paypal_email || '',
      roles: user.roles || (user.role ? [user.role] : []),
    });
    setShowEditModal(true);
    setError('');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!editingUser) return;
    
    if (!editUser.email || editUser.roles.length === 0) {
      setError('Email and at least one role are required');
      return;
    }

    setUpdating(true);
    try {
      await usersApi.update(editingUser.id, {
        email: editUser.email,
        discord_username: editUser.discord_username || undefined,
        paypal_email: editUser.paypal_email || undefined,
        roles: editUser.roles,
      });
      setShowEditModal(false);
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    const confirmed = await confirm({
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    setDeletingUserId(userId);
    try {
      await usersApi.delete(userId);
      await loadUsers();
      showToast('User deleted successfully', 'success');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete user');
      showToast(err.response?.data?.error || err.message || 'Failed to delete user', 'error');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleEditRoleToggle = (role: UserRole) => {
    setEditUser(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const getProfilePicture = (user: User) => {
    if (user.profile_picture) {
      if (user.profile_picture.startsWith('http')) {
        return user.profile_picture;
      }
      return user.profile_picture; // emoji
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=6366f1&color=fff&size=128&bold=true`;
  };

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    script_writer: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    clipper: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    editor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">Users</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            {isAdmin ? 'Manage team members and their roles' : 'View team members'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="group/btn relative flex h-10 items-center justify-center space-x-2 rounded-md bg-gradient-to-br from-black to-neutral-600 px-6 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] transition-all hover:shadow-lg dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset]"
          >
            <span>Add User</span>
            <BottomGradient />
          </button>
        )}
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterRole('all')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            filterRole === 'all'
              ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          )}
        >
          All
        </button>
        {(['admin', 'script_writer', 'clipper', 'editor'] as UserRole[]).map((role) => (
          <button
            key={role}
            onClick={() => setFilterRole(role)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
              filterRole === role
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            )}
          >
            {role.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="text-center py-12 text-neutral-600 dark:text-neutral-400">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-neutral-600 dark:text-neutral-400">
          No users found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <div
              key={u.id}
              className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                {u.profile_picture && !u.profile_picture.startsWith('http') ? (
                  <div className="h-12 w-12 rounded-full flex items-center justify-center text-2xl bg-gray-100 dark:bg-neutral-800 flex-shrink-0">
                    {u.profile_picture}
                  </div>
                ) : (
                  <img
                    src={getProfilePicture(u)}
                    alt={u.name}
                    className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=random&size=128`;
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-neutral-900 dark:text-white truncate">{u.name}</h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">{u.email}</p>
                      {u.discord_username && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                          Discord: {u.discord_username}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleEditUser(u)}
                          className="p-1.5 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors dark:text-neutral-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20"
                          title="Edit user"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={deletingUserId === u.id || u.id === user?.id}
                          className="p-1.5 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:text-neutral-400 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                          title={u.id === user?.id ? "Cannot delete yourself" : "Delete user"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(u.roles || (u.role ? [u.role] : [])).map((role) => (
                      <span
                        key={role}
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          roleColors[role as UserRole] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                        )}
                      >
                        {role.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                  {!u.discord_username || !u.paypal_email ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      Profile incomplete
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-black rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
              Add New User
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-6">
              Create a user account. They'll need to complete their profile on first login.
            </p>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Roles *</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(['admin', 'script_writer', 'clipper', 'editor'] as UserRole[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleToggle(role)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize",
                        newUser.roles.includes(role)
                          ? roleColors[role] || "bg-gray-200 text-gray-800"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                      )}
                    >
                      {role.replace('_', ' ')}
                      {newUser.roles.includes(role) && ' ✓'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={creating}
                  className="group/btn relative flex-1 h-10 rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset]"
                >
                  {creating ? 'Creating...' : 'Create User →'}
                  <BottomGradient />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewUser({ email: '', roles: [] });
                    setError('');
                  }}
                  className="px-4 h-10 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-black rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
              Edit User
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-6">
              Update user information and roles.
            </p>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="user@example.com"
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-discord_username">Discord Username</Label>
                <Input
                  id="edit-discord_username"
                  type="text"
                  placeholder="username (optional)"
                  value={editUser.discord_username}
                  onChange={(e) => setEditUser({ ...editUser, discord_username: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-paypal_email">PayPal Email</Label>
                <Input
                  id="edit-paypal_email"
                  type="email"
                  placeholder="user@example.com (optional)"
                  value={editUser.paypal_email}
                  onChange={(e) => setEditUser({ ...editUser, paypal_email: e.target.value })}
                />
              </div>

              <div>
                <Label>Roles *</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(['admin', 'script_writer', 'clipper', 'editor'] as UserRole[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleEditRoleToggle(role)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize",
                        editUser.roles.includes(role)
                          ? roleColors[role] || "bg-gray-200 text-gray-800"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                      )}
                    >
                      {role.replace('_', ' ')}
                      {editUser.roles.includes(role) && ' ✓'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={updating}
                  className="group/btn relative flex-1 h-10 rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset]"
                >
                  {updating ? 'Updating...' : 'Update User →'}
                  <BottomGradient />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setEditUser({ email: '', discord_username: '', paypal_email: '', roles: [] });
                    setError('');
                  }}
                  className="px-4 h-10 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmComponent />
      <ToastComponent />
    </div>
  );
}
