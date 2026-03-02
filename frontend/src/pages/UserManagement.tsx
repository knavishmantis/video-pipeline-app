import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { usersApi } from '../services/api';
import { User, UserRole, UserRate } from '../../../shared/types';
import { getErrorMessage } from '../utils/errorHandler';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

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
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [ratesUser, setRatesUser] = useState<User | null>(null);
  const [userRates, setUserRates] = useState<UserRate[]>([]);
  const [editingRate, setEditingRate] = useState<{ role: 'clipper' | 'editor'; rate: number; description: string } | null>(null);
  const [savingRate, setSavingRate] = useState(false);

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
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create user'));
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update user'));
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
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, 'Failed to delete user');
      setError(errorMsg);
      showToast(errorMsg, 'error');
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

  const handleShowRates = async (user: User) => {
    setRatesUser(user);
    setShowRatesModal(true);
    setEditingRate(null);
    try {
      const rates = await usersApi.getUserRates(user.id);
      setUserRates(rates);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to load rates'), 'error');
    }
  };

  const handleEditRate = (role: 'clipper' | 'editor') => {
    const existingRate = userRates.find(r => r.role === role);
    setEditingRate({
      role,
      rate: existingRate?.rate || 0,
      description: existingRate?.rate_description || '',
    });
  };

  const handleSaveRate = async () => {
    if (!editingRate || !ratesUser) return;
    
    setSavingRate(true);
    try {
      await usersApi.setUserRate(ratesUser.id, editingRate);
      const rates = await usersApi.getUserRates(ratesUser.id);
      setUserRates(rates);
      setEditingRate(null);
      showToast('Rate saved successfully', 'success');
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to save rate'), 'error');
    } finally {
      setSavingRate(false);
    }
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

  const roleColors: Record<UserRole, { bg: string; color: string; border: string }> = {
    admin:         { bg: 'var(--gold-dim)',              color: 'var(--gold)',           border: 'var(--gold-border)' },
    script_writer: { bg: 'var(--col-script-dim)',        color: 'var(--col-script)',     border: 'var(--col-script-border)' },
    clipper:       { bg: 'var(--col-clips-dim)',         color: 'var(--col-clips)',      border: 'var(--col-clips-border)' },
    editor:        { bg: 'var(--col-editing-dim)',       color: 'var(--col-editing)',    border: 'var(--col-editing-border)' },
  };

  return (
    <div style={{ padding: '0 4px', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Admin</p>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>Users</h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '7px 16px', background: 'var(--gold)', color: 'var(--bg-surface)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', letterSpacing: '-0.01em' }}
          >
            + Add User
          </button>
        )}
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6 flex-wrap" style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px', boxShadow: 'var(--card-shadow)', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: '4px' }}>Role</span>
        {(['all', 'admin', 'script_writer', 'clipper', 'editor'] as (UserRole | 'all')[]).map((role) => {
          const isActive = filterRole === role;
          const rc = role !== 'all' ? roleColors[role as UserRole] : null;
          return (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              style={{
                padding: '5px 12px',
                background: isActive ? (rc ? rc.bg : 'var(--gold-dim)') : 'transparent',
                color: isActive ? (rc ? rc.color : 'var(--gold)') : 'var(--text-secondary)',
                border: isActive ? `1px solid ${rc ? rc.border : 'var(--gold-border)'}` : '1px solid var(--border-default)',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                letterSpacing: '-0.01em',
                textTransform: 'capitalize',
              }}
            >
              {role === 'all' ? 'All' : role.replace('_', ' ')}
            </button>
          );
        })}
      </div>

      {/* Users Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>Loading…</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
          No users found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <div
              key={u.id}
              style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', padding: '16px', boxShadow: 'var(--card-shadow)', transition: 'box-shadow 0.2s ease' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--card-hover-shadow)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--card-shadow)'; }}
            >
              <div className="flex items-start gap-4">
                {u.profile_picture && !u.profile_picture.startsWith('http') ? (
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', background: 'var(--bg-elevated)', flexShrink: 0, border: '1px solid var(--border-default)' }}>
                    {u.profile_picture}
                  </div>
                ) : (
                  <img
                    src={getProfilePicture(u)}
                    alt={u.name}
                    style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--border-default)' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=B8922E&color=fff&size=128&bold=true`;
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</h3>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>{u.email}</p>
                      {u.discord_username && (
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {u.discord_username}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 flex-shrink-0">
                        {(u.roles || (u.role ? [u.role] : [])).some(r => r === 'clipper' || r === 'editor') && (
                          <button
                            onClick={() => handleShowRates(u)}
                            style={{ padding: '5px', color: 'var(--text-muted)', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; (e.currentTarget as HTMLElement).style.background = 'var(--gold-dim)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            title="Manage rates"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleEditUser(u)}
                          style={{ padding: '5px', color: 'var(--text-muted)', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          title="Edit user"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={deletingUserId === u.id || u.id === user?.id}
                          style={{ padding: '5px', color: 'var(--text-muted)', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s', opacity: deletingUserId === u.id || u.id === user?.id ? 0.4 : 1 }}
                          onMouseEnter={(e) => { if (!(deletingUserId === u.id || u.id === user?.id)) { (e.currentTarget as HTMLElement).style.color = '#e05a4e'; (e.currentTarget as HTMLElement).style.background = 'rgba(224,90,78,0.1)'; } }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          title={u.id === user?.id ? "Cannot delete yourself" : "Delete user"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                    {(u.roles || (u.role ? [u.role] : [])).map((role) => {
                      const rc = roleColors[role as UserRole];
                      return (
                        <span
                          key={role}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '700',
                            letterSpacing: '0.04em',
                            textTransform: 'capitalize',
                            background: rc ? rc.bg : 'var(--bg-elevated)',
                            color: rc ? rc.color : 'var(--text-secondary)',
                            border: rc ? `1px solid ${rc.border}` : '1px solid var(--border-default)',
                          }}
                        >
                          {role.replace('_', ' ')}
                        </span>
                      );
                    })}
                  </div>
                  {!u.discord_username || !u.paypal_email ? (
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-overlay)' }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: 'var(--modal-shadow)', border: '1px solid var(--border-default)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
              Add New User
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Create a user account. They'll need to complete their profile on first login.
            </p>

            {error && (
              <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(224,90,78,0.1)', border: '1px solid rgba(224,90,78,0.3)', fontSize: '12px', color: '#e05a4e' }}>
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
                  {(['admin', 'script_writer', 'clipper', 'editor'] as UserRole[]).map((role) => {
                    const active = newUser.roles.includes(role);
                    const rc = roleColors[role];
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRoleToggle(role)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          textTransform: 'capitalize',
                          background: active ? rc.bg : 'var(--bg-elevated)',
                          color: active ? rc.color : 'var(--text-secondary)',
                          border: active ? `1px solid ${rc.border}` : '1px solid var(--border-default)',
                        }}
                      >
                        {role.replace('_', ' ')}{active && ' ✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={creating}
                  style={{ flex: 1, height: '38px', borderRadius: '8px', background: 'var(--gold)', color: 'var(--bg-surface)', border: 'none', fontSize: '13px', fontWeight: '700', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.5 : 1, letterSpacing: '-0.01em' }}
                >
                  {creating ? 'Creating…' : 'Create User →'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setNewUser({ email: '', roles: [] }); setError(''); }}
                  style={{ padding: '0 16px', height: '38px', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-overlay)' }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: 'var(--modal-shadow)', border: '1px solid var(--border-default)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
              Edit User
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Update user information and roles.
            </p>

            {error && (
              <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(224,90,78,0.1)', border: '1px solid rgba(224,90,78,0.3)', fontSize: '12px', color: '#e05a4e' }}>
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
                  {(['admin', 'script_writer', 'clipper', 'editor'] as UserRole[]).map((role) => {
                    const active = editUser.roles.includes(role);
                    const rc = roleColors[role];
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleEditRoleToggle(role)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          textTransform: 'capitalize',
                          background: active ? rc.bg : 'var(--bg-elevated)',
                          color: active ? rc.color : 'var(--text-secondary)',
                          border: active ? `1px solid ${rc.border}` : '1px solid var(--border-default)',
                        }}
                      >
                        {role.replace('_', ' ')}{active && ' ✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={updating}
                  style={{ flex: 1, height: '38px', borderRadius: '8px', background: 'var(--gold)', color: 'var(--bg-surface)', border: 'none', fontSize: '13px', fontWeight: '700', cursor: updating ? 'not-allowed' : 'pointer', opacity: updating ? 0.5 : 1, letterSpacing: '-0.01em' }}
                >
                  {updating ? 'Updating…' : 'Update User →'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setEditUser({ email: '', discord_username: '', paypal_email: '', roles: [] });
                    setError('');
                  }}
                  style={{ padding: '0 16px', height: '38px', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rates Modal */}
      {showRatesModal && ratesUser && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-overlay)' }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: 'var(--modal-shadow)', border: '1px solid var(--border-default)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
              Manage Rates — {ratesUser.name}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Set payment rates for this user. Rates apply to all unpaid jobs.
            </p>

            {!editingRate ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(['clipper', 'editor'] as const).map((role) => {
                  const rate = userRates.find(r => r.role === role);
                  const hasRole = (ratesUser.roles || (ratesUser.role ? [ratesUser.role] : [])).includes(role);
                  const rc = roleColors[role as UserRole];
                  
                  if (!hasRole) return null;
                  
                  return (
                    <div key={role} style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'capitalize', letterSpacing: '0.04em', padding: '2px 8px', borderRadius: '4px', background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                            {role}
                          </span>
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                          ${rate ? Number(rate.rate).toFixed(2) : '—'}
                        </div>
                        {rate?.rate_description && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {rate.rate_description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleEditRate(role)}
                        style={{ padding: '6px 14px', background: 'var(--gold)', color: 'var(--bg-surface)', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {rate ? 'Edit' : 'Set Rate'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <Label htmlFor="rate-amount">Rate ($)</Label>
                  <Input
                    id="rate-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingRate.rate}
                    onChange={(e) => setEditingRate({ ...editingRate, rate: parseFloat(e.target.value) || 0 })}
                    placeholder="30.00"
                  />
                </div>
                <div>
                  <Label htmlFor="rate-description">Description (optional)</Label>
                  <Input
                    id="rate-description"
                    type="text"
                    value={editingRate.description}
                    onChange={(e) => setEditingRate({ ...editingRate, description: e.target.value })}
                    placeholder="e.g., $25 base + $10 if 200k views"
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              {editingRate ? (
                <>
                  <button
                    onClick={handleSaveRate}
                    disabled={savingRate || editingRate.rate <= 0}
                    style={{ flex: 1, height: '38px', borderRadius: '8px', background: 'var(--gold)', color: 'var(--bg-surface)', border: 'none', fontSize: '13px', fontWeight: '700', cursor: (savingRate || editingRate.rate <= 0) ? 'not-allowed' : 'pointer', opacity: (savingRate || editingRate.rate <= 0) ? 0.5 : 1, letterSpacing: '-0.01em' }}
                  >
                    {savingRate ? 'Saving…' : 'Save Rate →'}
                  </button>
                  <button
                    onClick={() => setEditingRate(null)}
                    style={{ padding: '0 16px', height: '38px', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setShowRatesModal(false);
                    setRatesUser(null);
                    setUserRates([]);
                  }}
                  style={{ flex: 1, height: '38px', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmComponent />
      <ToastComponent />
    </div>
  );
}
