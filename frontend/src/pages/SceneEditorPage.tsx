import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { shortsApi, scenesApi } from '../services/api';
import { Short, Scene } from '../../../shared/types';
import SceneEditor from '../components/SceneEditor';
import jsPDF from 'jspdf';
import { LintIssue } from '../services/api';

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function exportScriptPdf(title: string, scriptContent: string, scenes: Scene[], imageDataUrls: Record<number, string>) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 72;
  const marginRight = 72;
  const maxWidth = pageWidth - marginLeft - marginRight;
  const bottomMargin = 72;
  let y = 72;

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - bottomMargin) {
      // Footer before new page
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(title, marginLeft, pageHeight - 30);
      doc.text(String(doc.getNumberOfPages()), pageWidth - marginRight, pageHeight - 30, { align: 'right' });
      doc.addPage();
      y = 72;
    }
  };

  const writeWrapped = (text: string, fontSize: number, style: 'normal' | 'bold' | 'italic', indent: number = 0) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', style);
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    for (const line of lines) {
      checkPage(fontSize * 1.4);
      doc.text(line, marginLeft + indent, y);
      y += fontSize * 1.4;
    }
  };

  // Title
  writeWrapped(title, 26, 'bold');
  y += 20;

  // Main Script section
  writeWrapped('Main Script:', 18, 'bold');
  y += 8;

  if (scriptContent) {
    const paragraphs = scriptContent.split(/\n\n+/);
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed) {
        writeWrapped(trimmed, 11, 'normal');
        y += 8;
      }
    }
  }

  y += 16;

  // Editing & Clipper Script section
  writeWrapped('Editing & Clipper Script:', 18, 'bold');
  y += 8;

  // Check for any general editor notes (scenes without script_line that have editor_notes)
  // Then numbered scenes
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const num = i + 1;

    // Numbered script line
    checkPage(40);
    writeWrapped(`${num}. ${scene.script_line || '(no script line)'}`, 11, 'normal', 20);
    y += 2;

    // Clipper notes
    if (scene.clipper_notes) {
      writeWrapped('a. Clipper:', 11, 'bold', 40);
      writeWrapped(`i. ${scene.clipper_notes}`, 11, 'normal', 60);
      y += 2;
    }

    // Editor notes
    if (scene.editor_notes) {
      const editorLabel = scene.clipper_notes ? 'b' : 'a';
      writeWrapped(`${editorLabel}. Editor:`, 11, 'bold', 40);
      writeWrapped(`i. ${scene.editor_notes}`, 11, 'normal', 60);
      y += 2;
    }

    // Scene image
    const imgData = imageDataUrls[scene.id];
    if (imgData) {
      const imgMaxWidth = maxWidth - 40;
      const imgMaxHeight = 200;
      // Use a temporary image to get aspect ratio
      try {
        const imgProps = doc.getImageProperties(imgData);
        const ratio = imgProps.width / imgProps.height;
        let imgW = Math.min(imgMaxWidth, imgProps.width);
        let imgH = imgW / ratio;
        if (imgH > imgMaxHeight) {
          imgH = imgMaxHeight;
          imgW = imgH * ratio;
        }
        checkPage(imgH + 20);
        doc.addImage(imgData, 'PNG', marginLeft + 40, y, imgW, imgH);
        y += imgH + 8;
      } catch {
        // Skip image if it can't be embedded
      }
    }

    y += 6;
  }

  // Final page footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(title, marginLeft, pageHeight - 30);
  doc.text(String(doc.getNumberOfPages()), pageWidth - marginRight, pageHeight - 30, { align: 'right' });

  // Generate filename
  const safeName = title.replace(/[^a-zA-Z0-9]+/g, '') || 'Script';
  doc.save(`${safeName}-EditingScript.pdf`);
}

export default function SceneEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [short, setShort] = useState<Short | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lintResults, setLintResults] = useState<LintIssue[] | null>(null);
  const [lintLoading, setLintLoading] = useState(false);
  const [isEditingScript, setIsEditingScript] = useState(false);

  const isAdmin = user?.roles?.includes('admin') || false;

  useEffect(() => {
    loadShort();
  }, [id]);

  const loadShort = async () => {
    if (!id) return;
    try {
      const data = await shortsApi.getById(parseInt(id));
      setShort(data);
    } catch (error) {
      console.error('Failed to load short:', error);
    } finally {
      setLoading(false);
    }
  };

  const isScriptInProgress = short?.status === 'idea' || short?.status === 'script';
  const isScriptDone = short?.status === 'script';
  const canMarkComplete = isAdmin || user?.roles?.includes('script_writer');

  const handleToggleComplete = async () => {
    if (!short) return;
    setMarking(true);
    setError(null);
    try {
      // Toggle between idea (script not started/in progress) and script (script done)
      const newStatus = short.status === 'idea' ? 'script' : 'idea';
      await shortsApi.update(short.id, { status: newStatus });
      setShort({ ...short, status: newStatus as any });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to toggle script complete';
      setError(msg);
      console.error('Failed to toggle script complete:', err);
    } finally {
      setMarking(false);
    }
  };

  const handleAnalyzeScript = async () => {
    if (!short) return;
    setLintLoading(true);
    setLintResults(null);
    try {
      const { issues } = await shortsApi.analyzeScript(short.id);
      setLintResults(issues);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Script analysis failed';
      console.error('Script analysis failed:', msg, e?.response?.data);
    } finally {
      setLintLoading(false);
    }
  };

  const handleExportPdf = async () => {
    if (!short) return;
    try {
      const scenes = await scenesApi.getAll(short.id);
      // Fetch image data URLs for scenes with images
      const imageDataUrls: Record<number, string> = {};
      const imagePromises = scenes
        .filter(s => s.image_url)
        .map(async (s) => {
          try {
            const signedUrl = await scenesApi.getImageUrl(short.id, s.id);
            const dataUrl = await fetchImageAsDataUrl(signedUrl);
            if (dataUrl) imageDataUrls[s.id] = dataUrl;
          } catch { /* skip */ }
        });
      await Promise.all(imagePromises);
      exportScriptPdf(short.title, short.script_content || '', scenes, imageDataUrls);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</span>
      </div>
    );
  }

  if (!short) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Short not found</span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col flex-1" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
            }}
          >
            &larr; Back to Dashboard
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {isAdmin || user?.roles?.includes('script_writer') ? 'Scene Editor' : 'Scene Viewer'} — {short.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {short.script_content && (
            <button
              onClick={handleAnalyzeScript}
              disabled={lintLoading || isEditingScript}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
              style={{
                background: lintResults !== null ? 'color-mix(in srgb, var(--gold) 15%, var(--bg-elevated))' : 'var(--bg-elevated)',
                color: lintResults !== null ? 'var(--gold)' : 'var(--text-primary)',
                border: `1px solid ${lintResults !== null ? 'var(--gold)' : 'var(--border-default)'}`,
                cursor: (lintLoading || isEditingScript) ? 'not-allowed' : 'pointer',
                opacity: (lintLoading || isEditingScript) ? 0.4 : 1,
              }}
            >
              {lintLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              )}
              {lintLoading ? 'Analyzing...' : 'Analyze Script'}
            </button>
          )}
          <button
            onClick={handleExportPdf}
            className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export as PDF
          </button>
          {canMarkComplete && isScriptInProgress && (
            <button
              onClick={handleToggleComplete}
              disabled={marking}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
                cursor: marking ? 'not-allowed' : 'pointer',
                opacity: marking ? 0.6 : 1,
              }}
            >
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Script Complete</span>
              {/* Toggle track */}
              <span
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '36px',
                  height: '20px',
                  borderRadius: '10px',
                  background: !isScriptDone ? 'var(--bg-base)' : 'var(--green)',
                  border: `1px solid ${!isScriptDone ? 'var(--border-default)' : 'var(--green)'}`,
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                {/* Toggle knob */}
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: !isScriptDone ? '2px' : '16px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: !isScriptDone ? 'var(--text-muted)' : '#fff',
                    transition: 'left 0.2s, background 0.2s',
                  }}
                />
              </span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)', border: '1px solid var(--red)' }}>
          {error}
        </div>
      )}

      {/* Script Lint Results */}
      {lintResults !== null && (
        <div className="mb-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: lintResults.length > 0 ? '1px solid var(--border-default)' : undefined }}>
            <div className="flex items-center gap-2">
              {lintResults.length === 0 ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--green)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--gold)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              )}
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {lintResults.length === 0 ? 'Script looks clean' : `${lintResults.length} issue${lintResults.length > 1 ? 's' : ''} found`}
              </span>
            </div>
            <button
              onClick={() => setLintResults(null)}
              className="text-xs transition-opacity hover:opacity-80"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              dismiss
            </button>
          </div>
          {lintResults.length > 0 && (
            <div className="p-3 flex flex-col gap-2">
              {lintResults.map((issue, i) => {
                const color = issue.type === 'error' ? 'var(--red)' : issue.type === 'warning' ? 'var(--gold)' : 'var(--text-muted)';
                return (
                  <div key={i} className="rounded-lg p-3" style={{ background: `color-mix(in srgb, ${color} 8%, var(--bg-elevated))`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold mt-0.5 shrink-0" style={{ color }}>{issue.check}</span>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{issue.message}</span>
                    </div>
                    {issue.matches && issue.matches.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {issue.matches.map((m, j) => (
                          <span key={j} className="text-xs font-mono px-2 py-1 rounded" style={{ background: `color-mix(in srgb, ${color} 12%, var(--bg-base))`, color: 'var(--text-primary)' }}>
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Scene Editor */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <SceneEditor
          shortId={short.id}
          shortStatus={short.status}
          scriptContent={short.script_content || ''}
          researchBrief={short.research_brief || undefined}
          onScriptContentChange={async (content) => {
            try {
              await shortsApi.update(short.id, { script_content: content });
              loadShort();
            } catch (error) {
              console.error('Failed to save script:', error);
            }
          }}
          isAdmin={isAdmin}
          onEditingScriptChange={setIsEditingScript}
        />
      </div>
    </div>
  );
}
