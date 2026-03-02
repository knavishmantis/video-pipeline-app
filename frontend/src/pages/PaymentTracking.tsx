import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../hooks/useAlert';
import { useToast } from '../hooks/useToast';
import { paymentsApi, usersApi } from '../services/api';
import { Payment, User, UserRate } from '../../../shared/types';
import { getErrorMessage } from '../utils/errorHandler';

export default function PaymentTracking() {
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userRates, setUserRates] = useState<UserRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUserId, setFilterUserId] = useState<number | null>(null);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
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
        
        const [paymentsData, usersData] = await Promise.all([
          showPendingOnly 
            ? paymentsApi.getPending(Object.keys(params).length > 0 ? params : undefined)
            : paymentsApi.getAll(Object.keys(params).length > 0 ? params : undefined),
          usersApi.getAll(),
        ]);
        setPayments(paymentsData);
        setUsers(usersData);
      } else {
        const params: Record<string, string | number> = {};
        if (statsMonth) params.month = statsMonth;
        if (statsYear) params.year = statsYear;
        
        const paymentsData = await paymentsApi.getMyPayments(Object.keys(params).length > 0 ? params : undefined);
        setPayments(paymentsData);
        
        // Load user rates for non-admin users
        if (user) {
          try {
            const rates = await usersApi.getUserRates(user.id);
            setUserRates(rates);
          } catch (error) {
            console.error('Failed to load user rates:', error);
          }
        }
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


  const totalOwed = getTotalOwed();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 4px' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
            Finance
          </p>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            {isAdmin ? 'Payment Tracking' : 'My Payments'}
          </h1>
        </div>

        {/* Payment Statistics Section */}
        {stats && (
          <section className="mb-8" style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-default)' }}>
              <h2 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>
                {isAdmin ? 'Payment Statistics' : 'Your Statistics'}
              </h2>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {isAdmin ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Total Paid</div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--gold)', letterSpacing: '-0.03em' }}>
                      ${Number(stats.total_paid || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Total Pending</div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                      ${Number(stats.total_pending || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Videos Posted</div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                      {stats.videos_posted || 0}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Total Earned</div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--gold)', letterSpacing: '-0.03em' }}>
                      ${Number(stats.total_earned || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Total Pending</div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                      ${Number(stats.total_pending || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Clip Sets Completed</div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                      {stats.clips_completed || 0}
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Edits Completed</div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
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
          <section className="mb-8" style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-default)' }}>
              <h2 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>Your Rates</h2>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {userRates.map((rate) => (
                <div key={rate.role} style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'capitalize' }}>{rate.role} Rate:</span>
                        <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--gold)', letterSpacing: '-0.02em' }}>${Number(rate.rate).toFixed(2)}</span>
                      </div>
                      {rate.rate_description && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{rate.rate_description}</p>
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
          <div className="mb-6" style={{ padding: '16px 20px', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: '8px' }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px' }}>
                  {isAdmin ? 'Total Pending Payments' : 'Total Owed to You'}
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Does not include view or subscriber based incentives
                </p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: 'var(--gold)', marginTop: '6px', letterSpacing: '-0.03em' }}>${Number(totalOwed).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex gap-4 items-center flex-wrap" style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px', boxShadow: 'var(--card-shadow)' }}>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>User</label>
              <select
                value={filterUserId || ''}
                onChange={(e) => setFilterUserId(e.target.value ? parseInt(e.target.value) : null)}
                style={{ padding: '5px 10px', border: '1px solid var(--border-default)', borderRadius: '6px', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
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
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Month</label>
            <select
              value={statsMonth || ''}
              onChange={(e) => setStatsMonth(e.target.value ? parseInt(e.target.value) : null)}
              style={{ padding: '5px 10px', border: '1px solid var(--border-default)', borderRadius: '6px', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
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
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Year</label>
            <select
              value={statsYear || ''}
              onChange={(e) => setStatsYear(e.target.value ? parseInt(e.target.value) : null)}
              style={{ padding: '5px 10px', border: '1px solid var(--border-default)', borderRadius: '6px', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
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
                style={{ accentColor: 'var(--gold)', width: '14px', height: '14px' }}
              />
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Pending Only</span>
            </label>
          )}
        </div>

        {/* Payments List */}
        <section style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-default)' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>
              {showPendingOnly ? 'Pending Payments' : 'All Payments'}
            </h2>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {payments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                No payments found
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {payments.map((payment) => {
                  const isPaid = payment.status === 'paid';
                  return (
                  <div
                    key={payment.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '8px',
                      border: isPaid
                        ? '1px solid var(--border-subtle)'
                        : '1px solid color-mix(in srgb, var(--gold) 35%, var(--border-default))',
                      background: isPaid
                        ? 'var(--bg-elevated)'
                        : 'color-mix(in srgb, var(--gold) 5%, var(--bg-surface))',
                      borderLeft: isPaid
                        ? '4px solid var(--border-subtle)'
                        : '4px solid var(--gold)',
                      opacity: isPaid ? 0.72 : 1,
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            color: isPaid ? 'var(--text-muted)' : 'var(--text-primary)',
                            letterSpacing: '-0.02em',
                            textDecoration: isPaid ? 'line-through' : 'none',
                          }}>
                            ${Number(payment.amount).toFixed(2)}
                          </span>
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: '20px',
                              fontSize: '10px',
                              fontWeight: '700',
                              letterSpacing: '0.08em',
                              background: isPaid
                                ? 'var(--bg-raised)'
                                : 'var(--gold)',
                              color: isPaid
                                ? 'var(--text-muted)'
                                : 'var(--bg-base)',
                              border: isPaid ? '1px solid var(--border-default)' : 'none',
                            }}
                          >
                            {isPaid ? 'PAID' : 'PENDING'}
                          </span>
                          {payment.role && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '600',
                                background: 'var(--bg-elevated)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-default)',
                                letterSpacing: '0.02em',
                              }}
                            >
                              {payment.role === 'clipper' ? 'Clipping' : payment.role === 'editor' ? 'Editing' : 'Incentive'}
                            </span>
                          )}
                        </div>
                        
                        {isAdmin && payment.user && (
                          <div className="flex items-center gap-2 mb-2">
                            {payment.user.profile_picture && !payment.user.profile_picture.startsWith('http') ? (
                              <span style={{ fontSize: '14px' }}>{payment.user.profile_picture}</span>
                            ) : (
                              <img
                                src={payment.user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(payment.user.discord_username || payment.user.name || 'User')}&background=B8922E&color=fff&size=32&bold=true`}
                                alt={payment.user.discord_username || payment.user.name}
                                style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid var(--border-default)' }}
                              />
                            )}
                            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                              {payment.user.discord_username || payment.user.name || payment.user.email}
                            </span>
                          </div>
                        )}
                        
                        {payment.short && (
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            Short: <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{payment.short.title}</span>
                          </p>
                        )}
                        
                        {payment.rate_description && (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontStyle: 'italic' }}>
                            {payment.rate_description}
                          </p>
                        )}
                        
                        {payment.completed_at && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Completed: {formatTimeAgo(payment.completed_at)} ({new Date(payment.completed_at).toLocaleDateString()})
                          </p>
                        )}
                        
                        {payment.admin_notes && isAdmin && (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                            Notes: {payment.admin_notes}
                          </p>
                        )}
                        
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                          Created: {new Date(payment.created_at).toLocaleDateString()}
                          {payment.paid_at && ` · Paid: ${new Date(payment.paid_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      
                      {isAdmin && payment.status === 'pending' && (
                        <button
                          onClick={() => setShowMarkPaidModal(payment)}
                          style={{
                            padding: '6px 14px',
                            background: 'var(--gold)',
                            color: 'var(--bg-surface)',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            marginLeft: '12px',
                            flexShrink: 0,
                            letterSpacing: '-0.01em',
                          }}
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
                          style={{ fontSize: '11px', color: 'var(--gold)', marginLeft: '8px', fontWeight: '600', textDecoration: 'none' }}
                        >
                          View PayPal ↗
                        </a>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Mark Paid Modal */}
        {showMarkPaidModal && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-overlay)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: 'var(--modal-shadow)', border: '1px solid var(--border-default)' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.02em' }}>Mark Payment as Paid</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Payment to: <strong style={{ color: 'var(--text-primary)' }}>{showMarkPaidModal.user?.discord_username || showMarkPaidModal.user?.name || 'Unknown'}</strong>
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Amount: <strong style={{ color: 'var(--gold)', fontSize: '14px' }}>${Number(showMarkPaidModal.amount).toFixed(2)}</strong>
                  </p>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    PayPal Transaction Link <span style={{ color: 'var(--gold)' }}>*</span>
                  </label>
                  <input
                    type="url"
                    value={paypalLink}
                    onChange={(e) => setPaypalLink(e.target.value)}
                    placeholder="https://www.paypal.com/activity/payment/..."
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Required for record keeping
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleMarkPaid}
                  style={{ flex: 1, padding: '9px 16px', background: 'var(--gold)', color: 'var(--bg-surface)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', letterSpacing: '-0.01em' }}
                >
                  Mark Paid
                </button>
                <button
                  onClick={() => { setShowMarkPaidModal(null); setPaypalLink(''); }}
                  style={{ padding: '9px 16px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Incentive Modal */}
        {showIncentiveModal && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-overlay)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: 'var(--modal-shadow)', border: '1px solid var(--border-default)' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.02em' }}>Add Incentive Payment</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    User <span style={{ color: 'var(--gold)' }}>*</span>
                  </label>
                  <select
                    value={incentiveForm.user_id}
                    onChange={(e) => setIncentiveForm({ ...incentiveForm, user_id: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="">Select user…</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.discord_username || u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Short (optional)
                  </label>
                  <input
                    type="number"
                    value={incentiveForm.short_id}
                    onChange={(e) => setIncentiveForm({ ...incentiveForm, short_id: e.target.value })}
                    placeholder="Short ID"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Amount ($) <span style={{ color: 'var(--gold)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={incentiveForm.amount}
                    onChange={(e) => setIncentiveForm({ ...incentiveForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Description (optional)
                  </label>
                  <textarea
                    value={incentiveForm.description}
                    onChange={(e) => setIncentiveForm({ ...incentiveForm, description: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical' }}
                    rows={3}
                    placeholder="Incentive description…"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAddIncentive}
                  style={{ flex: 1, padding: '9px 16px', background: 'var(--gold)', color: 'var(--bg-surface)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', letterSpacing: '-0.01em' }}
                >
                  Add Incentive
                </button>
                <button
                  onClick={() => { setShowIncentiveModal(false); setIncentiveForm({ user_id: '', short_id: '', amount: '', description: '' }); }}
                  style={{ padding: '9px 16px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
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
