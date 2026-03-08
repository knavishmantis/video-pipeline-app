import { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, CreateSceneInput, UpdateSceneInput } from '../../../shared/types';
import { scenesApi } from '../services/api';
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
  const [expandedNotes, setExpandedNotes] = useState<Record<number, 'clipper' | 'editor' | null>>({});
  const [draggedScene, setDraggedScene] = useState<number | null>(null);
  const [dragOverScene, setDragOverScene] = useState<number | null>(null);
  const scriptRef = useRef<HTMLDivElement>(null);
  const saveTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const isClipper = user?.roles?.includes('clipper') || false;
  const isEditor = user?.roles?.includes('editor') || false;
  const canEditScenes = isAdmin || user?.roles?.includes('script_writer') || false;

  useEffect(() => {
    loadScenes();
  }, [shortId]);

  useEffect(() => {
    setScriptDraft(scriptContent);
  }, [scriptContent]);

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

    // Check that selection is within the script area
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
    // Optimistic update
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...input } : s));

    // Debounced save
    if (saveTimeouts.current[sceneId]) {
      clearTimeout(saveTimeouts.current[sceneId]);
    }
    saveTimeouts.current[sceneId] = setTimeout(async () => {
      setSaving(sceneId);
      try {
        await scenesApi.update(shortId, sceneId, input);
      } catch (error) {
        console.error('Failed to update scene:', error);
        loadScenes(); // Reload on error
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

  // Get highlighted portions of script
  const getHighlightedScript = () => {
    if (!scriptContent) return null;
    const scriptLines = scenes.map(s => s.script_line).filter(Boolean);

    if (scriptLines.length === 0) {
      return <span>{scriptContent}</span>;
    }

    // Build segments - find each script_line in the content and mark it
    type Segment = { text: string; highlighted: boolean; sceneIndex?: number };
    const segments: Segment[] = [];
    let remaining = scriptContent;
    let currentPos = 0;

    // Sort scene matches by position in script to process left-to-right
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

    // Remove overlapping matches (keep first)
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

      {/* Scenes Section */}
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
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No scenes yet. {canEditScenes ? 'Highlight text in the script above and click "Create Scene from Selection" to get started.' : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scenes.map((scene, index) => (
              <div
                key={scene.id}
                draggable={canEditScenes}
                onDragStart={() => handleDragStart(scene.id)}
                onDragOver={(e) => handleDragOver(e, scene.id)}
                onDrop={() => handleDrop(scene.id)}
                onDragEnd={() => { setDraggedScene(null); setDragOverScene(null); }}
                className="rounded-lg transition-all"
                style={{
                  background: 'var(--bg-elevated)',
                  border: dragOverScene === scene.id
                    ? '2px solid var(--gold)'
                    : '1px solid var(--border-default)',
                  opacity: draggedScene === scene.id ? 0.5 : 1,
                }}
              >
                {/* Scene Header */}
                <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-2">
                    {canEditScenes && (
                      <span className="cursor-grab text-sm" style={{ color: 'var(--text-muted)' }} title="Drag to reorder">
                        ⠿
                      </span>
                    )}
                    <span className="text-xs font-bold" style={{ color: 'var(--gold)' }}>
                      Scene {index + 1}
                    </span>
                    {saving === scene.id && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Saving...</span>
                    )}
                  </div>
                  {canEditScenes && (
                    <button
                      onClick={() => deleteScene(scene.id)}
                      className="px-2 py-1 rounded text-xs transition-opacity hover:opacity-70"
                      style={{ color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Script Line */}
                <div className="px-4 pt-3 pb-2">
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Script Line</label>
                  {canEditScenes ? (
                    <textarea
                      value={scene.script_line}
                      onChange={(e) => updateScene(scene.id, { script_line: e.target.value })}
                      className="w-full p-2 rounded text-sm leading-relaxed resize-y focus:outline-none"
                      style={{
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        minHeight: '40px',
                      }}
                      placeholder="Script narration for this scene..."
                    />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                      {scene.script_line || <span style={{ color: 'var(--text-muted)' }}>No script line</span>}
                    </p>
                  )}
                </div>

                {/* Direction */}
                <div className="px-4 pb-3">
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Editing Direction</label>
                  {canEditScenes ? (
                    <textarea
                      value={scene.direction}
                      onChange={(e) => updateScene(scene.id, { direction: e.target.value })}
                      className="w-full p-2 rounded text-sm leading-relaxed resize-y focus:outline-none"
                      style={{
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                        minHeight: '40px',
                      }}
                      placeholder="What should the editor/clipper show for this scene..."
                    />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                      {scene.direction || <span style={{ color: 'var(--text-muted)' }}>No direction</span>}
                    </p>
                  )}
                </div>

                {/* Clipper / Editor Notes */}
                <div className="px-4 pb-3 flex gap-2">
                  {/* Clipper Notes Toggle */}
                  <button
                    onClick={() => setExpandedNotes(prev => ({
                      ...prev,
                      [scene.id]: prev[scene.id] === 'clipper' ? null : 'clipper',
                    }))}
                    className="px-2 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80"
                    style={{
                      background: expandedNotes[scene.id] === 'clipper' ? 'color-mix(in srgb, var(--col-clips) 15%, transparent)' : 'var(--bg-base)',
                      color: scene.clipper_notes ? 'var(--col-clips)' : 'var(--text-muted)',
                      border: `1px solid ${scene.clipper_notes ? 'var(--col-clips-border)' : 'var(--border-default)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    Clipper Notes {scene.clipper_notes ? '(has notes)' : ''}
                  </button>

                  {/* Editor Notes Toggle */}
                  <button
                    onClick={() => setExpandedNotes(prev => ({
                      ...prev,
                      [scene.id]: prev[scene.id] === 'editor' ? null : 'editor',
                    }))}
                    className="px-2 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80"
                    style={{
                      background: expandedNotes[scene.id] === 'editor' ? 'color-mix(in srgb, var(--col-editing) 15%, transparent)' : 'var(--bg-base)',
                      color: scene.editor_notes ? 'var(--col-editing)' : 'var(--text-muted)',
                      border: `1px solid ${scene.editor_notes ? 'var(--col-editing-border)' : 'var(--border-default)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    Editor Notes {scene.editor_notes ? '(has notes)' : ''}
                  </button>
                </div>

                {/* Expanded Notes Area */}
                {expandedNotes[scene.id] === 'clipper' && (
                  <div className="px-4 pb-3">
                    <div className="p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--col-clips) 8%, var(--bg-base))', border: '1px solid var(--col-clips-border)' }}>
                      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--col-clips)' }}>Clipper Notes</label>
                      {isAdmin || isClipper ? (
                        <textarea
                          value={scene.clipper_notes || ''}
                          onChange={(e) => updateScene(scene.id, { clipper_notes: e.target.value || null })}
                          className="w-full p-2 rounded text-sm resize-y focus:outline-none"
                          style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', minHeight: '60px' }}
                          placeholder="Add notes about this scene..."
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                          {scene.clipper_notes || 'No notes yet'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {expandedNotes[scene.id] === 'editor' && (
                  <div className="px-4 pb-3">
                    <div className="p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--col-editing) 8%, var(--bg-base))', border: '1px solid var(--col-editing-border)' }}>
                      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--col-editing)' }}>Editor Notes</label>
                      {isAdmin || isEditor ? (
                        <textarea
                          value={scene.editor_notes || ''}
                          onChange={(e) => updateScene(scene.id, { editor_notes: e.target.value || null })}
                          className="w-full p-2 rounded text-sm resize-y focus:outline-none"
                          style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', minHeight: '60px' }}
                          placeholder="Add notes about this scene..."
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                          {scene.editor_notes || 'No notes yet'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
