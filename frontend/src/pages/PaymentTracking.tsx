import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../hooks/useAlert';
import { useToast } from '../hooks/useToast';
import { paymentsApi, usersApi, assignmentsApi } from '../services/api';
import { Payment, User, Assignment } from '../../../shared/types';
import { getErrorMessage } from '../utils/errorHandler';

export default function PaymentTracking() {
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUserId, setFilterUserId] = useState<number | null>(null);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [editingRate, setEditingRate] = useState<{ assignmentId: number; rate: number; description: string } | null>(null);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState<Payment | null>(null);
  const [paypalLink, setPaypalLink] = useState('');
  const [showIncentiveModal, setShowIncentiveModal] = useState(false);
  const [incentiveForm, setIncentiveForm] = useState({ user_id: '', short_id: '', amount: '', description: '' });
  const [stats, setStats] = useState<any>(null);
  const [statsMonth, setStatsMonth] = useState<number | null>(null);
  const [statsYear, setStatsYear] = useState<number | null>(null);

  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';

  useEffect(() => {
    loadData();
    loadStats();
  }, [filterUserId, showPendingOnly, statsMonth, statsYear]);

  useEffect(() => {
    loadStats();
  }, [statsMonth, statsYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const params: Record<string, string | number> = {};
        if (filterUserId) params.user_id = filterUserId;
        if (statsMonth) params.month = statsMonth;
        if (statsYear) params.year = statsYear;
        
        const [paymentsData, usersData, assignmentsData] = await Promise.all([
          showPendingOnly 
            ? paymentsApi.getPending(Object.keys(params).length > 0 ? params : undefined)
            : paymentsApi.getAll(Object.keys(params).length > 0 ? params : undefined),
          usersApi.getAll(),
          assignmentsApi.getAll(),
        ]);
        setPayments(paymentsData);
        setUsers(usersData);
        setAssignments(assignmentsData);
      } else {
        const params: Record<string, string | number> = {};
        if (statsMonth) params.month = statsMonth;
        if (statsYear) params.year = statsYear;
        
        const [paymentsData, assignmentsData] = await Promise.all([
          paymentsApi.getMyPayments(Object.keys(params).length > 0 ? params : undefined),
          assignmentsApi.getMyAssignments(),
        ]);
        setPayments(paymentsData);
        setAssignments(assignmentsData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!showMarkPaidModal || !paypalLink.trim()) {
      showAlert('Please enter PayPal transaction link', { type: 'warning' });
      return;
    }
    try {
      await paymentsApi.markPaid(showMarkPaidModal.id, paypalLink);
      setShowMarkPaidModal(null);
      setPaypalLink('');
      await loadData();
      await loadStats();
      showToast('Payment marked as paid successfully', 'success');
    } catch (error: unknown) {
      console.error('Failed to mark payment as paid:', error);
      showAlert(getErrorMessage(error, 'Failed to mark payment as paid'), { type: 'error' });
    }
  };

  const handleAddIncentive = async () => {
    if (!incentiveForm.user_id || !incentiveForm.amount) {
      showAlert('User and amount are required', { type: 'warning' });
      return;
    }
    try {
      await paymentsApi.addIncentive({
        user_id: parseInt(incentiveForm.user_id),
        short_id: incentiveForm.short_id ? parseInt(incentiveForm.short_id) : undefined,
        amount: parseFloat(incentiveForm.amount),
        description: incentiveForm.description || undefined,
      });
      setShowIncentiveModal(false);
      setIncentiveForm({ user_id: '', short_id: '', amount: '', description: '' });
      await loadData();
      await loadStats();
      showToast('Incentive payment added successfully', 'success');
    } catch (error: unknown) {
      console.error('Failed to add incentive:', error);
      showAlert(getErrorMessage(error, 'Failed to add incentive'), { type: 'error' });
    }
  };

  const loadStats = async () => {
    try {
      const params: any = {};
      if (statsMonth) params.month = statsMonth;
      if (statsYear) params.year = statsYear;
      if (!isAdmin && user) {
        params.user_id = user.id;
      }
      const data = await paymentsApi.getStats(params);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleUpdateRate = async () => {
    if (!editingRate || !isAdmin) return;
    try {
      await assignmentsApi.update(editingRate.assignmentId, {
        rate: editingRate.rate,
        rate_description: editingRate.description,
      });
      setEditingRate(null);
      await loadData();
      showToast('Rate updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update rate:', error);
      showAlert('Failed to update rate', { type: 'error' });
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const getTotalOwed = () => {
    return payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount), 0);
  };

  // Get user's current rates from assignments
  const getUserRates = () => {
    if (!user) return [];
    const userRoles = user.roles || (user.role ? [user.role] : []);
    const userAssignments = assignments.filter(a => a.user_id === user.id);
    
    const rates: { role: string; rate: number; description: string; assignmentId: number }[] = [];
    
    if (userRoles.includes('clipper')) {
      const clipperAssignments = userAssignments.filter(a => a.role === 'clipper' && a.rate);
      if (clipperAssignments.length > 0) {
        // Get the most recent rate
        const latest = clipperAssignments.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        rates.push({
          role: 'Clipper',
          rate: latest.rate!,
          description: latest.rate_description || '',
          assignmentId: latest.id,
        });
      }
    }
    
    if (userRoles.includes('editor')) {
      const editorAssignments = userAssignments.filter(a => a.role === 'editor' && a.rate);
      if (editorAssignments.length > 0) {
        const latest = editorAssignments.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        rates.push({
          role: 'Editor',
          rate: latest.rate!,
          description: latest.rate_description || '',
          assignmentId: latest.id,
        });
      }
    }
    
    return rates;
  };

  const userRates = getUserRates();
  const totalOwed = getTotalOwed();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-neutral-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            {isAdmin ? 'Payment Tracking' : 'My Payments'}
          </h1>
          <p className="text-neutral-600">
            {isAdmin 
              ? 'Track payments and manage rates for team members'
              : 'View your payment history and current rates'
            }
          </p>
        </div>

        {/* Payment Statistics Section */}
        {stats && (
          <section className="mb-8 bg-white rounded-xl border border-neutral-200 shadow-sm">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h2 className="text-xl font-semibold text-neutral-900">
                {isAdmin ? 'Payment Statistics' : 'Your Statistics'}
              </h2>
            </div>
            <div className="px-6 py-4">
              {isAdmin ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-sm font-medium text-green-700 mb-1">Total Paid</div>
                    <div className="text-2xl font-bold text-green-900">
                      ${Number(stats.total_paid || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-sm font-medium text-amber-700 mb-1">Total Pending</div>
                    <div className="text-2xl font-bold text-amber-900">
                      ${Number(stats.total_pending || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm font-medium text-blue-700 mb-1">Videos Posted</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {stats.videos_posted || 0}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-sm font-medium text-green-700 mb-1">Total Earned</div>
                    <div className="text-2xl font-bold text-green-900">
                      ${Number(stats.total_earned || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-sm font-medium text-amber-700 mb-1">Total Pending</div>
                    <div className="text-2xl font-bold text-amber-900">
                      ${Number(stats.total_pending || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-sm font-medium text-orange-700 mb-1">Clip Sets Completed</div>
                    <div className="text-2xl font-bold text-orange-900">
                      {stats.clips_completed || 0}
                    </div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-sm font-medium text-purple-700 mb-1">Edits Completed</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {stats.edits_completed || 0}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* User View - Rates Section */}
        {!isAdmin && userRates.length > 0 && (
          <section className="mb-8 bg-white rounded-xl border border-neutral-200 shadow-sm">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h2 className="text-xl font-semibold text-neutral-900">Your Rates</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              {userRates.map((rate) => (
                <div key={rate.role} className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-neutral-900">{rate.role} Rate:</span>
                        <span className="text-lg font-bold text-green-600">${Number(rate.rate).toFixed(2)}</span>
                      </div>
                      {rate.description && (
                        <p className="text-sm text-neutral-600 mt-1">{rate.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Total Owed Section */}
        {totalOwed > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-amber-900">
                  {isAdmin ? 'Total Pending Payments' : 'Total Owed to You'}
                </h3>
                <p className="text-xs text-amber-600 mt-0.5">
                  This number does not include view or subscriber based incentives if applicable
                </p>
                <p className="text-2xl font-bold text-amber-700 mt-1">${Number(totalOwed).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex gap-4 items-center flex-wrap">
          {isAdmin && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-neutral-700">Filter by User:</label>
              <select
                value={filterUserId || ''}
                onChange={(e) => setFilterUserId(e.target.value ? parseInt(e.target.value) : null)}
                className="px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Users</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.discord_username || u.name || u.email}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-700">Month:</label>
            <select
              value={statsMonth || ''}
              onChange={(e) => setStatsMonth(e.target.value ? parseInt(e.target.value) : null)}
              className="px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-700">Year:</label>
            <select
              value={statsYear || ''}
              onChange={(e) => setStatsYear(e.target.value ? parseInt(e.target.value) : null)}
              className="px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All</option>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPendingOnly}
                onChange={(e) => setShowPendingOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-neutral-700">Show Pending Only</span>
            </label>
          )}
        </div>

        {/* Payments List */}
        <section className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="text-xl font-semibold text-neutral-900">
              {showPendingOnly ? 'Pending Payments' : 'All Payments'}
            </h2>
          </div>
          <div className="px-6 py-4">
            {payments.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                No payments found
              </div>
            ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className={`p-4 rounded-lg border ${
                      payment.status === 'paid'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-neutral-50 border-neutral-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl font-bold text-neutral-900">
                            ${Number(payment.amount).toFixed(2)}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              payment.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {payment.status.toUpperCase()}
                          </span>
                          {payment.role && (
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                payment.role === 'clipper'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {payment.role === 'clipper' ? 'Clipping' : payment.role === 'editor' ? 'Editing' : 'Incentive'}
                            </span>
                          )}
                        </div>
                        
                        {isAdmin && payment.user && (
                          <div className="flex items-center gap-2 mb-2">
                            {payment.user.profile_picture && !payment.user.profile_picture.startsWith('http') ? (
                              <span className="text-lg">{payment.user.profile_picture}</span>
                            ) : (
                              <img
                                src={payment.user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(payment.user.discord_username || payment.user.name || 'User')}&background=6366f1&color=fff&size=32&bold=true`}
                                alt={payment.user.discord_username || payment.user.name}
                                className="w-6 h-6 rounded-full"
                              />
                            )}
                            <span className="text-sm font-medium text-neutral-700">
                              {payment.user.discord_username || payment.user.name || payment.user.email}
                            </span>
                          </div>
                        )}
                        
                        {payment.short && (
                          <p className="text-sm text-neutral-600 mb-1">
                            Short: <span className="font-medium">{payment.short.title}</span>
                          </p>
                        )}
                        
                        {payment.rate_description && (
                          <p className="text-sm text-neutral-600 mb-1 italic">
                            {payment.rate_description}
                          </p>
                        )}
                        
                        {payment.completed_at && (
                          <p className="text-xs text-neutral-500 mb-1">
                            Completed: {formatTimeAgo(payment.completed_at)} ({new Date(payment.completed_at).toLocaleDateString()})
                          </p>
                        )}
                        
                        {payment.admin_notes && isAdmin && (
                          <p className="text-sm text-neutral-600 mt-2 italic">
                            Notes: {payment.admin_notes}
                          </p>
                        )}
                        
                        <p className="text-xs text-neutral-500 mt-2">
                          Created: {new Date(payment.created_at).toLocaleDateString()}
                          {payment.paid_at && ` | Paid: ${new Date(payment.paid_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      
                      {isAdmin && payment.status === 'pending' && (
                        <button
                          onClick={() => setShowMarkPaidModal(payment)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium ml-4"
                        >
                          Mark Paid
                        </button>
                      )}
                      {payment.paypal_transaction_link && (isAdmin || (payment.status === 'paid' && payment.user_id === user?.id)) && (
                        <a
                          href={(() => {
                            const link = payment.paypal_transaction_link;
                            if (link.startsWith('http://') || link.startsWith('https://')) {
                              return link;
                            }
                            return `https://${link}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline ml-2"
                        >
                          View PayPal Transaction
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Admin: Set Rates Section */}
        {isAdmin && assignments.length > 0 && (
          <section className="mt-8 bg-white rounded-xl border border-neutral-200 shadow-sm">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h2 className="text-xl font-semibold text-neutral-900">Set Rates for Assignments</h2>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-3">
                {assignments
                  .filter(a => a.user_id && (a.role === 'clipper' || a.role === 'editor'))
                  .map((assignment) => {
                    const assignmentUser = users.find(u => u.id === assignment.user_id);
                    return (
                      <div key={assignment.id} className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-neutral-900">
                                {assignmentUser?.discord_username || assignmentUser?.name || 'Unknown'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                assignment.role === 'clipper' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {assignment.role}
                              </span>
                            </div>
                            {assignment.short && (
                              <p className="text-sm text-neutral-600 mb-2">
                                {assignment.short.title}
                              </p>
                            )}
                            <div className="flex items-center gap-4">
                              <div>
                                <span className="text-sm text-neutral-600">Current Rate: </span>
                                <span className="font-medium text-neutral-900">
                                  {assignment.rate ? `$${Number(assignment.rate).toFixed(2)}` : 'Not set'}
                                </span>
                              </div>
                              {assignment.rate_description && (
                                <span className="text-sm text-neutral-500 italic">
                                  {assignment.rate_description}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setEditingRate({
                              assignmentId: assignment.id,
                              rate: assignment.rate || 0,
                              description: assignment.rate_description || '',
                            })}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium ml-4"
                          >
                            Set Rate
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>
        )}

        {/* Edit Rate Modal */}
        {editingRate && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">Set Rate</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Rate ($)
                  </label>
                  <input
                    type="text"
                    value={editingRate.rate}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setEditingRate({ ...editingRate, rate: parseInt(value) || 0 });
                    }}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Description (e.g., "$25 base + $10 if 200k views")
                  </label>
                  <textarea
                    value={editingRate.description}
                    onChange={(e) => setEditingRate({ ...editingRate, description: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="$25 base + $10 if 200k views"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleUpdateRate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingRate(null)}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mark Paid Modal */}
        {showMarkPaidModal && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">Mark Payment as Paid</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-600 mb-2">
                    Payment to: {showMarkPaidModal.user?.discord_username || showMarkPaidModal.user?.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-neutral-600 mb-4">
                    Amount: ${Number(showMarkPaidModal.amount).toFixed(2)}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    PayPal Transaction Link <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={paypalLink}
                    onChange={(e) => setPaypalLink(e.target.value)}
                    placeholder="https://www.paypal.com/activity/payment/..."
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Required for record keeping
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleMarkPaid}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Mark Paid
                </button>
                <button
                  onClick={() => {
                    setShowMarkPaidModal(null);
                    setPaypalLink('');
                  }}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Incentive Modal */}
        {showIncentiveModal && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">Add Incentive Payment</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    User <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={incentiveForm.user_id}
                    onChange={(e) => setIncentiveForm({ ...incentiveForm, user_id: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select user...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.discord_username || u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Short (optional)
                  </label>
                  <input
                    type="number"
                    value={incentiveForm.short_id}
                    onChange={(e) => setIncentiveForm({ ...incentiveForm, short_id: e.target.value })}
                    placeholder="Short ID"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Amount ($) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={incentiveForm.amount}
                    onChange={(e) => setIncentiveForm({ ...incentiveForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={incentiveForm.description}
                    onChange={(e) => setIncentiveForm({ ...incentiveForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Incentive description..."
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAddIncentive}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Add Incentive
                </button>
                <button
                  onClick={() => {
                    setShowIncentiveModal(false);
                    setIncentiveForm({ user_id: '', short_id: '', amount: '', description: '' });
                  }}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <AlertComponent />
      <ToastComponent />
    </div>
  );
}
