import { useState, useEffect } from 'react';
import { IconUserPlus, IconCircleCheck, IconClock, IconTrash, IconDownload, IconX, IconStarFilled } from '@tabler/icons-react';
import { samplesApi, scenesApi, SampleListItem, SampleDetail } from '../services/api';
import { Scene } from '../../../shared/types';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';

// Hardcoded sample configuration — every prospect sample uses the first N scenes of this short.
// Dev uses short #5 (test data); prod uses short #77.
const SAMPLE_SOURCE_SHORT_ID = import.meta.env.PROD ? 77 : 5;
const SAMPLE_SCENE_COUNT = 9;

export default function AdminSamples() {
  const [samples, setSamples] = useState<SampleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingSample, setViewingSample] = useState<SampleDetail | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { confirm, ConfirmComponent } = useConfirm();

  const loadSamples = async () => {
    setLoading(true);
    try {
      const data = await samplesApi.list();
      setSamples(data);
    } catch (err) {
      console.error('Failed to load samples', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSamples();
  }, []);

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Delete Sample',
      message: 'Delete this sample? The prospect will lose access.',
      variant: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await samplesApi.delete(id);
      showToast('Sample deleted', 'success');
      loadSamples();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const handleView = async (id: number) => {
    try {
      const detail = await samplesApi.get(id);
      setViewingSample(detail);
    } catch (err) {
      showToast('Failed to load sample', 'error');
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'var(--gold-dim)',
            border: '1px solid var(--gold-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <IconUserPlus className="h-5 w-5" style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin</p>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>Clipper Samples</h1>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '10px 16px',
            fontSize: '12px',
            fontWeight: 700,
            background: 'var(--gold)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <IconUserPlus size={14} /> Create Sample
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
      ) : samples.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '64px 24px',
          background: 'var(--bg-surface)',
          border: '1px dashed var(--border-default)',
          borderRadius: '12px',
          color: 'var(--text-muted)',
          fontSize: '13px',
        }}>
          No sample assignments yet. Create one to invite a prospect clipper.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {samples.map((s) => (
            <SampleRow
              key={s.id}
              sample={s}
              onDelete={() => handleDelete(s.id)}
              onView={() => handleView(s.id)}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateSampleModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadSamples(); }} />}
      {viewingSample && <SampleDetailModal sample={viewingSample} onClose={() => setViewingSample(null)} onChanged={loadSamples} />}

      <ToastComponent />
      <ConfirmComponent />
    </div>
  );
}

// ── List row ───────────────────────────────────────────────────────────────────
function SampleRow({ sample, onDelete, onView }: { sample: SampleListItem; onDelete: () => void; onView: () => void }) {
  const isPromoted = !!sample.promoted_at;
  const isSubmitted = !!sample.submitted_at;
  const isExpired = !isSubmitted && new Date(sample.expires_at).getTime() < Date.now();
  const daysRemaining = Math.max(0, Math.ceil((new Date(sample.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const statusColor = isPromoted
    ? 'var(--gold)'
    : isSubmitted
      ? 'var(--col-ready, rgb(60,140,90))'
      : isExpired
        ? 'var(--col-changes, rgb(180,80,80))'
        : 'var(--gold)';

  const statusBg = isPromoted
    ? 'var(--gold-dim)'
    : isSubmitted
      ? 'var(--col-ready-dim, rgba(80,180,120,0.1))'
      : isExpired
        ? 'var(--col-changes-dim, rgba(180,80,80,0.1))'
        : 'var(--gold-dim)';

  return (
    <div
      onClick={onView}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: 'var(--card-shadow)',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold-border)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{sample.prospect_name}</strong>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· {sample.prospect_email}</span>
          {sample.prospect_discord && (
            <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 600 }}>
              · @{sample.prospect_discord}
            </span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {sample.source_short_title} · {sample.scene_count} scenes · Created {new Date(sample.created_at).toLocaleDateString()}
        </div>
      </div>
      <div style={{
        padding: '4px 10px',
        borderRadius: '6px',
        background: statusBg,
        color: statusColor,
        border: `1px solid ${statusColor}40`,
        fontSize: '11px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}>
        {isPromoted ? (
          <><IconStarFilled size={11} /> Promoted</>
        ) : isSubmitted ? (
          <><IconCircleCheck size={12} /> Submitted</>
        ) : isExpired ? (
          <>Expired</>
        ) : (
          <><IconClock size={12} /> {daysRemaining}d left</>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete sample"
        style={{
          padding: '6px',
          background: 'transparent',
          border: '1px solid var(--border-default)',
          borderRadius: '6px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconTrash size={14} />
      </button>
    </div>
  );
}

// ── Create modal ───────────────────────────────────────────────────────────────
function CreateSampleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [previewScenes, setPreviewScenes] = useState<Scene[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Fetch the hardcoded source short's scenes on mount — take the first N
  useEffect(() => {
    scenesApi
      .getAll(SAMPLE_SOURCE_SHORT_ID)
      .then((scenes) => {
        const ordered = [...scenes].sort((a, b) => a.scene_order - b.scene_order).slice(0, SAMPLE_SCENE_COUNT);
        if (ordered.length < SAMPLE_SCENE_COUNT) {
          setPreviewError(`Source short #${SAMPLE_SOURCE_SHORT_ID} only has ${ordered.length} scenes (need ${SAMPLE_SCENE_COUNT}).`);
        }
        setPreviewScenes(ordered);
      })
      .catch((err) => {
        setPreviewError(err.response?.data?.error || `Could not load scenes from short #${SAMPLE_SOURCE_SHORT_ID}`);
      })
      .finally(() => setLoadingPreview(false));
  }, []);

  const handleCreate = async () => {
    setError(null);
    if (!prospectName.trim() || !prospectEmail.trim()) {
      setError('Name and email are required');
      return;
    }
    if (!previewScenes || previewScenes.length === 0) {
      setError('Sample scenes could not be loaded');
      return;
    }
    setSubmitting(true);
    try {
      await samplesApi.create({
        source_short_id: SAMPLE_SOURCE_SHORT_ID,
        prospect_name: prospectName.trim(),
        prospect_email: prospectEmail.trim().toLowerCase(),
        scene_ids: previewScenes.map((s) => s.id),
        expires_in_days: expiresInDays,
      });
      showToast('Sample created — share the link with your prospect', 'success');
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create sample');
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Create Clipper Sample">
      <div style={{ padding: '24px 28px', maxHeight: '70vh', overflowY: 'auto' }}>
        {error && (
          <div style={{
            marginBottom: '16px',
            padding: '10px 12px',
            background: 'rgba(180, 60, 60, 0.08)',
            border: '1px solid rgba(180, 60, 60, 0.22)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--text-primary)',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <Field label="Prospect name">
            <input
              type="text"
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
              style={inputStyle}
              placeholder="Jane Doe"
            />
          </Field>
          <Field label="Prospect Google email">
            <input
              type="email"
              value={prospectEmail}
              onChange={(e) => setProspectEmail(e.target.value)}
              style={inputStyle}
              placeholder="jane@gmail.com"
            />
          </Field>
        </div>

        <div style={{
          padding: '14px 16px',
          background: 'var(--gold-dim)',
          border: '1px solid var(--gold-border)',
          borderRadius: '8px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Sample assignment
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Every prospect gets the <strong>first {SAMPLE_SCENE_COUNT} scenes of short #{SAMPLE_SOURCE_SHORT_ID}</strong>. This is fixed for now — edit <code>SAMPLE_SOURCE_SHORT_ID</code> in <code>AdminSamples.tsx</code> to change.
          </div>
        </div>

        {loadingPreview ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
            Loading scene preview…
          </div>
        ) : previewError ? (
          <div style={{
            padding: '12px 14px',
            background: 'rgba(180, 60, 60, 0.08)',
            border: '1px solid rgba(180, 60, 60, 0.22)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            marginBottom: '16px',
          }}>
            {previewError}
          </div>
        ) : previewScenes && previewScenes.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Scene preview ({previewScenes.length})</label>
            <div style={{
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              maxHeight: '220px',
              overflowY: 'auto',
              background: 'var(--bg-base)',
            }}>
              {previewScenes.map((scene, idx) => (
                <div
                  key={scene.id}
                  style={{
                    padding: '9px 12px',
                    borderBottom: idx < previewScenes.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Scene {idx + 1}
                    {scene.link_group && <> · {scene.link_group}</>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '2px', lineHeight: '1.4' }}>
                    {scene.script_line || <em style={{ color: 'var(--text-muted)' }}>(no script line)</em>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Field label="Expires in (days)">
          <input
            type="number"
            min={1}
            max={60}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 14)}
            style={{ ...inputStyle, maxWidth: '120px' }}
          />
        </Field>
      </div>

      <div style={{
        padding: '16px 28px',
        borderTop: '1px solid var(--border-default)',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
      }}>
        <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
        <button onClick={handleCreate} disabled={submitting || !previewScenes || previewScenes.length === 0} style={primaryBtnStyle}>
          {submitting ? 'Creating…' : 'Create Sample'}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────
function SampleDetailModal({ sample, onClose, onChanged }: { sample: SampleDetail; onClose: () => void; onChanged: () => void }) {
  const { showToast } = useToast();
  const { confirm, ConfirmComponent } = useConfirm();
  const [promoting, setPromoting] = useState(false);
  const isPromoted = !!sample.promoted_at;

  const handlePromote = async () => {
    const ok = await confirm({
      title: 'Promote to Clipper',
      message: `Promote ${sample.prospect_name} to a real clipper? They'll be able to log in to the main app and be assigned to shorts.`,
      confirmText: 'Promote',
    });
    if (!ok) return;
    setPromoting(true);
    try {
      await samplesApi.promote(sample.id);
      showToast(`${sample.prospect_name} promoted to clipper`, 'success');
      onChanged();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to promote', 'error');
      setPromoting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={`Sample · ${sample.prospect_name}`}>
      <div style={{ padding: '24px 28px', maxHeight: '75vh', overflowY: 'auto' }}>
        {/* Prospect info */}
        <div style={{
          padding: '16px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          marginBottom: '18px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Prospect
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{sample.prospect_name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sample.prospect_email}</div>
          {(sample as any).prospect_discord && (
            <div style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: 600, marginTop: '4px' }}>
              Discord: @{(sample as any).prospect_discord}
            </div>
          )}
        </div>

        {/* Source short + scenes */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Source short · {(sample.scenes || []).length} scenes
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {(sample as any).source_short_title || 'Unknown'}
          </div>
          <div style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            maxHeight: '180px',
            overflowY: 'auto',
          }}>
            {(sample.scenes || []).map((scene: any, idx: number) => (
              <div key={scene.id} style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: '11px',
              }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>#{idx + 1}</span>
                <span style={{ color: 'var(--text-primary)', marginLeft: '8px' }}>
                  {scene.script_line || '(no script line)'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Submission */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Submission
          </div>
          {sample.submitted_at ? (
            <div style={{
              padding: '14px',
              background: 'var(--col-ready-dim, rgba(80,180,120,0.08))',
              border: '1px solid var(--col-ready-border, rgba(80,180,120,0.25))',
              borderRadius: '8px',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
                Submitted {new Date(sample.submitted_at).toLocaleString()}
              </div>
              {sample.submission_file_name && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  {sample.submission_file_name} · {sample.submission_file_size ? (sample.submission_file_size / (1024 * 1024)).toFixed(1) + ' MB' : ''}
                </div>
              )}
              {(sample as any).submission_download_url && (
                <a
                  href={(sample as any).submission_download_url}
                  download={sample.submission_file_name || 'sample-submission.zip'}
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: 'var(--gold)',
                    color: '#fff',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <IconDownload size={13} /> Download submission
                </a>
              )}
              {/* Promote to clipper */}
              <div style={{
                marginTop: '14px',
                paddingTop: '14px',
                borderTop: '1px solid var(--border-default)',
              }}>
                {isPromoted ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: 'var(--gold)',
                    fontWeight: 600,
                  }}>
                    <IconStarFilled size={14} />
                    Promoted to clipper on {new Date(sample.promoted_at!).toLocaleDateString()}
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Happy with their work? Promote them to a full clipper — they'll be able to log in to the main app and be assigned to shorts.
                    </div>
                    <button
                      onClick={handlePromote}
                      disabled={promoting}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 16px',
                        background: 'var(--gold)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: promoting ? 'default' : 'pointer',
                        opacity: promoting ? 0.6 : 1,
                      }}
                    >
                      <IconStarFilled size={13} /> {promoting ? 'Promoting…' : 'Promote to Clipper'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '14px',
              background: 'var(--bg-base)',
              border: '1px dashed var(--border-default)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}>
              Not yet submitted. Expires {new Date(sample.expires_at).toLocaleString()}.
            </div>
          )}
        </div>
      </div>
      <ConfirmComponent />
    </ModalShell>
  );
}

// ── Shared modal shell ─────────────────────────────────────────────────────────
function ModalShell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
          borderRadius: '14px',
          boxShadow: 'var(--modal-shadow)',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <IconX size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: '13px',
  color: 'var(--text-primary)',
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  borderRadius: '6px',
  outline: 'none',
  fontFamily: 'inherit',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px',
  fontSize: '12px',
  fontWeight: 700,
  background: 'var(--gold)',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 14px',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: '6px',
  cursor: 'pointer',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
