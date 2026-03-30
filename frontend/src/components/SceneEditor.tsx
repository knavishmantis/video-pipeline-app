import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, SceneImage, CreateSceneInput, UpdateSceneInput, PresetClip, ShortStatus } from '../../../shared/types';
import { scenesApi, filesApi, presetClipsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface SceneEditorProps {
  shortId: number;
  shortStatus?: ShortStatus;
  scriptContent: string;
  onScriptContentChange: (content: string) => void;
  isAdmin: boolean;
}

export default function SceneEditor({ shortId, shortStatus, scriptContent, onScriptContentChange, isAdmin }: SceneEditorProps) {
  const { user } = useAuth();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [editingScript, setEditingScript] = useState(false);
  const [scriptDraft, setScriptDraft] = useState(scriptContent);
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  const [imageSignedUrls, setImageSignedUrls] = useState<Record<number, string>>({});
  const [draggedScene, setDraggedScene] = useState<number | null>(null);
  const [dragOverScene, setDragOverScene] = useState<number | null>(null);
  const scriptRef = useRef<HTMLDivElement>(null);
  const saveTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Preset clips state
  const [presetClips, setPresetClips] = useState<PresetClip[]>([]);
  const [presetVideoUrls, setPresetVideoUrls] = useState<Record<number, string>>({});
  const [presetThumbnailUrls, setPresetThumbnailUrls] = useState<Record<number, string>>({});
  const loadingPresetThumbs = useRef<Set<number>>(new Set());
  const [showPresetPicker, setShowPresetPicker] = useState<number | null>(null);
  const [presetPickerFlipped, setPresetPickerFlipped] = useState(false);
  const [presetSearch, setPresetSearch] = useState('');
  const [autoLinking, setAutoLinking] = useState(false);
  const [autoLinkResult, setAutoLinkResult] = useState<string | null>(null);

  // Scroll view state — default to scroll view when short is past script stage
  const isScriptMode = !shortStatus || shortStatus === 'idea' || shortStatus === 'script';
  const [scrollView, setScrollView] = useState(!isScriptMode);
  const [scrollIndex, setScrollIndex] = useState(0);

  const canEditScenes = isAdmin || user?.roles?.includes('script_writer') || false;
  const canClipperCheck = isAdmin || user?.roles?.includes('clipper') || user?.roles?.includes('script_writer') || false;
  const isClippingStage = shortStatus === 'clipping';

  useEffect(() => {
    loadScenes();
    loadPresetClips();
  }, [shortId]);

  useEffect(() => {
    setScriptDraft(scriptContent);
  }, [scriptContent]);

  useEffect(() => {
    if (expandedScene === null) return;
    const scene = scenes.find(s => s.id === expandedScene);
    if (!scene?.images?.length) return;
    for (const img of scene.images) {
      if (!imageSignedUrls[img.id]) {
        scenesApi.getSceneImageUrl(shortId, scene.id, img.id)
          .then(url => setImageSignedUrls(prev => ({ ...prev, [img.id]: url })))
          .catch(() => {});
      }
    }
  }, [expandedScene, scenes]);

  // Flashcard keyboard navigation
  useEffect(() => {
    if (!scrollView) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setScrollIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setScrollIndex(prev => Math.min(scenes.length - 1, prev + 1));
      } else if (e.key === 'Escape') {
        setScrollView(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [scrollView, scenes.length]);

  // Load image signed URLs for flashcard scene
  useEffect(() => {
    if (!scrollView || scenes.length === 0) return;
    const scene = scenes[scrollIndex];
    if (!scene?.images?.length) return;
    for (const img of scene.images) {
      if (!imageSignedUrls[img.id]) {
        scenesApi.getSceneImageUrl(shortId, scene.id, img.id)
          .then(url => setImageSignedUrls(prev => ({ ...prev, [img.id]: url })))
          .catch(() => {});
      }
    }
  }, [scrollView, scrollIndex, scenes]);

  const loadScenes = async () => {
    try {
      const data = await scenesApi.getAll(shortId);
      setScenes(data);
    } catch (error) {
      console.error('Failed to load scenes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPresetClips = async () => {
    try {
      const data = await presetClipsApi.getAll();
      setPresetClips(data);
    } catch {
      // presets may not be available
    }
  };

  const loadPresetVideoUrl = (presetId: number) => {
    if (presetVideoUrls[presetId]) return;
    presetClipsApi.getVideoUrl(presetId)
      .then(url => setPresetVideoUrls(prev => ({ ...prev, [presetId]: url })))
      .catch(() => {});
  };

  const loadPresetThumbnailUrl = (preset: PresetClip) => {
    if (presetThumbnailUrls[preset.id] || loadingPresetThumbs.current.has(preset.id)) return;
    loadingPresetThumbs.current.add(preset.id);
    if (preset.thumbnail_path) {
      presetClipsApi.getThumbnailUrl(preset.id)
        .then(url => setPresetThumbnailUrls(prev => ({ ...prev, [preset.id]: url })))
        .catch(() => {})
        .finally(() => loadingPresetThumbs.current.delete(preset.id));
    } else {
      presetClipsApi.getVideoUrl(preset.id)
        .then(url => setPresetThumbnailUrls(prev => ({ ...prev, [preset.id]: url })))
        .catch(() => {})
        .finally(() => loadingPresetThumbs.current.delete(preset.id));
    }
  };

  const LINK_COLORS = ['#FF7043','#42A5F5','#66BB6A','#AB47BC','#FFCA28','#26C6DA'];
  const getLinkGroupColor = (group: string) => {
    let h = 0;
    for (let i = 0; i < group.length; i++) h = (h * 31 + group.charCodeAt(i)) & 0xFFFF;
    return LINK_COLORS[h % LINK_COLORS.length];
  };

  interface PresetGroup {
    label: string;
    baseName: string;
    nametag?: PresetClip;
    noNametag?: PresetClip;
    standalone?: PresetClip;
  }

  const groupPresets = (clips: PresetClip[]): PresetGroup[] => {
    const groups: Record<string, PresetGroup> = {};
    for (const clip of clips) {
      const nameLower = clip.name.toLowerCase();
      const isNametag = nameLower.includes('nametag') && !nameLower.includes('no nametag');
      const isNoNametag = nameLower.includes('no nametag');
      if (!isNametag && !isNoNametag) {
        groups[clip.name] = { label: clip.label || '?', baseName: clip.name, standalone: clip };
        continue;
      }
      const baseName = clip.name.replace(/\s*No\s+Nametag\s*/i, '').replace(/\s*Nametag\s*/i, '').trim();
      const key = baseName.toLowerCase();
      if (!groups[key]) groups[key] = { label: clip.label || '?', baseName };
      if (isNoNametag) groups[key].noNametag = clip;
      else groups[key].nametag = clip;
    }
    return Object.values(groups).sort((a, b) => (parseInt(a.label) || 999) - (parseInt(b.label) || 999));
  };

  const handleCreateSceneFromSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !scriptRef.current) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    if (!scriptRef.current.contains(range.commonAncestorContainer)) return;

    createScene({ script_line: selectedText });
    selection.removeAllRanges();
  }, [shortId, scenes]);

  const createScene = async (input: CreateSceneInput) => {
    try {
      const newScene = await scenesApi.create(shortId, input);
      setScenes(prev => [...prev, newScene]);
    } catch (error) {
      console.error('Failed to create scene:', error);
    }
  };

  const updateScene = async (sceneId: number, input: UpdateSceneInput) => {
    setScenes(prev => prev.map(s => {
      if (s.id !== sceneId) return s;
      const updated = { ...s, ...input };
      // If preset_clip_id changed, attach or clear preset_clip
      if (input.preset_clip_id !== undefined) {
        updated.preset_clip = input.preset_clip_id
          ? presetClips.find(p => p.id === input.preset_clip_id) || null
          : null;
      }
      return updated;
    }));

    if (saveTimeouts.current[sceneId]) {
      clearTimeout(saveTimeouts.current[sceneId]);
    }
    saveTimeouts.current[sceneId] = setTimeout(async () => {
      setSaving(sceneId);
      try {
        await scenesApi.update(shortId, sceneId, input);
      } catch (error) {
        console.error('Failed to update scene:', error);
        loadScenes();
      } finally {
        setSaving(null);
      }
    }, 600);
  };

  const deleteScene = async (sceneId: number) => {
    setScenes(prev => prev.filter(s => s.id !== sceneId));
    try {
      await scenesApi.delete(shortId, sceneId);
    } catch (error) {
      console.error('Failed to delete scene:', error);
      loadScenes();
    }
  };

  const handleSaveScript = async () => {
    onScriptContentChange(scriptDraft);
    setEditingScript(false);
  };

  const handleImageUpload = async (sceneId: number, file: File) => {
    const isVideo = file.type === 'video/mp4' || file.name.endsWith('.mp4');
    try {
      const uploadUrlData = await filesApi.getUploadUrl(
        shortId,
        isVideo ? 'scene_video' : 'scene_image',
        file.name,
        file.size,
        file.type || (isVideo ? 'video/mp4' : 'image/jpeg')
      );
      await filesApi.uploadDirectToGCS(uploadUrlData.upload_url, file);
      const newImage: SceneImage = await scenesApi.addImage(shortId, sceneId, uploadUrlData.bucket_path, isVideo ? 'video' : 'image');
      setScenes(prev => prev.map(s =>
        s.id === sceneId ? { ...s, images: [...(s.images || []), newImage] } : s
      ));
      scenesApi.getSceneImageUrl(shortId, sceneId, newImage.id)
        .then(url => setImageSignedUrls(prev => ({ ...prev, [newImage.id]: url })))
        .catch(() => {});
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  const handleDeleteImage = async (sceneId: number, imageId: number) => {
    try {
      await scenesApi.deleteImage(shortId, sceneId, imageId);
      setScenes(prev => prev.map(s =>
        s.id === sceneId ? { ...s, images: (s.images || []).filter(img => img.id !== imageId) } : s
      ));
      setImageSignedUrls(prev => { const next = { ...prev }; delete next[imageId]; return next; });
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  // Drag and drop reordering
  const handleDragStart = (sceneId: number) => {
    setDraggedScene(sceneId);
  };

  const handleDragOver = (e: React.DragEvent, sceneId: number) => {
    e.preventDefault();
    setDragOverScene(sceneId);
  };

  const handleDrop = async (targetSceneId: number) => {
    if (draggedScene === null || draggedScene === targetSceneId) {
      setDraggedScene(null);
      setDragOverScene(null);
      return;
    }

    const newScenes = [...scenes];
    const dragIdx = newScenes.findIndex(s => s.id === draggedScene);
    const dropIdx = newScenes.findIndex(s => s.id === targetSceneId);
    const [moved] = newScenes.splice(dragIdx, 1);
    newScenes.splice(dropIdx, 0, moved);

    setScenes(newScenes);
    setDraggedScene(null);
    setDragOverScene(null);

    try {
      await scenesApi.reorder(shortId, newScenes.map(s => s.id));
    } catch (error) {
      console.error('Failed to reorder scenes:', error);
      loadScenes();
    }
  };

  const getHighlightedScript = () => {
    if (!scriptContent) return null;
    const scriptLines = scenes.map(s => s.script_line).filter(Boolean);

    if (scriptLines.length === 0) {
      return <span>{scriptContent}</span>;
    }

    type Segment = { text: string; highlighted: boolean; sceneIndex?: number };
    const segments: Segment[] = [];

    const matches: { start: number; end: number; sceneIndex: number }[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const line = scenes[i].script_line;
      if (!line) continue;
      const idx = scriptContent.indexOf(line);
      if (idx !== -1) {
        matches.push({ start: idx, end: idx + line.length, sceneIndex: i });
      }
    }
    matches.sort((a, b) => a.start - b.start);

    const cleanMatches: typeof matches = [];
    for (const m of matches) {
      if (cleanMatches.length === 0 || m.start >= cleanMatches[cleanMatches.length - 1].end) {
        cleanMatches.push(m);
      }
    }

    let pos = 0;
    for (const match of cleanMatches) {
      if (match.start > pos) {
        segments.push({ text: scriptContent.slice(pos, match.start), highlighted: false });
      }
      segments.push({ text: scriptContent.slice(match.start, match.end), highlighted: true, sceneIndex: match.sceneIndex });
      pos = match.end;
    }
    if (pos < scriptContent.length) {
      segments.push({ text: scriptContent.slice(pos), highlighted: false });
    }

    // In scroll view, the current scene gets a stronger highlight
    const activeSceneIdx = scrollView ? scrollIndex : null;

    return segments.map((seg, i) => {
      const isActive = seg.highlighted && activeSceneIdx !== null && seg.sceneIndex === activeSceneIdx;
      return (
        <span
          key={i}
          style={seg.highlighted ? {
            background: isActive
              ? 'color-mix(in srgb, var(--gold) 40%, transparent)'
              : 'color-mix(in srgb, var(--gold) 12%, transparent)',
            borderBottom: isActive ? '2px solid var(--gold)' : '1px solid color-mix(in srgb, var(--gold) 40%, transparent)',
            borderRadius: '2px',
            padding: '1px 0',
            transition: 'all 0.2s',
          } : undefined}
          title={seg.highlighted ? `Scene ${(seg.sceneIndex ?? 0) + 1}` : undefined}
        >
          {seg.text}
        </span>
      );
    });
  };

  // Preset picker for expanded scene
  const renderPresetPicker = (sceneId: number) => {
    if (showPresetPicker !== sceneId) return null;
    const q = presetSearch.trim().toLowerCase();
    const filtered = q ? presetClips.filter(p => p.name.toLowerCase().includes(q) || (p.label || '').toLowerCase().includes(q)) : presetClips;
    const groups = groupPresets(filtered);
    // Trigger thumbnail loads
    presetClips.forEach(p => loadPresetThumbnailUrl(p));

    const renderThumb = (preset: PresetClip, size = 64) => (
      <div style={{
        width: `${size}px`,
        height: `${Math.round(size * 9 / 16)}px`,
        borderRadius: '4px',
        overflow: 'hidden',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        {presetThumbnailUrls[preset.id] ? (
          preset.thumbnail_path ? (
            <img src={presetThumbnailUrls[preset.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <video src={presetThumbnailUrls[preset.id]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />
          )
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--border-subtle)' }} />
        )}
      </div>
    );

    return (
      <div
        style={{
          position: 'absolute',
          ...(presetPickerFlipped
            ? { bottom: '100%', marginBottom: '4px' }
            : { top: '100%', marginTop: '4px' }),
          left: 0,
          right: 0,
          zIndex: 10,
          background: 'var(--modal-bg)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxHeight: '480px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Search */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <input
            autoFocus
            type="text"
            placeholder="Search presets…"
            value={presetSearch}
            onChange={e => setPresetSearch(e.target.value)}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', padding: '6px 10px', borderRadius: '6px',
              border: '1px solid var(--border-default)', background: 'var(--bg-base)',
              color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
        {groups.length === 0 ? (
          <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
            No presets yet. Create some on the Presets page.
          </div>
        ) : (
          groups.map((group, i) => {
            const isPair = !!(group.nametag || group.noNametag) && !group.standalone;
            return (
              <div key={i} style={{ borderBottom: '1px solid var(--border-subtle)', padding: '8px 10px' }}>
                {/* Group label + base name */}
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  {group.label ? `${group.label}. ` : ''}{group.baseName}
                </div>

                {isPair ? (
                  // Side-by-side nametag / no-nametag pair
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { preset: group.nametag, label: 'Nametag' },
                      { preset: group.noNametag, label: 'No Nametag' },
                    ].filter(v => v.preset).map(({ preset, label }) => (
                      <button
                        key={preset!.id}
                        onClick={() => { updateScene(sceneId, { preset_clip_id: preset!.id }); setShowPresetPicker(null); setPresetSearch(''); }}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '6px', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gold-dim)'; e.currentTarget.style.borderColor = 'var(--gold-border)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                      >
                        {renderThumb(preset!, 80)}
                        <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)' }}>{label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  // Standalone
                  <button
                    onClick={() => { updateScene(sceneId, { preset_clip_id: group.standalone!.id }); setShowPresetPicker(null); setPresetSearch(''); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '2px 4px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gold-dim)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {renderThumb(group.standalone!, 64)}
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{group.standalone!.name}</div>
                      {group.standalone!.description && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{group.standalone!.description}</div>
                      )}
                    </div>
                  </button>
                )}
              </div>
            );
          })
        )}
        </div>
      </div>
    );
  };

  // Preset display for a scene (in expanded panel or flashcard)
  const renderPresetSection = (scene: Scene) => {
    const preset = scene.preset_clip;
    if (preset?.id) {
      loadPresetVideoUrl(preset.id);
    }

    return (
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Preset Clip</label>
        {preset ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: 'color-mix(in srgb, var(--gold) 8%, var(--bg-base))', border: '1px solid var(--gold-border, var(--border-default))' }}>
            {presetVideoUrls[preset.id] && (
              <video
                src={presetVideoUrls[preset.id]}
                style={{ width: '80px', height: '45px', objectFit: 'cover', borderRadius: '4px' }}
                muted
                preload="metadata"
              />
            )}
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{preset.label ? `${preset.label}. ` : ''}{preset.name}</span>
              {preset.description && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{preset.description}</p>
              )}
            </div>
            {presetVideoUrls[preset.id] && (
              <a
                href={presetVideoUrls[preset.id]}
                download={`${preset.name}.mp4`}
                onClick={e => {
                  e.stopPropagation();
                  const url = presetVideoUrls[preset.id];
                  fetch(url).then(r => r.blob()).then(blob => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `${preset.name}.mp4`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  });
                  e.preventDefault();
                }}
                style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Download preset MP4"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
            )}
            {canEditScenes && (
              <button
                onClick={() => updateScene(scene.id, { preset_clip_id: null })}
                style={{ fontSize: '12px', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
              >
                Unlink
              </button>
            )}
          </div>
        ) : canEditScenes ? (
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                if (showPresetPicker === scene.id) {
                  setShowPresetPicker(null);
                } else {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setPresetPickerFlipped(rect.bottom + 210 > window.innerHeight);
                  setShowPresetPicker(scene.id);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '7px',
                border: '1px dashed var(--border-strong)',
                background: 'var(--bg-base)',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-muted)',
              }}
            >
              + Link Preset Clip
            </button>
            {renderPresetPicker(scene.id)}
          </div>
        ) : (
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>None</span>
        )}
      </div>
    );
  };

  // Flashcard view
  const renderScrollView = () => {
    if (scenes.length === 0) return null;
    const scene = scenes[scrollIndex];
    if (!scene) return null;

    // Collect sections to render with separators between them
    const sections: React.ReactNode[] = [];

    // Script Line (always shown)
    sections.push(
      <div key="script" style={{ padding: '20px 24px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Script Line</label>
        <p style={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
          {scene.script_line || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: '400' }}>No script line</span>}
        </p>
      </div>
    );

    // Direction
    if (scene.direction) {
      sections.push(
        <div key="direction" style={{ padding: '16px 24px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Direction</label>
          <p style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {scene.direction}
          </p>
        </div>
      );
    }

    // Clipper Notes
    if (scene.clipper_notes) {
      sections.push(
        <div key="clipper" style={{ padding: '16px 24px', background: 'color-mix(in srgb, var(--col-clips) 4%, transparent)' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--col-clips)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Clipper Notes</label>
          <p style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {scene.clipper_notes}
          </p>
        </div>
      );
    }

    // Editor Notes
    if (scene.editor_notes) {
      sections.push(
        <div key="editor" style={{ padding: '16px 24px', background: 'color-mix(in srgb, var(--col-editing) 4%, transparent)' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--col-editing)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Editor Notes</label>
          <p style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {scene.editor_notes}
          </p>
        </div>
      );
    }

    // Preset Clip
    if (scene.preset_clip) {
      if (scene.preset_clip.id) loadPresetVideoUrl(scene.preset_clip.id);
      sections.push(
        <div key="preset" style={{ padding: '16px 24px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--gold)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Preset Clip</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', background: 'color-mix(in srgb, var(--gold) 6%, var(--bg-base))', border: '1px solid var(--border-default)' }}>
            {scene.preset_clip.id && presetVideoUrls[scene.preset_clip.id] && (
              <video
                src={presetVideoUrls[scene.preset_clip.id]}
                controls
                preload="metadata"
                style={{ width: '160px', height: '90px', objectFit: 'cover', borderRadius: '6px' }}
              />
            )}
            <div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{scene.preset_clip.label ? `${scene.preset_clip.label}. ` : ''}{scene.preset_clip.name}</span>
              {scene.preset_clip.description && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{scene.preset_clip.description}</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Images
    if ((scene.images?.length ?? 0) > 0) {
      sections.push(
        <div key="images" style={{ padding: '16px 24px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reference Media</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {scene.images!.map(img => (
              <div key={img.id} style={{ resize: 'both', overflow: 'hidden', height: '200px', minWidth: '80px', minHeight: '60px', borderRadius: '8px', border: '1px solid var(--border-default)', display: 'inline-block' }}>
                {imageSignedUrls[img.id] ? (
                  img.file_type === 'video' ? (
                    <video src={imageSignedUrls[img.id]} controls style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: '8px' }} />
                  ) : (
                    <img src={imageSignedUrls[img.id]} alt="Scene reference" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  )
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Loading...</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 340px)', minHeight: '400px' }}>
        {/* Scene card — fills available space */}
        <div
          style={{
            flex: 1,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Scene header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-default)',
            background: 'color-mix(in srgb, var(--gold) 5%, var(--bg-elevated))',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '17px', fontWeight: '700', color: 'var(--gold)' }}>
              Scene {scrollIndex + 1}
              <span style={{ fontWeight: '400', color: 'var(--text-muted)', fontSize: '14px', marginLeft: '6px' }}>of {scenes.length}</span>
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Arrow keys to navigate</span>
          </div>

          {/* Content — sections with separators */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {sections.map((section, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div style={{ height: '1px', background: 'var(--border-default)', margin: '0 24px' }} />}
                {section}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Navigation — always at bottom, fixed position */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '16px 0 4px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setScrollIndex(prev => Math.max(0, prev - 1))}
            disabled={scrollIndex === 0}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              background: scrollIndex === 0 ? 'var(--border-subtle)' : 'var(--bg-elevated)',
              color: scrollIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: scrollIndex === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              minWidth: '100px',
            }}
          >
            ← Prev
          </button>

          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {scenes.map((_, i) => (
              <button
                key={i}
                onClick={() => setScrollIndex(i)}
                style={{
                  width: i === scrollIndex ? '20px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: i === scrollIndex ? 'var(--gold)' : 'var(--border-default)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  padding: 0,
                }}
              />
            ))}
          </div>

          <button
            onClick={() => setScrollIndex(prev => Math.min(scenes.length - 1, prev + 1))}
            disabled={scrollIndex === scenes.length - 1}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              background: scrollIndex === scenes.length - 1 ? 'var(--border-subtle)' : 'var(--bg-elevated)',
              color: scrollIndex === scenes.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: scrollIndex === scenes.length - 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              minWidth: '100px',
            }}
          >
            Next →
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading scenes...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Main Script Section */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Main Script
          </h3>
          <div className="flex items-center gap-2">
            {!editingScript && scriptContent && canEditScenes && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Highlight text and click "Create Scene" to add scenes
              </span>
            )}
            {canEditScenes && (
              <button
                onClick={() => {
                  if (editingScript) {
                    handleSaveScript();
                  } else {
                    setEditingScript(true);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: editingScript ? 'var(--green)' : 'var(--bg-elevated)',
                  color: editingScript ? '#fff' : 'var(--text-primary)',
                  border: editingScript ? 'none' : '1px solid var(--border-default)',
                  cursor: 'pointer',
                }}
              >
                {editingScript ? 'Save Script' : 'Edit Script'}
              </button>
            )}
          </div>
        </div>

        {editingScript ? (
          <textarea
            value={scriptDraft}
            onChange={(e) => setScriptDraft(e.target.value)}
            className="w-full p-4 rounded-lg text-sm leading-relaxed font-mono resize-y focus:outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--gold)',
              color: 'var(--text-primary)',
              minHeight: '200px',
            }}
            placeholder="Write your main script here..."
          />
        ) : scriptContent ? (
          <div className="relative">
            <div
              ref={scriptRef}
              className="p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap select-text"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                cursor: 'text',
                userSelect: 'text',
              }}
            >
              {getHighlightedScript()}
            </div>
            {canEditScenes && (
              <button
                onClick={handleCreateSceneFromSelection}
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--gold)',
                  color: 'var(--bg-base)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                + Create Scene from Selection
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-lg text-center" style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-default)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>No script written yet</p>
            {canEditScenes && (
              <button
                onClick={() => setEditingScript(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
              >
                Write Script
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scenes Grid Section */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Scenes ({scenes.length})
          </h3>
          <div className="flex items-center gap-2">
            {scenes.length > 0 && (
              <div style={{
                display: 'inline-flex',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => setScrollView(false)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: !scrollView ? 'var(--gold)' : 'var(--bg-elevated)',
                    color: !scrollView ? 'var(--bg-base)' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  Grid
                </button>
                <button
                  onClick={() => { setScrollIndex(0); setScrollView(true); }}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    borderLeft: '1px solid var(--border-default)',
                    cursor: 'pointer',
                    background: scrollView ? 'var(--gold)' : 'var(--bg-elevated)',
                    color: scrollView ? 'var(--bg-base)' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  Scroll View
                </button>
              </div>
            )}
            {canEditScenes && scenes.length > 1 && (
              <button
                onClick={async () => {
                  setAutoLinking(true);
                  setAutoLinkResult(null);
                  try {
                    const { applied } = await scenesApi.autoLinkGroups(shortId);
                    if (applied.length === 0) {
                      setAutoLinkResult('No shared locations found.');
                    } else {
                      setScenes(prev => prev.map(s => {
                        const suggestion = applied.find(a => a.scene_id === s.id);
                        return suggestion ? { ...s, link_group: suggestion.link_group } : s;
                      }));
                      const groups = [...new Set(applied.map(a => a.link_group))];
                      setAutoLinkResult(`Labeled ${applied.length} scenes across ${groups.length} group${groups.length > 1 ? 's' : ''}: ${groups.join(', ')}`);
                    }
                  } catch {
                    setAutoLinkResult('AI labeling failed — check backend logs.');
                  } finally {
                    setAutoLinking(false);
                  }
                }}
                disabled={autoLinking}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'var(--bg-elevated)', color: 'var(--gold)', border: '1px solid var(--gold-border, var(--border-default))', cursor: autoLinking ? 'default' : 'pointer', opacity: autoLinking ? 0.6 : 1 }}
              >
                {autoLinking ? '✦ Labeling…' : '✦ Auto-label'}
              </button>
            )}
            {canEditScenes && (
              <button
                onClick={() => createScene({ script_line: '', direction: '' })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', cursor: 'pointer' }}
              >
                + Add Empty Scene
              </button>
            )}
            {autoLinkResult && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '300px' }}>{autoLinkResult}</span>
            )}
          </div>
        </div>

        {scenes.length === 0 ? (
          <div className="p-6 rounded-lg text-center" style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-default)' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              No scenes yet. {canEditScenes ? 'Highlight text in the script above and click "Create Scene from Selection" to get started.' : ''}
            </p>
          </div>
        ) : scrollView ? (
          renderScrollView()
        ) : (
          <>
            {/* Grid of scene cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            }}>
              {scenes.map((scene, index) => (
                <React.Fragment key={scene.id}>
                <div
                  draggable={canEditScenes}
                  onDragStart={() => handleDragStart(scene.id)}
                  onDragOver={(e) => handleDragOver(e, scene.id)}
                  onDrop={() => handleDrop(scene.id)}
                  onDragEnd={() => { setDraggedScene(null); setDragOverScene(null); }}
                  onClick={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
                  className="rounded-lg transition-all"
                  style={{
                    background: expandedScene === scene.id ? 'color-mix(in srgb, var(--gold) 8%, var(--bg-elevated))' : 'var(--bg-elevated)',
                    border: dragOverScene === scene.id
                      ? '2px solid var(--gold)'
                      : expandedScene === scene.id
                        ? '1px solid var(--gold)'
                        : '1px solid var(--border-default)',
                    borderLeft: scene.link_group && expandedScene !== scene.id && dragOverScene !== scene.id
                      ? `3px solid ${getLinkGroupColor(scene.link_group)}`
                      : undefined,
                    opacity: draggedScene === scene.id ? 0.5 : 1,
                    cursor: 'pointer',
                    padding: '10px 12px',
                    minHeight: '80px',
                  }}
                >
                  {/* Scene number + saving indicator + badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {canEditScenes && (
                        <span style={{ cursor: 'grab', fontSize: '13px', color: 'var(--text-muted)' }} title="Drag to reorder">⠿</span>
                      )}
                      <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--gold)' }}>
                        Scene {index + 1}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {saving === scene.id && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Saving...</span>
                      )}
                      {isClippingStage && canClipperCheck && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const val = !scene.clipper_checked;
                            setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, clipper_checked: val } : s));
                            try { await scenesApi.update(shortId, scene.id, { clipper_checked: val }); }
                            catch { loadScenes(); }
                          }}
                          title={scene.clipper_checked ? 'Mark incomplete' : 'Mark complete'}
                          style={{
                            fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1,
                            color: scene.clipper_checked ? '#66BB6A' : 'var(--border-strong)',
                            opacity: scene.clipper_checked ? 1 : 0.5,
                          }}
                        >
                          {scene.clipper_checked ? '✓' : '○'}
                        </button>
                      )}
                      {scene.needs_rework && (
                        <span style={{ fontSize: '11px', color: '#fff', fontWeight: 700, background: '#E05A4E', padding: '1px 6px', borderRadius: '4px' }} title="Flagged for rework">
                          REWORK
                        </span>
                      )}
                      {scene.preset_clip && (
                        <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: '600' }} title={`Preset ${scene.preset_clip.label || ''}: ${scene.preset_clip.name}`}>
                          PRESET {scene.preset_clip.label || ''}
                        </span>
                      )}
                      {(scene.images?.length ?? 0) > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--green)' }} title={`${scene.images!.length} image${scene.images!.length > 1 ? 's' : ''}`}>
                          IMG{scene.images!.length > 1 ? ` ×${scene.images!.length}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Script preview (3 lines max) */}
                  <p style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    margin: '0 0 6px 0',
                  }}>
                    {scene.script_line || <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>No script line</span>}
                  </p>

                  {/* Clipper notes (always visible on card) */}
                  {scene.clipper_notes && (
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--col-clips)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clipper</span>
                      <p style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.3',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        margin: '1px 0 0 0',
                      }}>
                        {scene.clipper_notes}
                      </p>
                    </div>
                  )}

                  {/* Editor notes (always visible on card) */}
                  {scene.editor_notes && (
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--col-editing)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Editor</span>
                      <p style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.3',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        margin: '1px 0 0 0',
                      }}>
                        {scene.editor_notes}
                      </p>
                    </div>
                  )}
                </div>
                {expandedScene === scene.id && (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--gold)',
                        borderRadius: '10px',
                        padding: '20px',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--gold)' }}>Scene {index + 1}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {saving === scene.id && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Saving...</span>
                      )}
                      {canEditScenes && (
                        <button
                          onClick={async () => {
                            const val = !scene.needs_rework;
                            setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, needs_rework: val } : s));
                            try { await scenesApi.update(shortId, scene.id, { needs_rework: val }); }
                            catch { loadScenes(); }
                          }}
                          title={scene.needs_rework ? 'Clear rework flag' : 'Flag for rework'}
                          style={{
                            fontSize: '12px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                            background: scene.needs_rework ? '#E05A4E' : 'var(--border-default)',
                            color: scene.needs_rework ? '#fff' : 'var(--text-muted)',
                          }}
                        >
                          {scene.needs_rework ? '⚑ Flagged' : '⚑ Flag'}
                        </button>
                      )}
                      {canEditScenes && (
                        <button
                          onClick={() => deleteScene(scene.id)}
                          style={{ fontSize: '13px', color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                        >
                          Delete
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedScene(null)}
                        style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {/* Script Line */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Script</label>
                    {canEditScenes ? (
                      <textarea
                        value={scene.script_line}
                        onChange={(e) => updateScene(scene.id, { script_line: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '8px',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-primary)',
                          fontSize: '16px',
                          fontWeight: '600',
                          lineHeight: '1.5',
                          minHeight: '80px',
                          resize: 'vertical',
                        }}
                        placeholder="Script narration for this scene..."
                      />
                    ) : (
                      <p style={{ fontSize: '16px', fontWeight: '600', lineHeight: '1.5', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                        {scene.script_line || <span style={{ color: 'var(--text-muted)' }}>No script line</span>}
                      </p>
                    )}
                  </div>

                  {/* Direction */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Direction</label>
                    {canEditScenes ? (
                      <textarea
                        value={scene.direction}
                        onChange={(e) => updateScene(scene.id, { direction: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '8px',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-secondary)',
                          fontSize: '15px',
                          lineHeight: '1.5',
                          minHeight: '60px',
                          resize: 'vertical',
                        }}
                        placeholder="What should the editor/clipper show for this scene..."
                      />
                    ) : (
                      <p style={{ fontSize: '15px', lineHeight: '1.5', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                        {scene.direction || <span style={{ color: 'var(--text-muted)' }}>No direction</span>}
                      </p>
                    )}
                  </div>

                  {/* Clipper Notes */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--col-clips)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clipper Notes</label>
                    {canEditScenes ? (
                      <textarea
                        value={scene.clipper_notes || ''}
                        onChange={(e) => updateScene(scene.id, { clipper_notes: e.target.value || null })}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '8px',
                          background: 'color-mix(in srgb, var(--col-clips) 5%, var(--bg-base))',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-primary)',
                          fontSize: '15px',
                          lineHeight: '1.5',
                          minHeight: '50px',
                          resize: 'vertical',
                        }}
                        placeholder="Add clipper notes..."
                      />
                    ) : (
                      <p style={{ fontSize: '15px', lineHeight: '1.5', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                        {scene.clipper_notes || <span style={{ color: 'var(--text-muted)' }}>No notes yet</span>}
                      </p>
                    )}
                  </div>

                  {/* Editor Notes */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--col-editing)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Editor Notes</label>
                    {canEditScenes ? (
                      <textarea
                        value={scene.editor_notes || ''}
                        onChange={(e) => updateScene(scene.id, { editor_notes: e.target.value || null })}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '8px',
                          background: 'color-mix(in srgb, var(--col-editing) 5%, var(--bg-base))',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-primary)',
                          fontSize: '15px',
                          lineHeight: '1.5',
                          minHeight: '50px',
                          resize: 'vertical',
                        }}
                        placeholder="Add editor notes..."
                      />
                    ) : (
                      <p style={{ fontSize: '15px', lineHeight: '1.5', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                        {scene.editor_notes || <span style={{ color: 'var(--text-muted)' }}>No notes yet</span>}
                      </p>
                    )}
                  </div>

                  {/* Link Group */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Link Group
                      {scene.link_group && <span style={{ marginLeft: '8px', display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: getLinkGroupColor(scene.link_group), verticalAlign: 'middle' }} />}
                    </label>
                    {canEditScenes ? (
                      <input
                        type="text"
                        value={scene.link_group || ''}
                        onChange={e => updateScene(scene.id, { link_group: e.target.value || null })}
                        placeholder="e.g. forest, cave, spawn — scenes with the same label share a color"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    ) : (
                      <span style={{ fontSize: '13px', color: scene.link_group ? 'var(--text-primary)' : 'var(--text-muted)' }}>{scene.link_group || 'None'}</span>
                    )}
                  </div>

                  {/* Preset Clip Section */}
                  {renderPresetSection(scene)}

                  {/* Scene Images */}
                  {((scene.images?.length ?? 0) > 0 || canEditScenes) && (
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scene Media</label>
                      {(scene.images?.length ?? 0) > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                          {scene.images!.map(img => (
                            <div key={img.id} style={{ position: 'relative', display: 'inline-block' }}>
                              {imageSignedUrls[img.id] ? (
                                <div style={{ resize: 'both', overflow: 'hidden', width: '220px', minWidth: '80px', minHeight: '60px', borderRadius: '8px', border: '1px solid var(--border-default)', display: 'inline-block' }}>
                                  {img.file_type === 'video' ? (
                                    <video src={imageSignedUrls[img.id]} controls style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: '8px' }} />
                                  ) : (
                                    <img
                                      src={imageSignedUrls[img.id]}
                                      alt="Scene reference"
                                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: '8px' }}
                                    />
                                  )}
                                </div>
                              ) : (
                                <div style={{ width: '120px', height: '90px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                                  Loading…
                                </div>
                              )}
                              {canEditScenes && (
                                <button
                                  onClick={() => handleDeleteImage(scene.id, img.id)}
                                  style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', lineHeight: 1 }}
                                  title="Remove"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {canEditScenes && (
                        <label style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 14px',
                          borderRadius: '7px',
                          border: '1px dashed var(--border-strong)',
                          background: 'var(--bg-base)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: 'var(--text-muted)',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          Add Image / Video
                          <input
                            type="file"
                            accept="image/*,video/mp4"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(scene.id, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
