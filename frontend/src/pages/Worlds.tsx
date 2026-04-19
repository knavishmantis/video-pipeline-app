import { useState, useEffect, useRef, useCallback } from 'react';
import { World } from '../../../shared/types';
import { worldsApi, filesApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function Worlds() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') ?? false;
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenshotUrls, setScreenshotUrls] = useState<Record<number, string>>({});
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadZip, setUploadZip] = useState<File | null>(null);
  const [uploadScreenshot, setUploadScreenshot] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const zipInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const loadingScreenshots = useRef<Set<number>>(new Set());

  useEffect(() => {
    loadWorlds();
  }, []);

  const loadWorlds = async () => {
    try {
      const data = await worldsApi.getAll();
      setWorlds(data);
    } catch (error) {
      console.error('Failed to load worlds:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadScreenshotUrl = useCallback((world: World) => {
    if (!world.screenshot_path) return;
    if (screenshotUrls[world.id] || loadingScreenshots.current.has(world.id)) return;
    loadingScreenshots.current.add(world.id);
    worldsApi.getScreenshotUrl(world.id)
      .then(url => setScreenshotUrls(prev => ({ ...prev, [world.id]: url })))
      .catch(() => {})
      .finally(() => loadingScreenshots.current.delete(world.id));
  }, [screenshotUrls]);

  const worldObserverRef = useCallback((world: World) => (node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadScreenshotUrl(world);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
  }, [loadScreenshotUrl]);

  const handleUpload = async () => {
    if (!uploadZip || !uploadName.trim()) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      setUploadStage('Uploading world ZIP...');
      const { upload_url: zipUploadUrl, bucket_path: zipBucketPath } = await worldsApi.getUploadUrl(
        uploadZip.name, uploadZip.size, uploadZip.type || 'application/zip', 'zip'
      );
      await filesApi.uploadDirectToGCS(zipUploadUrl, uploadZip, (p) => {
        setUploadProgress(Math.round((p.loaded / p.total) * (uploadScreenshot ? 70 : 90)));
      });

      let screenshotPath: string | undefined;
      if (uploadScreenshot) {
        setUploadStage('Uploading screenshot...');
        setUploadProgress(70);
        const { upload_url: ssUploadUrl, bucket_path: ssBucketPath } = await worldsApi.getUploadUrl(
          uploadScreenshot.name, uploadScreenshot.size, uploadScreenshot.type || 'image/png', 'screenshot'
        );
        await filesApi.uploadDirectToGCS(ssUploadUrl, uploadScreenshot, (p) => {
          setUploadProgress(70 + Math.round((p.loaded / p.total) * 20));
        });
        screenshotPath = ssBucketPath;
      }

      setUploadStage('Saving...');
      setUploadProgress(92);
      const newWorld = await worldsApi.create({
        name: uploadName.trim(),
        description: uploadDesc.trim() || undefined,
        bucket_path: zipBucketPath,
        screenshot_path: screenshotPath,
        file_size: uploadZip.size,
      });
      setUploadProgress(100);
      setWorlds(prev => [newWorld, ...prev]);
      if (screenshotPath) {
        worldsApi.getScreenshotUrl(newWorld.id)
          .then(url => setScreenshotUrls(prev => ({ ...prev, [newWorld.id]: url })))
          .catch(() => {});
      }
      setShowUpload(false);
      setUploadName('');
      setUploadDesc('');
      setUploadZip(null);
      setUploadScreenshot(null);
    } catch (error) {
      console.error('Failed to upload world:', error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStage('');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this world? Scenes using it will be unlinked.')) return;
    try {
      await worldsApi.delete(id);
      setWorlds(prev => prev.filter(w => w.id !== id));
    } catch (error) {
      console.error('Failed to delete world:', error);
    }
  };

  const handleEdit = (world: World) => {
    setEditingId(world.id);
    setEditName(world.name);
    setEditDesc(world.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      const updated = await worldsApi.update(editingId, { name: editName.trim(), description: editDesc.trim() || null });
      setWorlds(prev => prev.map(w => w.id === editingId ? { ...w, ...updated } : w));
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update world:', error);
    }
  };

  const handleDownload = async (world: World) => {
    try {
      const url = await worldsApi.getDownloadUrl(world.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = world.name.replace(/\s+/g, '-').toLowerCase() + '.zip';
      a.click();
    } catch (error) {
      console.error('Failed to get download URL:', error);
    }
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading worlds...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Worlds
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Worlds to be used in scenes, can be linked to scenes in shorts
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUpload(true)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            + Add World
          </button>
        )}
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
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Add World</h2>
              <button
                onClick={() => !uploading && setShowUpload(false)}
                style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '4px' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
                placeholder="e.g. Wayne Manor"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description (optional)</label>
              <textarea
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none resize-y"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', minHeight: '60px' }}
                placeholder="What this world is, where it's from..."
              />
            </div>

            {/* ZIP file */}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>World ZIP File</label>
              {uploadZip ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: 'color-mix(in srgb, var(--gold) 6%, var(--input-bg))', border: '1px solid var(--gold)', color: 'var(--text-primary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span className="truncate flex-1" style={{ fontWeight: 500 }}>{uploadZip.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatFileSize(uploadZip.size)}</span>
                  <button onClick={() => setUploadZip(null)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center px-4 py-6 rounded-xl text-sm cursor-pointer" style={{ background: 'var(--input-bg)', border: '2px dashed var(--border-default)', color: 'var(--text-muted)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '6px', opacity: 0.5 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <span style={{ fontWeight: 500 }}>Click to select ZIP file</span>
                  <span style={{ fontSize: '11px', marginTop: '2px' }}>ZIP, RAR</span>
                  <input ref={zipInputRef} type="file" accept=".zip,.rar,application/zip,application/x-rar-compressed" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadZip(f); }} />
                </label>
              )}
            </div>

            {/* Screenshot */}
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Screenshot (optional)</label>
              {uploadScreenshot ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: 'color-mix(in srgb, var(--gold) 6%, var(--input-bg))', border: '1px solid var(--gold)', color: 'var(--text-primary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span className="truncate flex-1" style={{ fontWeight: 500 }}>{uploadScreenshot.name}</span>
                  <button onClick={() => setUploadScreenshot(null)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center px-4 py-5 rounded-xl text-sm cursor-pointer" style={{ background: 'var(--input-bg)', border: '2px dashed var(--border-default)', color: 'var(--text-muted)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '6px', opacity: 0.5 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span style={{ fontWeight: 500 }}>Click to select screenshot</span>
                  <span style={{ fontSize: '11px', marginTop: '2px' }}>PNG, JPG, WEBP</span>
                  <input ref={screenshotInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadScreenshot(f); }} />
                </label>
              )}
            </div>

            {uploading && (
              <div className="mb-4">
                <div className="w-full rounded-full h-1.5" style={{ background: 'var(--border-default)' }}>
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%`, background: 'var(--gold)' }} />
                </div>
                <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--text-muted)' }}>{uploadStage} {uploadProgress}%</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowUpload(false)}
                disabled={uploading}
                className="px-4 py-2 text-sm font-semibold rounded-xl"
                style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadZip || !uploadName.trim()}
                className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-40"
                style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
              >{uploading ? 'Uploading...' : 'Add World'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Worlds grid */}
      {worlds.length === 0 ? (
        <div className="p-16 rounded-2xl text-center" style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-default)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', opacity: 0.4 }}>
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '4px' }}>No worlds yet</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Add Minecraft worlds to link them to scenes for clippers to download.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {worlds.map((world) => (
            <div
              key={world.id}
              ref={worldObserverRef(world)}
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
            >
              {/* Screenshot area */}
              <div style={{ height: '160px', background: '#111', position: 'relative', overflow: 'hidden' }}>
                {screenshotUrls[world.id] ? (
                  <img
                    src={screenshotUrls[world.id]}
                    alt={world.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : world.screenshot_path ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                    Loading...
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: 0.3 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No screenshot</span>
                  </div>
                )}
              </div>

              {/* Info row */}
              <div style={{ padding: '12px 14px' }}>
                {editingId === world.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="px-2 py-1 rounded-lg text-sm font-semibold focus:outline-none"
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--gold)', color: 'var(--text-primary)' }}
                      autoFocus
                    />
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="px-2 py-1 rounded-lg text-xs focus:outline-none resize-y"
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', minHeight: '48px' }}
                      placeholder="Description..."
                    />
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs font-semibold rounded-lg" style={{ background: 'var(--border-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-default)', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={handleSaveEdit} className="px-3 py-1 text-xs font-semibold rounded-lg" style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{world.name}</h3>
                    {world.description && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: '1.4' }}>{world.description}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: world.description ? '0' : '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          onClick={() => handleDownload(world)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                          style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          Download
                        </button>
                        {world.file_size && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatFileSize(world.file_size)}</span>
                        )}
                      </div>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => handleEdit(world)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                            style={{ color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                          >Edit</button>
                          <button
                            onClick={() => handleDelete(world.id)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                            style={{ color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--red)'; (e.currentTarget as HTMLElement).style.color = 'var(--red)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                          >Delete</button>
                        </div>
                      )}
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
