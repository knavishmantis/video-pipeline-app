import { useAuth } from '../contexts/AuthContext';
import { IconClipboard, IconVideo, IconEdit, IconCurrencyDollar } from '@tabler/icons-react';

export default function Guide() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';
  const isClipper = user?.roles?.includes('clipper') || user?.role === 'clipper';
  const isEditor = user?.roles?.includes('editor') || user?.role === 'editor';

  return (
    <div style={{ padding: '0 4px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
          Reference
        </p>
        <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
          User Guide
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Everything you need to know about using the Video Pipeline App
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Overview Section */}
        <section style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', padding: '20px 24px', boxShadow: 'var(--card-shadow)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '10px', letterSpacing: '-0.02em' }}>Overview</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '14px' }}>
            The Video Pipeline App helps manage the production workflow for YouTube Shorts.
            Each video goes through several stages: Idea → Script → Clips → Editing → Ready to Upload.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginTop: '8px' }}>
            <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <IconClipboard className="h-4 w-4" style={{ color: 'var(--col-script)', flexShrink: 0 }} />
                <h3 style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>Dashboard</h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.55', margin: 0 }}>
                View all shorts organized by stage. Drag and drop to move shorts between stages.
              </p>
            </div>
            <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <IconCurrencyDollar className="h-4 w-4" style={{ color: 'var(--col-uploaded)', flexShrink: 0 }} />
                <h3 style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>Payments</h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.55', margin: 0 }}>
                Track your earnings, view payment history, and see your current rates.
              </p>
            </div>
          </div>
        </section>

        {/* Clippers Section */}
        {(isClipper || isAdmin) && (
          <section style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', borderLeft: '3px solid var(--col-clips)', padding: '20px 24px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--col-clips-dim)', border: '1px solid var(--col-clips-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconVideo className="h-5 w-5" style={{ color: 'var(--col-clips)' }} />
              </div>
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>For Clippers</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.01em' }}>Finding Your Assignments</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '6px' }}>
                  You'll typically know in advance which shorts are assigned to you from communication in Discord.
                  Once assigned, you can view the shorts assigned to you in the <strong style={{ color: 'var(--text-primary)' }}>"Clips"</strong> column on the Dashboard.
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65' }}>
                  If a set of clips needs revisions, it will appear in the <strong style={{ color: 'var(--text-primary)' }}>"Clip Changes"</strong> column for you to review and update.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.01em' }}>Your Workflow</h3>
                <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    'Click on a short card in the "Clips" column to view details',
                    'Download the Script PDF and Audio MP3 from the short detail page',
                    'Create clips according to the script',
                    'Upload your clips as a ZIP file using the "Upload Clips ZIP" button',
                    'Once uploaded, the short will move to "Clip Changes" for review',
                  ].map((step, i) => (
                    <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.55' }}>{step}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.01em' }}>Payment Tracking</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65' }}>
                  When your clips are reviewed and marked as complete, the payment will be automatically tracked in the <strong style={{ color: 'var(--text-primary)' }}>Payments</strong> view.
                  You can check the Payments section at any time to see what you're owed and your payment history.
                </p>
              </div>

              <div style={{ padding: '14px 16px', background: 'var(--col-clips-dim)', border: '1px solid var(--col-clips-border)', borderRadius: '8px' }}>
                <p style={{ fontSize: '12px', color: 'var(--col-clips)', fontWeight: '700', marginBottom: '4px' }}>
                  ⚠️ Important: Reference Guides
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.55', margin: 0 }}>
                  The <strong style={{ color: 'var(--text-primary)' }}>Flashback Reference</strong> (available in the sidebar) contains the complete guide on how clips should be styled and formatted.
                  This is your primary reference document — make sure to check it regularly when creating clips!
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Editors Section */}
        {(isEditor || isAdmin) && (
          <section style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', borderLeft: '3px solid var(--col-editing)', padding: '20px 24px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--col-editing-dim)', border: '1px solid var(--col-editing-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconEdit className="h-5 w-5" style={{ color: 'var(--col-editing)' }} />
              </div>
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>For Editors</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.01em' }}>Finding Your Assignments</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '6px' }}>
                  You'll typically know in advance which shorts are assigned to you from communication in Discord.
                  Once assigned, you can view the shorts assigned to you in the <strong style={{ color: 'var(--text-primary)' }}>"Editing"</strong> column on the Dashboard.
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65' }}>
                  If an edited video needs revisions, it will appear in the <strong style={{ color: 'var(--text-primary)' }}>"Editing Changes"</strong> column for you to review and update.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.01em' }}>Your Workflow</h3>
                <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    'Click on a short card in the "Editing" column to view details',
                    'Download the Clips ZIP from the short detail page',
                    'Edit the clips together according to the script',
                    'Upload your final edited video using the "Upload Final Video" button',
                    'Once uploaded, mark editing as complete to create payments',
                  ].map((step, i) => (
                    <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.55' }}>{step}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.01em' }}>Payment Tracking</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65' }}>
                  When you mark editing as complete, the payment will be automatically tracked in the <strong style={{ color: 'var(--text-primary)' }}>Payments</strong> view.
                  You can check the Payments section at any time to see what you're owed and your payment history.
                </p>
              </div>

              <div style={{ padding: '14px 16px', background: 'var(--col-editing-dim)', border: '1px solid var(--col-editing-border)', borderRadius: '8px' }}>
                <p style={{ fontSize: '12px', color: 'var(--col-editing)', fontWeight: '700', marginBottom: '4px' }}>
                  ⚠️ Important: Editing Reference Guide
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.55', margin: 0 }}>
                  The <strong style={{ color: 'var(--text-primary)' }}>Editing Reference</strong> (available in the sidebar) contains the complete guide on how videos should be edited and formatted.
                  This is your primary reference document — make sure to check it regularly when editing videos!
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
