import React, { useState, useEffect, useRef } from 'react';
import { Scene, SceneImage, CreateSceneInput, UpdateSceneInput, PresetClip, ShortStatus } from '../../../shared/types';
import { scenesApi, filesApi, presetClipsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmDialog } from './ui/confirm-dialog';

interface SceneEditorProps {
  shortId: number;
  shortStatus?: ShortStatus;
  scriptContent: string;
  onScriptContentChange: (content: string) => void;
  isAdmin: boolean;
}

// Inline drag handle placed between two adjacent scene highlights in the script text
function InlineBoundaryHandle({
  aboveId, belowId, aboveText, belowText, onUpdate, onCommit,
}: {
  aboveId: number; belowId: number;
  aboveText: string; belowText: string;
  onUpdate: (aboveId: number, belowId: number, a: string, b: string) => void;
  onCommit: (aboveId: number, belowId: number, a: string, b: string) => void;
}) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startSplit = useRef(0);
  const allWords = useRef<string[]>([]);
  const [active, setActive] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const wa = aboveText.trim().split(/\s+/).filter(Boolean);
    const wb = belowText.trim().split(/\s+/).filter(Boolean);
    allWords.current = [...wa, ...wb];
    startSplit.current = wa.length;
    startX.current = e.clientX;
    isDragging.current = true;
    setActive(true);

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const split = Math.max(1, Math.min(allWords.current.length - 1,
        startSplit.current + Math.round((ev.clientX - startX.current) / 36)));
      onUpdate(aboveId, belowId,
        allWords.current.slice(0, split).join(' '),
        allWords.current.slice(split).join(' '));
    };
    const onUp = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setActive(false);
      const split = Math.max(1, Math.min(allWords.current.length - 1,
        startSplit.current + Math.round((ev.clientX - startX.current) / 36)));
      onCommit(aboveId, belowId,
        allWords.current.slice(0, split).join(' '),
        allWords.current.slice(split).join(' '));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <span
      onMouseDown={handleMouseDown}
      title="Drag left/right to move words between scenes"
      style={{
        display: 'inline-block',
        cursor: 'ew-resize',
        userSelect: 'none',
        width: '10px',
        height: '13px',
        verticalAlign: 'middle',
        background: active ? 'var(--gold)' : 'color-mix(in srgb, var(--gold) 55%, transparent)',
        borderRadius: '2px',
        margin: '0 1px',
        transition: 'background 0.1s, width 0.1s',
        flexShrink: 0,
      }}
    />
  );
}

// Interactive script view: renders scene highlights with inline delete + boundary drag handles
function InteractiveScriptView({
  scriptContent, scenes, localScriptLines, canEditScenes,
  showAnnotations, isClippingStage, onDeleteScene, onSelectScene, onBoundaryUpdate, onBoundaryCommit, onCreateSceneFromSelection,
}: {
  scriptContent: string;
  scenes: Scene[];
  localScriptLines: Record<number, string>;
  canEditScenes: boolean;
  showAnnotations: boolean;
  isClippingStage: boolean;
  onDeleteScene: (id: number) => void;
  onSelectScene: (id: number) => void;
  onBoundaryUpdate: (aboveId: number, belowId: number, a: string, b: string) => void;
  onBoundaryCommit: (aboveId: number, belowId: number, a: string, b: string) => void;
  onCreateSceneFromSelection: (text: string) => void;
}) {
  const scriptRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string; sceneId?: number } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [contextMenu]);

  // Build position-ordered list of scene matches within scriptContent
  type MatchEntry = { start: number; end: number; scene: Scene };
  const matchArr: MatchEntry[] = [];
  for (const scene of scenes) {
    const effectiveText = localScriptLines[scene.id] ?? scene.script_line;
    if (!effectiveText) continue;
    const idx = scriptContent.indexOf(effectiveText);
    if (idx !== -1) matchArr.push({ start: idx, end: idx + effectiveText.length, scene });
  }
  matchArr.sort((a, b) => a.start - b.start);
  const cleanMatches: MatchEntry[] = [];
  for (const m of matchArr) {
    if (cleanMatches.length === 0 || m.start >= cleanMatches[cleanMatches.length - 1].end) {
      cleanMatches.push(m);
    }
  }

  // Map sceneId → position index in script (0 = first scene in script text)
  const scriptPositionMap = new Map(cleanMatches.map((m, i) => [m.scene.id, i]));

  type Seg = { text: string; scene: Scene | null };
  const segments: Seg[] = [];
  let pos = 0;
  for (const match of cleanMatches) {
    if (match.start > pos) segments.push({ text: scriptContent.slice(pos, match.start), scene: null });
    segments.push({ text: scriptContent.slice(match.start, match.end), scene: match.scene });
    pos = match.end;
  }
  if (pos < scriptContent.length) segments.push({ text: scriptContent.slice(pos), scene: null });

  const activeSceneId: number | null = null;

  return (
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
        onContextMenu={e => {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
          const text = selection.toString().trim();
          if (!text) return;
          const range = selection.getRangeAt(0);
          if (!scriptRef.current?.contains(range.commonAncestorContainer)) return;
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, text });
        }}
      >
        {segments.map((seg, i) => {
          if (!seg.scene || !showAnnotations) return <span key={`gap-${i}`}>{seg.text}</span>;

          const sceneIdx = scriptPositionMap.get(seg.scene!.id) ?? 0;
          const isActive = activeSceneId === seg.scene.id;
          const prevSeg = segments[i - 1];
          const prevIsScene = !!prevSeg?.scene;
          const aboveEffText = prevIsScene
            ? (localScriptLines[prevSeg.scene!.id] ?? prevSeg.scene!.script_line ?? '')
            : '';
          const belowEffText = localScriptLines[seg.scene.id] ?? seg.scene.script_line ?? '';

          return (
            <React.Fragment key={seg.scene.id}>
              {prevIsScene && canEditScenes && (
                <InlineBoundaryHandle
                  aboveId={prevSeg.scene!.id}
                  belowId={seg.scene.id}
                  aboveText={aboveEffText}
                  belowText={belowEffText}
                  onUpdate={onBoundaryUpdate}
                  onCommit={onBoundaryCommit}
                />
              )}
              <span
                onClick={e => { e.stopPropagation(); onSelectScene(seg.scene!.id); }}
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const selection = window.getSelection();
                  const selectedText = selection && !selection.isCollapsed ? selection.toString().trim() : '';
                  setContextMenu({ x: e.clientX, y: e.clientY, text: selectedText, sceneId: seg.scene!.id });
                }}
                style={{
                  background: isActive
                    ? 'color-mix(in srgb, var(--gold) 40%, transparent)'
                    : seg.scene!.clipper_checked
                      ? 'color-mix(in srgb, #66BB6A 18%, transparent)'
                      : 'color-mix(in srgb, var(--gold) 14%, transparent)',
                  borderBottom: isActive
                    ? '2px solid var(--gold)'
                    : seg.scene!.clipper_checked
                      ? '1px solid color-mix(in srgb, #66BB6A 55%, transparent)'
                      : '1px solid color-mix(in srgb, var(--gold) 45%, transparent)',
                  borderRadius: '2px',
                  padding: '1px 0',
                  transition: 'background 0.2s, border-color 0.2s',
                  cursor: 'pointer',
                }}>
                <span style={{ fontSize: '8px', fontWeight: 800, color: seg.scene!.clipper_checked ? '#66BB6A' : 'var(--gold)', verticalAlign: 'super', userSelect: 'none', marginRight: '1px', lineHeight: 1 }}>
                  S{sceneIdx + 1}
                </span>
                {seg.text}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {contextMenu && (
        <div
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            minWidth: '180px', overflow: 'hidden',
          }}
        >
          {canEditScenes && contextMenu.sceneId && (
            <button
              onClick={() => { onDeleteScene(contextMenu.sceneId!); setContextMenu(null); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: '12px', fontWeight: 600, color: '#e05a4e', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >Delete scene</button>
          )}
          {canEditScenes && contextMenu.text && (
            <button
              onClick={() => { onCreateSceneFromSelection(contextMenu.text); setContextMenu(null); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: '12px', fontWeight: 600, color: 'var(--gold)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >+ Create Scene from Selection</button>
          )}
          {contextMenu.text && (
            <button
              onClick={() => { navigator.clipboard.writeText(contextMenu.text); setContextMenu(null); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >Copy</button>
          )}
        </div>
      )}

      {canEditScenes && (
        <button
          onClick={() => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || !scriptRef.current) return;
            const selectedText = selection.toString().trim();
            if (!selectedText || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            if (!scriptRef.current.contains(range.commonAncestorContainer)) return;
            onCreateSceneFromSelection(selectedText);
            selection.removeAllRanges();
          }}
          className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
        >+ Create Scene from Selection</button>
      )}
    </div>
  );
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
  const [linkingFromId, setLinkingFromId] = useState<number | null>(null);
  const [awaitingLinkName, setAwaitingLinkName] = useState<{ a: number; b: number } | null>(null);
  const [newLinkGroupName, setNewLinkGroupName] = useState('');

  // Scroll view state — default to scroll view when short is past script stage

  // Word boundary override map for real-time drag previews
  const [localScriptLines, setLocalScriptLines] = useState<Record<number, string>>({});
  const [showSceneAnnotations, setShowSceneAnnotations] = useState(true);
  const [generatingSegments, setGeneratingSegments] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

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

  const getNametagVariant = (name: string): 'nametag' | 'no-nametag' | null => {
    const lower = name.toLowerCase();
    if (lower.includes('no nametag')) return 'no-nametag';
    if (lower.includes('nametag')) return 'nametag';
    return null;
  };
  const getBaseName = (name: string) =>
    name.replace(/\s*No\s+Nametag\s*/i, '').replace(/\s*Nametag\s*/i, '').trim();

  const NametagBadge = ({ name }: { name: string }) => {
    const variant = getNametagVariant(name);
    if (!variant) return null;
    return (
      <span style={{
        fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
        padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace',
        background: variant === 'nametag' ? 'color-mix(in srgb, #666 15%, transparent)' : 'color-mix(in srgb, #999 12%, transparent)',
        color: variant === 'nametag' ? '#555' : '#888',
        border: `1px solid ${variant === 'nametag' ? '#666' : '#aaa'}`,
        flexShrink: 0,
      }}>
        {variant === 'nametag' ? 'NAMETAG' : 'NO NAMETAG'}
      </span>
    );
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

  const handleCreateSceneFromSelection = (selectedText: string) => {
    createScene({ script_line: selectedText });
  };

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

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

  const saveLinkGroup = async (sceneId: number, group: string | null) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, link_group: group } : s));
    try { await scenesApi.update(shortId, sceneId, { link_group: group }); }
    catch { loadScenes(); }
  };

  const handleLinkClick = async (sceneId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (linkingFromId === sceneId) { setLinkingFromId(null); return; }
    if (linkingFromId === null) { setLinkingFromId(sceneId); return; }
    const sceneA = scenes.find(s => s.id === linkingFromId)!;
    const sceneB = scenes.find(s => s.id === sceneId)!;
    setLinkingFromId(null);
    if (sceneA.link_group) {
      await saveLinkGroup(sceneB.id, sceneA.link_group);
    } else if (sceneB.link_group) {
      await saveLinkGroup(sceneA.id, sceneB.link_group);
    } else {
      setAwaitingLinkName({ a: sceneA.id, b: sceneB.id });
      setNewLinkGroupName('');
    }
  };

  // Scenes ordered by their position in the script text
  const sortedScenes = React.useMemo(() => {
    if (!scriptContent) return scenes;
    const withPos = scenes.map(s => ({
      scene: s,
      pos: s.script_line ? scriptContent.indexOf(s.script_line) : -1,
    }));
    withPos.sort((a, b) => {
      if (a.pos === -1 && b.pos === -1) return 0;
      if (a.pos === -1) return 1;
      if (b.pos === -1) return -1;
      return a.pos - b.pos;
    });
    return withPos.map(p => p.scene);
  }, [scenes, scriptContent]);


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
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{preset.label ? `${preset.label}. ` : ''}{getBaseName(preset.name)}</span>
                <NametagBadge name={preset.name} />
              </div>
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


  // const generateSegments = async () => {
  //   setGeneratingSegments(true);
  //   try {
  //     const segments = await scenesApi.generateSegments(shortId);
  //     const created = await scenesApi.bulkCreate(shortId, segments.map(s => ({ script_line: s, direction: '' })));
  //     setScenes(created);
  //   } catch (e: any) {
  //     alert('Segment generation failed: ' + (e?.response?.data?.error ?? e.message));
  //   } finally {
  //     setGeneratingSegments(false);
  //   }
  // };

  const handleBoundaryUpdate = (aboveId: number, belowId: number, a: string, b: string) =>
    setLocalScriptLines(prev => ({ ...prev, [aboveId]: a, [belowId]: b }));

  const handleBoundaryCommit = async (aboveId: number, belowId: number, a: string, b: string) => {
    setScenes(prev => prev.map(s =>
      s.id === aboveId ? { ...s, script_line: a } :
      s.id === belowId ? { ...s, script_line: b } : s
    ));
    setLocalScriptLines(prev => { const n = { ...prev }; delete n[aboveId]; delete n[belowId]; return n; });
    await Promise.all([
      scenesApi.update(shortId, aboveId, { script_line: a }),
      scenesApi.update(shortId, belowId, { script_line: b }),
    ]);
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading scenes...</span>
      </div>
    );
  }

  const sceneCardStyles = `
    .scene-card .scene-link-btn { opacity: 0; transition: opacity 0.15s; }
    .scene-card:hover .scene-link-btn { opacity: 1; }
    .scene-link-btn.linking-active { opacity: 1 !important; }
    .scene-card .quick-delete { opacity: 0; transition: opacity 0.15s; }
    .scene-card:hover .quick-delete { opacity: 1; }
    .quick-delete:hover { color: #c0392b !important; }
    .scene-link-btn:hover { color: var(--text-primary) !important; }
    .clip-check-empty:hover { color: #66BB6A !important; }

    .sidebar-field {
      width: 100%; background: transparent; border: none;
      border-bottom: 1.5px solid var(--border-subtle);
      color: var(--text-primary); font-family: inherit;
      font-size: 13px; line-height: 1.6;
      padding: 4px 0 2px; resize: none; overflow: hidden;
      min-height: 24px;
      outline: none; box-sizing: border-box;
      transition: border-bottom-color 0.15s;
    }
    .sidebar-field:focus { border-bottom-color: var(--gold); }
    .sidebar-field.field-clips:focus { border-bottom-color: var(--col-clips); }
    .sidebar-field.field-editing:focus { border-bottom-color: var(--col-editing); }
    .sidebar-field::placeholder { color: var(--text-muted); opacity: 0.5; }
    input.sidebar-field { height: calc(1.6em + 6px); min-height: unset; appearance: none; -webkit-appearance: none; }
    .sidebar-label {
      display: block; font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.1em;
      margin-bottom: 4px;
    }
  `;

  return (
    <React.Fragment>
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 0, flex: 1, height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Main Script Section */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Main Script
          </h3>
          <div className="flex items-center gap-2">
            {!editingScript && scriptContent && scenes.length > 0 && (
              <button
                onClick={() => setShowSceneAnnotations(v => !v)}
                style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: showSceneAnnotations ? 'var(--gold)' : 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showSceneAnnotations ? 'Scenes on' : 'Scenes off'}
              </button>
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
          <InteractiveScriptView
            scriptContent={scriptContent}
            scenes={sortedScenes}
            localScriptLines={localScriptLines}
            canEditScenes={canEditScenes}
            showAnnotations={showSceneAnnotations}
            isClippingStage={isClippingStage}
            onDeleteScene={deleteScene}
            onSelectScene={id => setExpandedScene(prev => prev === id ? null : id)}
            onBoundaryUpdate={handleBoundaryUpdate}
            onBoundaryCommit={handleBoundaryCommit}
            onCreateSceneFromSelection={handleCreateSceneFromSelection}
          />
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
      <style>{sceneCardStyles}</style>
      <div className="px-6 py-4" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Scenes ({scenes.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Generate Scenes button — disabled pending prompt review
            {canEditScenes && scriptContent?.trim() && (
              <button
                onClick={generateSegments}
                disabled={generatingSegments}
                style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--border-default)', cursor: generatingSegments ? 'default' : 'pointer', background: 'var(--bg-elevated)', color: generatingSegments ? 'var(--text-muted)' : 'var(--gold)', transition: 'all 0.15s', opacity: generatingSegments ? 0.6 : 1 }}
              >
                {generatingSegments ? '✦ Generating…' : '✦ Generate Scenes'}
              </button>
            )}
            */}
            {/* Auto-label button — disabled for now
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
            */}
            {canEditScenes && (
              <button
                onClick={() => createScene({ script_line: '', direction: '' })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', cursor: 'pointer' }}
              >
                + Add Empty Scene
              </button>
            )}
            {canEditScenes && scenes.length > 0 && (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'var(--bg-elevated)', color: '#e05a4e', border: '1px solid var(--border-default)', cursor: 'pointer' }}
              >
                Delete All
              </button>
            )}
            {/* {autoLinkResult && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '300px' }}>{autoLinkResult}</span>
            )} */}
          </div>
        </div>

        {scenes.length === 0 ? (
          <div className="p-6 rounded-lg text-center" style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-default)' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              No scenes yet. {canEditScenes ? 'Highlight text in the script above and click "Create Scene from Selection" to get started.' : ''}
            </p>
          </div>
        ) : (
          <>
            {/* Linking banner */}
            {linkingFromId !== null && (
              <div style={{ marginBottom: '10px', padding: '8px 14px', borderRadius: '8px', background: 'color-mix(in srgb, var(--gold) 10%, var(--bg-elevated))', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <span>Click another scene's link icon to group it with Scene {scenes.findIndex(s => s.id === linkingFromId) + 1}</span>
                <button onClick={() => setLinkingFromId(null)} style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
              </div>
            )}
            {/* Name prompt */}
            {awaitingLinkName && (
              <div style={{ marginBottom: '10px', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: 600 }}>Name this location group:</span>
                <input
                  autoFocus
                  type="text"
                  value={newLinkGroupName}
                  onChange={e => setNewLinkGroupName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      const name = newLinkGroupName.trim().toLowerCase().replace(/\s+/g, '_');
                      if (!name) return;
                      await saveLinkGroup(awaitingLinkName.a, name);
                      await saveLinkGroup(awaitingLinkName.b, name);
                      setAwaitingLinkName(null); setNewLinkGroupName('');
                    } else if (e.key === 'Escape') {
                      setAwaitingLinkName(null);
                    }
                  }}
                  placeholder="e.g. nether, gamerule_menu"
                  style={{ flex: 1, minWidth: '160px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-default)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                />
                <button
                  onClick={async () => {
                    const name = newLinkGroupName.trim().toLowerCase().replace(/\s+/g, '_');
                    if (!name) return;
                    await saveLinkGroup(awaitingLinkName.a, name);
                    await saveLinkGroup(awaitingLinkName.b, name);
                    setAwaitingLinkName(null); setNewLinkGroupName('');
                  }}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'var(--gold)', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >Link</button>
                <button onClick={() => setAwaitingLinkName(null)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              </div>
            )}
            {/* Grid of scene cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: expandedScene !== null ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
              gap: '8px',
            }}>
              {sortedScenes.map((scene, index) => (
                <div
                  key={scene.id}
                  onClick={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
                  className="rounded-lg transition-all scene-card"
                  style={{
                    background: expandedScene === scene.id
                      ? 'color-mix(in srgb, var(--gold) 8%, var(--bg-elevated))'
                      : isClippingStage && scene.clipper_checked
                        ? 'color-mix(in srgb, #66BB6A 8%, var(--bg-elevated))'
                        : 'var(--bg-elevated)',
                    border: linkingFromId === scene.id
                      ? '2px dashed var(--gold)'
                      : expandedScene === scene.id
                        ? '1px solid var(--gold)'
                        : isClippingStage && scene.clipper_checked
                          ? '1px solid color-mix(in srgb, #66BB6A 40%, transparent)'
                          : '1px solid var(--border-default)',
                    boxShadow: scene.link_group && linkingFromId !== scene.id && expandedScene !== scene.id
                      ? `inset 3px 0 0 ${getLinkGroupColor(scene.link_group)}`
                      : undefined,
                    opacity: (linkingFromId !== null && linkingFromId !== scene.id) ? 0.75 : 1,
                    cursor: 'pointer',
                    padding: '6px 8px',
                    minHeight: '48px',
                  }}
                >
                  {/* Scene number + saving indicator + badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--gold)' }}>
                        Scene {index + 1}
                      </span>
                      {canClipperCheck && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const val = !scene.clipper_checked;
                            setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, clipper_checked: val } : s));
                            try { await scenesApi.update(shortId, scene.id, { clipper_checked: val }); }
                            catch { loadScenes(); }
                          }}
                          title={scene.clipper_checked ? 'Mark not clipped' : 'Mark clipped'}
                          className={scene.clipper_checked ? 'clip-check' : 'clip-check clip-check-empty'}
                          style={{
                            fontSize: '10px', fontWeight: 700,
                            background: scene.clipper_checked ? '#66BB6A' : 'transparent',
                            border: scene.clipper_checked ? '1px solid #66BB6A' : 'none',
                            borderRadius: '3px', cursor: 'pointer',
                            padding: scene.clipper_checked ? '1px 4px' : '0',
                            lineHeight: 1,
                            color: scene.clipper_checked ? '#fff' : 'var(--text-muted)',
                            transition: 'all 0.15s',
                          }}
                        >
                          {scene.clipper_checked ? '✓' : '○'}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {saving === scene.id && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Saving...</span>
                      )}
                      {canEditScenes && (
                        <button
                          className="quick-delete"
                          onClick={e => { e.stopPropagation(); deleteScene(scene.id); }}
                          title="Delete scene"
                          style={{ fontSize: '13px', fontWeight: 700, color: '#e05a4e', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                        >×</button>
                      )}
                      {canEditScenes && scene.needs_rework && (
                        <span style={{ color: '#E05A4E', fontSize: '13px', lineHeight: 1 }} title="Flagged">⚑</span>
                      )}
                      {scene.preset_clip && (
                        <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: '600' }} title={scene.preset_clip.name}>
                          PRESET {scene.preset_clip.label || ''}
                        </span>
                      )}
                      {(scene.images?.length ?? 0) > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--green)' }} title={`${scene.images!.length} image${scene.images!.length > 1 ? 's' : ''}`}>
                          IMG{scene.images!.length > 1 ? ` ×${scene.images!.length}` : ''}
                        </span>
                      )}
                      {/* Link group label */}
                      {scene.link_group && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <span style={{
                            fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.04em',
                            background: `color-mix(in srgb, ${getLinkGroupColor(scene.link_group)} 18%, transparent)`,
                            color: getLinkGroupColor(scene.link_group),
                            border: `1px solid ${getLinkGroupColor(scene.link_group)}`,
                          }}>
                            {scene.link_group}
                          </span>
                          {canEditScenes && (
                            <button
                              onClick={async (e) => { e.stopPropagation(); await saveLinkGroup(scene.id, null); }}
                              title="Remove from group"
                              style={{ fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 1px', lineHeight: 1 }}
                            >×</button>
                          )}
                        </div>
                      )}
                      {/* Link icon — hidden until hover (CSS), always visible when actively linking */}
                      {canEditScenes && (
                        <button
                          onClick={(e) => handleLinkClick(scene.id, e)}
                          title={linkingFromId === scene.id ? 'Cancel' : linkingFromId !== null ? 'Link to this scene' : 'Link with another scene'}
                          className={`scene-link-btn${linkingFromId !== null ? ' linking-active' : ''}`}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '1px 2px', lineHeight: 1,
                            color: linkingFromId === scene.id ? 'var(--gold)' : 'var(--text-muted)',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Script preview (2 lines max) */}
                  <p style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    lineHeight: '1.35',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    margin: '0 0 3px 0',
                  }}>
                    {scene.script_line || <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>No script line</span>}
                  </p>

                  {/* Clipper notes (always visible on card) */}
                  {scene.clipper_notes && (
                    <div style={{ marginBottom: '3px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--col-clips)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clipper</span>
                      <p style={{
                        fontSize: '12px',
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
                      <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--col-editing)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Editor</span>
                      <p style={{
                        fontSize: '12px',
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
              ))}
            </div>
          </>
        )}
      </div>
      </div>
      {expandedScene !== null && (() => {
        const _sc = scenes.find(s => s.id === expandedScene);
        const _idx = sortedScenes.findIndex(s => s.id === expandedScene);
        if (!_sc) return null;
        const scene = _sc;
        const index = _idx;
        return (
          <div
            style={{
              width: '480px', flexShrink: 0, borderLeft: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--gold)' }}>Scene {index + 1}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {saving === scene.id && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Saving...</span>
                )}
                {canClipperCheck && (
                  <button
                    onClick={async () => {
                      const val = !scene.clipper_checked;
                      setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, clipper_checked: val } : s));
                      try { await scenesApi.update(shortId, scene.id, { clipper_checked: val }); }
                      catch { loadScenes(); }
                    }}
                    style={{
                      fontSize: '12px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                      background: scene.clipper_checked ? '#66BB6A' : 'var(--border-default)',
                      color: scene.clipper_checked ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}><polyline points="20 6 9 17 4 12"/></svg>
                    {scene.clipper_checked ? 'Uncheck' : 'Check'}
                  </button>
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
                  ✕ Close
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="sidebar-label" style={{ color: 'var(--text-muted)' }}>Script</label>
              {canEditScenes ? (
                <textarea
                  key={`script-${scene.id}`}
                  rows={1}
                  className="sidebar-field"
                  value={scene.script_line}
                  onChange={(e) => updateScene(scene.id, { script_line: e.target.value })}
                  onInput={e => autoResize(e.target as HTMLTextAreaElement)}
                  ref={autoResize}
                  style={{ fontWeight: '600', fontSize: '14px' }}
                  placeholder="Script narration for this scene..."
                />
              ) : (
                <p style={{ fontSize: '14px', fontWeight: '600', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {scene.script_line || <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>No script line</span>}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="sidebar-label" style={{ color: 'var(--col-clips)' }}>Clipper Notes</label>
              {canEditScenes ? (
                <textarea
                  key={`clips-${scene.id}`}
                  rows={1}
                  className="sidebar-field field-clips"
                  value={scene.clipper_notes || ''}
                  onChange={(e) => updateScene(scene.id, { clipper_notes: e.target.value || null })}
                  onInput={e => autoResize(e.target as HTMLTextAreaElement)}
                  ref={autoResize}
                  placeholder="Notes for the clipper..."
                />
              ) : (
                <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {scene.clipper_notes || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="sidebar-label" style={{ color: 'var(--col-editing)' }}>Editor Notes</label>
              {canEditScenes ? (
                <textarea
                  key={`editing-${scene.id}`}
                  rows={1}
                  className="sidebar-field field-editing"
                  value={scene.editor_notes || ''}
                  onChange={(e) => updateScene(scene.id, { editor_notes: e.target.value || null })}
                  onInput={e => autoResize(e.target as HTMLTextAreaElement)}
                  ref={autoResize}
                  placeholder="Notes for the editor..."
                />
              ) : (
                <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {scene.editor_notes || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="sidebar-label" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Link Group
                {scene.link_group && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: getLinkGroupColor(scene.link_group) }} />}
              </label>
              {canEditScenes ? (
                <input
                  className="sidebar-field"
                  type="text"
                  value={scene.link_group || ''}
                  onChange={e => updateScene(scene.id, { link_group: e.target.value || null })}
                  placeholder="e.g. nether, gamerule_menu"
                  style={{ fontSize: '13px' }}
                />
              ) : (
                <span style={{ fontSize: '13px', color: scene.link_group ? 'var(--text-primary)' : 'var(--text-muted)' }}>{scene.link_group || '—'}</span>
              )}
            </div>

            {renderPresetSection(scene)}

            {((scene.images?.length ?? 0) > 0 || canEditScenes) && (
              <div>
                <label className="sidebar-label" style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Scene Media</label>
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
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px', borderRadius: '7px', border: '1px dashed var(--border-strong)',
                    background: 'var(--bg-base)', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)',
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

            {/* Prev / Next navigation — pinned to bottom */}
            <div style={{ display: 'flex', gap: '8px', padding: '12px 20px', borderTop: '1px solid var(--border-default)', flexShrink: 0 }}>
              <button
                onClick={() => {
                  if (index > 0) setExpandedScene(sortedScenes[index - 1].id);
                }}
                disabled={index <= 0}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: '8px', border: '1px solid var(--border-default)',
                  background: index <= 0 ? 'transparent' : 'var(--bg-base)',
                  color: index <= 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: index <= 0 ? 'not-allowed' : 'pointer',
                  fontSize: '13px', fontWeight: 600,
                }}
              >← Prev</button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {index + 1} / {sortedScenes.length}
              </span>
              <button
                onClick={() => {
                  if (index < sortedScenes.length - 1) setExpandedScene(sortedScenes[index + 1].id);
                }}
                disabled={index >= sortedScenes.length - 1}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: '8px', border: '1px solid var(--border-default)',
                  background: index >= sortedScenes.length - 1 ? 'transparent' : 'var(--bg-base)',
                  color: index >= sortedScenes.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: index >= sortedScenes.length - 1 ? 'not-allowed' : 'pointer',
                  fontSize: '13px', fontWeight: 600,
                }}
              >Next →</button>
            </div>
          </div>
        );
      })()}
    </div>

    <ConfirmDialog
      isOpen={confirmDeleteAll}
      onClose={() => setConfirmDeleteAll(false)}
      onConfirm={async () => {
        await scenesApi.bulkCreate(shortId, []);
        setScenes([]);
      }}
      title="Delete all scenes"
      message={`This will permanently delete all ${scenes.length} scene${scenes.length !== 1 ? 's' : ''}. This cannot be undone.`}
      confirmText="Delete All"
      variant="danger"
    />
    </React.Fragment>
  );
}
