import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PresetClip } from '../../../shared/types';
import { presetClipsApi, filesApi } from '../services/api';

interface PresetGroup {
  label: string;
  baseName: string;
  nametag?: PresetClip;
  noNametag?: PresetClip;
  standalone?: PresetClip;
}

function groupPresets(clips: PresetClip[]): PresetGroup[] {
  const groups: Record<string, PresetGroup> = {};

  for (const clip of clips) {
    const nameLower = clip.name.toLowerCase();
    const isNametag = nameLower.includes('nametag') && !nameLower.includes('no nametag');
    const isNoNametag = nameLower.includes('no nametag');

    if (!isNametag && !isNoNametag) {
      // Standalone clip (e.g. "Strategy")
      const key = clip.name;
      groups[key] = { label: clip.label || '?', baseName: clip.name, standalone: clip };
      continue;
    }

    // Strip nametag suffixes to get base name
    const baseName = clip.name
      .replace(/\s*No\s+Nametag\s*/i, '')
      .replace(/\s*Nametag\s*/i, '')
      .trim();
    const key = baseName.toLowerCase();

    if (!groups[key]) {
      groups[key] = { label: clip.label || '?', baseName };
    }

    if (isNoNametag) {
      groups[key].noNametag = clip;
    } else {
      groups[key].nametag = clip;
    }
  }

  return Object.values(groups).sort((a, b) => {
    const aNum = parseInt(a.label) || 999;
    const bNum = parseInt(b.label) || 999;
    return aNum - bNum;
  });
}

export default function Presets() {
  const [clips, setClips] = useState<PresetClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});
  const [videoUrls, setVideoUrls] = useState<Record<number, string>>({});
  const [playingClip, setPlayingClip] = useState<number | null>(null);
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
  const loadingUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadClips();
  }, []);

  const loadClips = async () => {
    try {
      const data = await presetClipsApi.getAll();
      setClips(data);
    } catch (error) {
      console.error('Failed to load preset clips:', error);
    } finally {
      setLoading(false);
    }
  };

  const groups = useMemo(() => groupPresets(clips), [clips]);

  const loadThumbnailUrl = useCallback((clip: PresetClip) => {
    const key = `thumb-${clip.id}`;
    if (thumbnailUrls[clip.id] || loadingUrls.current.has(key)) return;
    if (!clip.thumbnail_path) {
      const vKey = `video-${clip.id}`;
      if (videoUrls[clip.id] || loadingUrls.current.has(vKey)) return;
      loadingUrls.current.add(vKey);
      presetClipsApi.getVideoUrl(clip.id)
        .then(url => setVideoUrls(prev => ({ ...prev, [clip.id]: url })))
        .catch(() => {})
        .finally(() => loadingUrls.current.delete(vKey));
      return;
    }
    loadingUrls.current.add(key);
    presetClipsApi.getThumbnailUrl(clip.id)
      .then(url => setThumbnailUrls(prev => ({ ...prev, [clip.id]: url })))
      .catch(() => {})
      .finally(() => loadingUrls.current.delete(key));
  }, [thumbnailUrls, videoUrls]);

  const groupObserverRef = useCallback((group: PresetGroup) => (node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (group.nametag) loadThumbnailUrl(group.nametag);
          if (group.noNametag) loadThumbnailUrl(group.noNametag);
          if (group.standalone) loadThumbnailUrl(group.standalone);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
  }, [loadThumbnailUrl]);

  const handlePlay = useCallback((clipId: number) => {
    setPlayingClip(clipId);
    if (videoUrls[clipId]) return;
    const key = `video-${clipId}`;
    if (loadingUrls.current.has(key)) return;
    loadingUrls.current.add(key);
    presetClipsApi.getVideoUrl(clipId)
      .then(url => setVideoUrls(prev => ({ ...prev, [clipId]: url })))
      .catch(() => {})
      .finally(() => loadingUrls.current.delete(key));
  }, [videoUrls]);

  const generateThumbnail = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      const url = URL.createObjectURL(file);
      video.src = url;
      video.onloadedmetadata = () => { video.currentTime = video.duration / 2; };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to generate thumbnail'));
        }, 'image/png');
      };
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load video')); };
    });
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const { upload_url, bucket_path } = await presetClipsApi.getUploadUrl(uploadFile.name, uploadFile.size, uploadFile.type);
      await filesApi.uploadDirectToGCS(upload_url, uploadFile, (p) => { setUploadProgress(Math.round((p.loaded / p.total) * 90)); });

      let thumbnailPath: string | undefined;
      try {
        const thumbBlob = await generateThumbnail(uploadFile);
        const thumbName = uploadFile.name.replace(/\.[^.]+$/, '') + '-thumb.png';
        const { upload_url: thumbUploadUrl, bucket_path: thumbBucketPath } = await presetClipsApi.getUploadUrl(thumbName, thumbBlob.size, 'image/png');
        await filesApi.uploadDirectToGCS(thumbUploadUrl, new File([thumbBlob], thumbName, { type: 'image/png' }), () => {});
        thumbnailPath = thumbBucketPath;
        setUploadProgress(95);
      } catch (thumbErr) {
        console.warn('Thumbnail generation failed:', thumbErr);
      }

      const newClip = await presetClipsApi.create({ name: uploadName.trim(), description: uploadDesc.trim() || undefined, bucket_path, thumbnail_path: thumbnailPath, mime_type: uploadFile.type, file_size: uploadFile.size });
      setUploadProgress(100);
      setClips(prev => [...prev, newClip]);
      if (thumbnailPath) {
        presetClipsApi.getThumbnailUrl(newClip.id).then(url => setThumbnailUrls(prev => ({ ...prev, [newClip.id]: url }))).catch(() => {});
      }
      setShowUpload(false);
      setUploadName('');
      setUploadDesc('');
      setUploadFile(null);
    } catch (error) {
      console.error('Failed to upload:', error);
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
      console.error('Failed to delete:', error);
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
      const updated = await presetClipsApi.update(editingId, { name: editName.trim(), description: editDesc.trim() || null });
      setClips(prev => prev.map(c => c.id === editingId ? { ...c, ...updated } : c));
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update:', error);
    }
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderPreview = (clip: PresetClip, height: number) => {
    const isPlaying = playingClip === clip.id;
    return (
      <div
        style={{
          height: `${height}px`,
          background: '#000',
          overflow: 'hidden',
          position: 'relative',
          cursor: isPlaying ? 'default' : 'pointer',
          borderRadius: '6px',
        }}
        onClick={() => { if (!isPlaying) handlePlay(clip.id); }}
      >
        {isPlaying && videoUrls[clip.id] ? (
          <video
            src={videoUrls[clip.id]}
            controls
            autoPlay
            preload="auto"
            onLoadedMetadata={(e) => { const d = (e.target as HTMLVideoElement).duration; if (d && isFinite(d)) setDurations(prev => ({ ...prev, [clip.id]: d })); }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : thumbnailUrls[clip.id] ? (
          <>
            <img src={thumbnailUrls[clip.id]} alt={clip.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="8 5 20 12 8 19" /></svg>
              </div>
            </div>
          </>
        ) : videoUrls[clip.id] ? (
          <>
            <video src={videoUrls[clip.id]} preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="8 5 20 12 8 19" /></svg>
              </div>
            </div>
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>Loading...</div>
        )}
      </div>
    );
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
            {groups.length} preset{groups.length !== 1 ? 's' : ''} ({clips.length} clips) — link to scenes so clippers know what's already recorded
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          + Upload Preset
        </button>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--modal-overlay)' }} onClick={() => !uploading && setShowUpload(false)}>
          <div className="max-w-md w-full mx-4 p-6 rounded-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', boxShadow: 'var(--modal-shadow)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Upload Preset Clip</h2>
              <button onClick={() => !uploading && setShowUpload(false)} style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '4px' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</label>
              <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }} placeholder="e.g. Room Nodding Nametag" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description (optional)</label>
              <textarea value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none resize-y" style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', minHeight: '60px' }} placeholder="What this clip shows..." />
            </div>
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Video File</label>
              {uploadFile ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: 'color-mix(in srgb, var(--gold) 6%, var(--input-bg))', border: '1px solid var(--gold)', color: 'var(--text-primary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                  <span className="truncate flex-1" style={{ fontWeight: 500 }}>{uploadFile.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatFileSize(uploadFile.size)}</span>
                  <button onClick={() => setUploadFile(null)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>x</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center px-4 py-6 rounded-xl text-sm cursor-pointer transition-all" style={{ background: 'var(--input-bg)', border: '2px dashed var(--border-default)', color: 'var(--text-muted)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '6px', opacity: 0.5 }}><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                  <span style={{ fontWeight: 500 }}>Click to select video file</span>
                  <span style={{ fontSize: '11px', marginTop: '2px' }}>MP4, MOV, WebM</span>
                  <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) setUploadFile(file); }} />
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
              <button onClick={() => setShowUpload(false)} disabled={uploading} className="px-4 py-2 text-sm font-semibold rounded-xl" style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadName.trim()} className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-40" style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}>{uploading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Grouped clips list */}
      {groups.length === 0 ? (
        <div className="p-16 rounded-2xl text-center" style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-default)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', opacity: 0.4 }}>
            <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '4px' }}>No preset clips yet</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Upload reusable clips to link them to scenes.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {groups.map((group) => {
            const isPaired = group.nametag && group.noNametag;
            const soloClip = group.standalone || group.nametag || group.noNametag;

            return (
              <div
                key={group.baseName}
                ref={groupObserverRef(group)}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--gold)', letterSpacing: '-0.02em', minWidth: '28px', textAlign: 'center' }}>
                    {group.label}
                  </span>
                  <div style={{ flex: 1 }}>
                    {editingId && (editingId === group.nametag?.id || editingId === group.noNametag?.id || editingId === group.standalone?.id) ? (
                      <div className="flex items-center gap-2">
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="px-2 py-1 rounded-lg text-sm font-semibold focus:outline-none" style={{ background: 'var(--bg-base)', border: '1px solid var(--gold)', color: 'var(--text-primary)', flex: 1 }} autoFocus />
                        <button onClick={handleSaveEdit} className="px-3 py-1 text-xs font-semibold rounded-lg" style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}>Save</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs font-semibold rounded-lg" style={{ background: 'var(--border-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-default)', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    ) : (
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                        {group.baseName}
                      </h3>
                    )}
                    {soloClip?.description && !editingId && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: '1.4' }}>{soloClip.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {soloClip && !editingId && (
                      <>
                        <button
                          onClick={() => handleEdit(soloClip)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                          style={{ color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                        >Edit</button>
                        <button
                          onClick={() => handleDelete(soloClip.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                          style={{ color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--red)'; (e.currentTarget as HTMLElement).style.color = 'var(--red)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                        >Delete</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Preview area */}
                {isPaired ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                    {/* Nametag column */}
                    <div style={{ borderRight: '1px solid var(--border-default)' }}>
                      <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nametag</span>
                        <button
                          onClick={async () => {
                            let url = videoUrls[group.nametag!.id];
                            if (!url) { try { url = await presetClipsApi.getVideoUrl(group.nametag!.id); } catch { return; } }
                            const a = document.createElement('a'); a.href = url; a.download = group.nametag!.name.replace(/\s+/g, '-').toLowerCase() + '.mp4'; a.click();
                          }}
                          className="text-xs font-semibold transition-all"
                          style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                        >Download</button>
                      </div>
                      <div style={{ padding: '0 8px 8px' }}>
                        {renderPreview(group.nametag!, 200)}
                      </div>
                      <div style={{ padding: '0 12px 8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                        {durations[group.nametag!.id] && <span>{Math.round(durations[group.nametag!.id])}s</span>}
                        {group.nametag!.file_size && <span>{formatFileSize(group.nametag!.file_size)}</span>}
                      </div>
                    </div>

                    {/* No Nametag column */}
                    <div>
                      <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>No Nametag</span>
                        <button
                          onClick={async () => {
                            let url = videoUrls[group.noNametag!.id];
                            if (!url) { try { url = await presetClipsApi.getVideoUrl(group.noNametag!.id); } catch { return; } }
                            const a = document.createElement('a'); a.href = url; a.download = group.noNametag!.name.replace(/\s+/g, '-').toLowerCase() + '.mp4'; a.click();
                          }}
                          className="text-xs font-semibold transition-all"
                          style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                        >Download</button>
                      </div>
                      <div style={{ padding: '0 8px 8px' }}>
                        {renderPreview(group.noNametag!, 200)}
                      </div>
                      <div style={{ padding: '0 12px 8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                        {durations[group.noNametag!.id] && <span>{Math.round(durations[group.noNametag!.id])}s</span>}
                        {group.noNametag!.file_size && <span>{formatFileSize(group.noNametag!.file_size)}</span>}
                      </div>
                    </div>
                  </div>
                ) : soloClip ? (
                  <div style={{ padding: '8px' }}>
                    <div style={{ maxWidth: '440px' }}>
                      {renderPreview(soloClip, 220)}
                    </div>
                    <div style={{ padding: '4px 4px 0', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                      {durations[soloClip.id] && <span>{Math.round(durations[soloClip.id])}s</span>}
                      {soloClip.file_size && <span>{formatFileSize(soloClip.file_size)}</span>}
                      <button
                        onClick={async () => {
                          let url = videoUrls[soloClip.id];
                          if (!url) { try { url = await presetClipsApi.getVideoUrl(soloClip.id); } catch { return; } }
                          const a = document.createElement('a'); a.href = url; a.download = soloClip.name.replace(/\s+/g, '-').toLowerCase() + '.mp4'; a.click();
                        }}
                        className="text-xs font-semibold transition-all"
                        style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                      >Download</button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
