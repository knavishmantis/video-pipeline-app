import { useState, useEffect, useRef } from 'react';
import { PresetClip } from '../../../shared/types';
import { presetClipsApi, filesApi } from '../services/api';

export default function Presets() {
  const [clips, setClips] = useState<PresetClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoUrls, setVideoUrls] = useState<Record<number, string>>({});
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [durations, setDurations] = useState<Record<number, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadClips();
  }, []);

  const loadClips = async () => {
    try {
      const data = await presetClipsApi.getAll();
      setClips(data);
      for (const clip of data) {
        presetClipsApi.getVideoUrl(clip.id)
          .then(url => setVideoUrls(prev => ({ ...prev, [clip.id]: url })))
          .catch(() => {});
      }
    } catch (error) {
      console.error('Failed to load preset clips:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const { upload_url, bucket_path } = await presetClipsApi.getUploadUrl(
        uploadFile.name,
        uploadFile.size,
        uploadFile.type
      );
      await filesApi.uploadDirectToGCS(upload_url, uploadFile, (p) => {
        setUploadProgress(Math.round((p.loaded / p.total) * 100));
      });
      const newClip = await presetClipsApi.create({
        name: uploadName.trim(),
        description: uploadDesc.trim() || undefined,
        bucket_path,
        mime_type: uploadFile.type,
        file_size: uploadFile.size,
      });
      setClips(prev => [newClip, ...prev]);
      presetClipsApi.getVideoUrl(newClip.id)
        .then(url => setVideoUrls(prev => ({ ...prev, [newClip.id]: url })))
        .catch(() => {});
      setShowUpload(false);
      setUploadName('');
      setUploadDesc('');
      setUploadFile(null);
    } catch (error) {
      console.error('Failed to upload preset clip:', error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this preset clip? Scenes using it will be unlinked.')) return;
    try {
      await presetClipsApi.delete(id);
      setClips(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete preset clip:', error);
    }
  };

  const handleEdit = (clip: PresetClip) => {
    setEditingId(clip.id);
    setEditName(clip.name);
    setEditDesc(clip.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      const updated = await presetClipsApi.update(editingId, {
        name: editName.trim(),
        description: editDesc.trim() || null,
      });
      setClips(prev => prev.map(c => c.id === editingId ? { ...c, ...updated } : c));
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update preset clip:', error);
    }
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading presets...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Preset Clips
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {clips.length} reusable clip{clips.length !== 1 ? 's' : ''} — link to scenes so clippers know what's already recorded
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: 'var(--gold)',
            color: 'var(--bg-base)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          + Upload Preset
        </button>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'var(--modal-overlay)' }}
          onClick={() => !uploading && setShowUpload(false)}
        >
          <div
            className="max-w-md w-full mx-4 p-6 rounded-2xl"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', boxShadow: 'var(--modal-shadow)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Upload Preset Clip</h2>
              <button
                onClick={() => !uploading && setShowUpload(false)}
                style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '4px' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--gold-dim)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--input-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                placeholder="e.g. Talking to camera green screen"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description (optional)</label>
              <textarea
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none resize-y"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', minHeight: '60px' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--gold-dim)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--input-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                placeholder="What this clip shows..."
              />
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Video File</label>
              {uploadFile ? (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                  style={{ background: 'color-mix(in srgb, var(--gold) 6%, var(--input-bg))', border: '1px solid var(--gold)', color: 'var(--text-primary)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <span className="truncate flex-1" style={{ fontWeight: 500 }}>{uploadFile.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatFileSize(uploadFile.size)}</span>
                  <button
                    onClick={() => setUploadFile(null)}
                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
                  >
                    x
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center px-4 py-6 rounded-xl text-sm cursor-pointer transition-all"
                  style={{ background: 'var(--input-bg)', border: '2px dashed var(--border-default)', color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--gold) 4%, var(--input-bg))'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.background = 'var(--input-bg)'; }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '6px', opacity: 0.5 }}>
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <span style={{ fontWeight: 500 }}>Click to select video file</span>
                  <span style={{ fontSize: '11px', marginTop: '2px' }}>MP4, MOV, WebM</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setUploadFile(file);
                    }}
                  />
                </label>
              )}
            </div>

            {uploading && (
              <div className="mb-4">
                <div className="w-full rounded-full h-1.5" style={{ background: 'var(--border-default)' }}>
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%`, background: 'var(--gold)' }} />
                </div>
                <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--text-muted)' }}>Uploading... {uploadProgress}%</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowUpload(false)}
                disabled={uploading}
                className="px-4 py-2 text-sm font-semibold rounded-xl transition-all"
                style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadName.trim()}
                className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-40 transition-all"
                style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clips list */}
      {clips.length === 0 ? (
        <div className="p-16 rounded-2xl text-center" style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-default)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', opacity: 0.4 }}>
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '4px' }}>No preset clips yet</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Upload reusable clips like "talking to camera" or "dog funeral" to link them to scenes.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {clips.map((clip, index) => (
            <div
              key={clip.id}
              className="rounded-xl overflow-hidden transition-all"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'row',
                minHeight: '220px',
              }}
            >
              {/* Number badge */}
              <div style={{
                width: '56px',
                minWidth: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'color-mix(in srgb, var(--gold) 8%, transparent)',
                borderRight: '1px solid var(--border-default)',
              }}>
                <span style={{
                  fontSize: '20px',
                  fontWeight: '800',
                  color: 'var(--gold)',
                  letterSpacing: '-0.02em',
                }}>
                  {index + 1}
                </span>
              </div>

              {/* Video */}
              <div style={{
                width: '360px',
                minWidth: '360px',
                height: '220px',
                background: '#000',
                overflow: 'hidden',
              }}>
                {videoUrls[clip.id] ? (
                  <video
                    src={videoUrls[clip.id]}
                    controls
                    preload="auto"
                    onLoadedMetadata={(e) => { const d = (e.target as HTMLVideoElement).duration; if (d && isFinite(d)) setDurations(prev => ({ ...prev, [clip.id]: d })); }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Loading...</div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {editingId === clip.id ? (
                  <div>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg text-sm font-semibold mb-2 focus:outline-none"
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--gold)', color: 'var(--text-primary)' }}
                      autoFocus
                    />
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg text-sm mb-3 focus:outline-none resize-y"
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', minHeight: '36px' }}
                      placeholder="Description..."
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1 text-xs font-semibold rounded-lg transition-all"
                        style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-xs font-semibold rounded-lg"
                        style={{ background: 'var(--border-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
                          {clip.name}
                        </h3>
                        {clip.description && (
                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>{clip.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0" style={{ marginTop: '2px' }}>
                        <button
                          onClick={() => handleEdit(clip)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                          style={{ color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            const url = videoUrls[clip.id];
                            if (url) {
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = clip.name.replace(/\s+/g, '-').toLowerCase() + '.mp4';
                              a.click();
                            }
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                          style={{ color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDelete(clip.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                          style={{ color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--red)'; (e.currentTarget as HTMLElement).style.color = 'var(--red)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-2" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {durations[clip.id] && <span>{Math.round(durations[clip.id])}s</span>}
                      {clip.file_size && <span>{formatFileSize(clip.file_size)}</span>}
                      {clip.mime_type && <span>{clip.mime_type.split('/')[1]?.toUpperCase()}</span>}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
