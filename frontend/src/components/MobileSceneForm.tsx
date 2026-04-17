import { useEffect, useRef, useState } from 'react';

export interface MobileSceneFormValues {
  script_line: string;
  clipper_notes: string;
  editor_notes: string;
}

interface MobileSceneFormProps {
  mode: 'create' | 'edit';
  sceneNumber?: number;
  initial?: Partial<MobileSceneFormValues>;
  scriptContent?: string;
  onCancel: () => void;
  onSave: (values: MobileSceneFormValues) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '16px',
  lineHeight: 1.45,
  padding: '12px',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: '8px',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  resize: 'vertical',
  scrollMarginTop: '80px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '4px',
  color: 'var(--text-muted)',
};

export function MobileSceneForm({
  mode,
  sceneNumber,
  initial,
  scriptContent,
  onCancel,
  onSave,
  onDelete,
}: MobileSceneFormProps) {
  const [scriptLine, setScriptLine] = useState(initial?.script_line ?? '');
  const [clipperNotes, setClipperNotes] = useState(initial?.clipper_notes ?? '');
  const [editorNotes, setEditorNotes] = useState(initial?.editor_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(true);
  const scriptRef = useRef<HTMLTextAreaElement | null>(null);
  const hasScriptRef = !!scriptContent && scriptContent.trim().length > 0;

  useEffect(() => {
    if (mode === 'create') {
      scriptRef.current?.focus();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mode]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        script_line: scriptLine,
        clipper_notes: clipperNotes,
        editor_notes: editorNotes,
      });
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'create'
    ? 'New Scene'
    : `Scene${sceneNumber != null ? ` ${sceneNumber}` : ''}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-base)',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            background: 'transparent',
            border: 'none',
            padding: '6px 8px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)' }}>{title}</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--gold)',
            background: 'transparent',
            border: 'none',
            padding: '6px 8px',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 12px 96px',
        }}
      >
        {hasScriptRef && (
          <div style={{ marginBottom: '18px' }}>
            <button
              type="button"
              onClick={() => setScriptOpen(v => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                padding: 0,
                marginBottom: '6px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
              aria-expanded={scriptOpen}
            >
              <span style={{ display: 'inline-block', width: '10px', transition: 'transform 0.15s', transform: scriptOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
              Main Script
            </button>
            {scriptOpen && (
              <div
                style={{
                  maxHeight: '34vh',
                  overflowY: 'auto',
                  padding: '12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  WebkitUserSelect: 'text',
                  userSelect: 'text',
                }}
              >
                {scriptContent}
              </div>
            )}
          </div>
        )}

        <label style={labelStyle}>Script</label>
        <textarea
          ref={scriptRef}
          value={scriptLine}
          onChange={(e) => setScriptLine(e.target.value)}
          rows={3}
          placeholder="Script narration for this scene…"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          inputMode="text"
          style={{ ...textareaStyle, marginBottom: '18px', minHeight: '80px' }}
        />

        <label style={{ ...labelStyle, color: 'var(--col-clips)' }}>Clipper Notes</label>
        <textarea
          value={clipperNotes}
          onChange={(e) => setClipperNotes(e.target.value)}
          rows={5}
          placeholder="Notes for the clipper…"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          inputMode="text"
          style={{ ...textareaStyle, marginBottom: '18px', minHeight: '120px' }}
        />

        <label style={{ ...labelStyle, color: 'var(--col-editing)' }}>Editor Notes</label>
        <textarea
          value={editorNotes}
          onChange={(e) => setEditorNotes(e.target.value)}
          rows={3}
          placeholder="Notes for the editor…"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          inputMode="text"
          style={{ ...textareaStyle, minHeight: '80px' }}
        />

        {mode === 'edit' && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            style={{
              marginTop: '28px',
              width: '100%',
              padding: '12px',
              background: 'transparent',
              color: '#E05A4E',
              border: '1px solid #E05A4E',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Delete Scene
          </button>
        )}
      </div>
    </div>
  );
}
