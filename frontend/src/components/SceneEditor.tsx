import { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, SceneImage, CreateSceneInput, UpdateSceneInput } from '../../../shared/types';
import { scenesApi, filesApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface SceneEditorProps {
  shortId: number;
  scriptContent: string;
  onScriptContentChange: (content: string) => void;
  isAdmin: boolean;
}

export default function SceneEditor({ shortId, scriptContent, onScriptContentChange, isAdmin }: SceneEditorProps) {
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

  const canEditScenes = isAdmin || user?.roles?.includes('script_writer') || false;

  useEffect(() => {
    loadScenes();
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
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...input } : s));

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
    try {
      const uploadUrlData = await filesApi.getUploadUrl(
        shortId,
        'scene_image',
        file.name,
        file.size,
        file.type
      );
      await filesApi.uploadDirectToGCS(uploadUrlData.upload_url, file);
      const newImage: SceneImage = await scenesApi.addImage(shortId, sceneId, uploadUrlData.bucket_path);
      setScenes(prev => prev.map(s =>
        s.id === sceneId ? { ...s, images: [...(s.images || []), newImage] } : s
      ));
      // Fetch signed URL for new image immediately
      scenesApi.getSceneImageUrl(shortId, sceneId, newImage.id)
        .then(url => setImageSignedUrls(prev => ({ ...prev, [newImage.id]: url })))
        .catch(() => {});
    } catch (error) {
      console.error('Failed to upload image:', error);
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

    return segments.map((seg, i) => (
      <span
        key={i}
        style={seg.highlighted ? {
          background: 'color-mix(in srgb, var(--gold) 20%, transparent)',
          borderBottom: '2px solid var(--gold)',
          borderRadius: '2px',
          padding: '1px 0',
        } : undefined}
        title={seg.highlighted ? `Scene ${(seg.sceneIndex ?? 0) + 1}` : undefined}
      >
        {seg.text}
      </span>
    ));
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
          {canEditScenes && (
            <button
              onClick={() => createScene({ script_line: '', direction: '' })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', cursor: 'pointer' }}
            >
              + Add Empty Scene
            </button>
          )}
        </div>

        {scenes.length === 0 ? (
          <div className="p-6 rounded-lg text-center" style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-default)' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              No scenes yet. {canEditScenes ? 'Highlight text in the script above and click "Create Scene from Selection" to get started.' : ''}
            </p>
          </div>
        ) : (
          <>
            {/* Grid of scene cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
              marginBottom: expandedScene !== null ? '12px' : '0',
            }}>
              {scenes.map((scene, index) => (
                <div
                  key={scene.id}
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
                    opacity: draggedScene === scene.id ? 0.5 : 1,
                    cursor: 'pointer',
                    padding: '10px 12px',
                    minHeight: '80px',
                  }}
                >
                  {/* Scene number + saving indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {canEditScenes && (
                        <span style={{ cursor: 'grab', fontSize: '13px', color: 'var(--text-muted)' }} title="Drag to reorder">⠿</span>
                      )}
                      <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--gold)' }}>
                        Scene {index + 1}
                      </span>
                    </div>
                    {saving === scene.id && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Saving...</span>
                    )}
                    {(scene.images?.length ?? 0) > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--green)' }} title={`${scene.images!.length} image${scene.images!.length > 1 ? 's' : ''}`}>
                        IMG{scene.images!.length > 1 ? ` ×${scene.images!.length}` : ''}
                      </span>
                    )}
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
              ))}
            </div>

            {/* Expanded scene panel (full width below grid) */}
            {expandedScene !== null && (() => {
              const scene = scenes.find(s => s.id === expandedScene);
              if (!scene) return null;
              const sceneIndex = scenes.findIndex(s => s.id === expandedScene);

              return (
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--gold)',
                    borderRadius: '10px',
                    padding: '20px',
                    marginTop: '12px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--gold)' }}>Scene {sceneIndex + 1}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {saving === scene.id && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Saving...</span>
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

                  {/* Scene Images */}
                  {((scene.images?.length ?? 0) > 0 || canEditScenes) && (
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scene Images</label>
                      {(scene.images?.length ?? 0) > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                          {scene.images!.map(img => (
                            <div key={img.id} style={{ position: 'relative', display: 'inline-block' }}>
                              {imageSignedUrls[img.id] ? (
                                <img
                                  src={imageSignedUrls[img.id]}
                                  alt="Scene reference"
                                  style={{ maxWidth: '220px', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--border-default)', objectFit: 'contain', display: 'block' }}
                                />
                              ) : (
                                <div style={{ width: '120px', height: '90px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                                  Loading…
                                </div>
                              )}
                              {canEditScenes && (
                                <button
                                  onClick={() => handleDeleteImage(scene.id, img.id)}
                                  style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', lineHeight: 1 }}
                                  title="Remove image"
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
                          Add Image
                          <input
                            type="file"
                            accept="image/*"
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
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
