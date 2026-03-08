import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Short, Assignment, User, File as FileInterface } from '../../../shared/types';
import { ColumnType } from '../utils/dashboardUtils';
import { TimezoneDisplay } from './TimezoneDisplay';

interface ContentModalProps {
  isOpen: boolean;
  contentShort: Short | null;
  contentColumn: ColumnType | null;
  contentForm: {
    script_content: string;
    file: File | null;
    scriptFile: File | null;
    audioFile: File | null;
  };
  uploading: boolean;
  uploadProgress: number | null;
  downloading: number | null;
  downloadProgress: number | null;
  assignments: Assignment[];
  user: User | null;
  isAdmin: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onFormChange: (form: {
    script_content: string;
    file: File | null;
    scriptFile: File | null;
    audioFile: File | null;
  }) => void;
  onDownloadFile: (file: FileInterface) => Promise<void>;
  onDeleteFile: (fileId: number) => Promise<void>;
  onMarkComplete: (shortId: number, column: ColumnType) => Promise<void>;
  showAlert: (message: string, options?: { type?: 'success' | 'error' | 'warning' | 'info' }) => void;
  loadData: () => Promise<void>;
  setContentShort: (short: Short | null) => void;
}

// ── Shared sub-components ────────────────────────────────────────────

/** A labelled section card */
function SectionCard({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      marginBottom: '14px',
      borderRadius: '8px',
      border: '1px solid var(--border-default)',
      overflow: 'hidden',
    }}>
      {label && (
        <div style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-elevated)',
          fontSize: '10px',
          fontWeight: '700',
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          color: 'var(--text-muted)',
        }}>
          {label}
        </div>
      )}
      <div style={{ padding: '14px', background: 'var(--bg-surface)' }}>
        {children}
      </div>
    </div>
  );
}

/** A file download row */
function DownloadRow({
  label,
  file,
  downloading,
  downloadProgress,
  onDownload,
}: {
  label: string;
  file: FileInterface;
  downloading: number | null;
  downloadProgress: number | null;
  onDownload: (f: FileInterface) => void;
}) {
  const isActive = downloading === file.id;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid var(--border-default)',
    }}
    className="download-row-last-no-border"
    >
      <div>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '1px' }}>
          {label}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {file.file_name}
          {file.file_size && (
            <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
              {(file.file_size / (1024 * 1024)).toFixed(1)} MB
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDownload(file)}
        disabled={isActive}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          background: 'var(--gold-dim)',
          color: 'var(--gold)',
          border: '1px solid var(--gold-border)',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: '600',
          cursor: isActive ? 'not-allowed' : 'pointer',
          opacity: isActive ? 0.6 : 1,
          flexShrink: 0,
          transition: 'opacity 0.15s',
        }}
      >
        {isActive ? (
          <svg style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
        {isActive && downloadProgress !== null ? `${downloadProgress}%` : 'Download'}
      </button>
    </div>
  );
}

/** A file input styled to match the theme */
function FileInput({
  label,
  accept,
  required,
  disabled,
  onChange,
}: {
  label: string;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (f: File | null) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{
        display: 'block',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.07em',
        textTransform: 'uppercase' as const,
        color: 'var(--text-muted)',
        marginBottom: '6px',
      }}>
        {label}{required && <span style={{ color: 'var(--gold)', marginLeft: '2px' }}>*</span>}
      </label>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: '7px',
        border: '1px dashed var(--border-strong)',
        background: 'var(--bg-elevated)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'border-color 0.15s, background 0.15s',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span style={{ fontSize: '12px', color: fileName ? 'var(--text-primary)' : 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName || 'Choose file…'}
        </span>
        <input
          type="file"
          accept={accept}
          required={required}
          disabled={disabled}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setFileName(f ? f.name : null);
            onChange(f);
          }}
        />
      </label>
    </div>
  );
}

/** A compact pill button to download a file */
function CompactDownloadPill({
  label,
  file,
  downloading,
  downloadProgress,
  onDownload,
}: {
  label: string;
  file: FileInterface;
  downloading: number | null;
  downloadProgress: number | null;
  onDownload: (f: FileInterface) => void;
}) {
  const isActive = downloading === file.id;
  return (
    <button
      type="button"
      onClick={() => onDownload(file)}
      disabled={isActive}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '5px 12px',
        background: isActive ? 'var(--gold-dim)' : 'var(--bg-elevated)',
        color: isActive ? 'var(--gold)' : 'var(--text-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: '600',
        cursor: isActive ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      title={file.file_name}
      onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; (e.currentTarget as HTMLElement).style.background = 'var(--gold-dim)'; } }}
      onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; } }}
    >
      {isActive ? (
        <svg style={{ width: '11px', height: '11px', animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      {isActive && downloadProgress !== null ? `${downloadProgress}%` : label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────

export function ContentModal({
  isOpen,
  contentShort,
  contentColumn,
  contentForm,
  uploading,
  uploadProgress,
  downloading,
  downloadProgress,
  assignments,
  user,
  isAdmin,
  onClose,
  onSubmit,
  onFormChange,
  onDownloadFile,
  onDeleteFile,
  onMarkComplete,
  showAlert,
  loadData,
  setContentShort,
}: ContentModalProps) {
  if (!isOpen || !contentShort || !contentColumn) return null;

  // ── Helpers ──────────────────────────────────────────────────────

  const handleMarkComplete = async () => {
    if (!contentShort) return;
    const hasRequiredFile =
      contentColumn === 'clips' || contentColumn === 'clip_changes'
        ? contentShort.files?.some((f) => f.file_type === 'clips_zip')
        : contentShort.files?.some((f) => f.file_type === 'final_video');

    if (!hasRequiredFile) {
      showAlert(
        contentColumn === 'clips' || contentColumn === 'clip_changes'
          ? 'Cannot mark complete. Clips ZIP file is required.'
          : 'Cannot mark complete. Final video file is required.',
        { type: 'warning' }
      );
      return;
    }
    const shortAssignments = assignments.filter((a) => a.short_id === contentShort.id);
    const relevantAssignment =
      contentColumn === 'clips' || contentColumn === 'clip_changes'
        ? shortAssignments.find((a) => a.role === 'clipper')
        : shortAssignments.find((a) => a.role === 'editor');

    if (!relevantAssignment) {
      showAlert(
        contentColumn === 'clips' || contentColumn === 'clip_changes'
          ? 'Cannot mark complete. No clipper assignment found.'
          : 'Cannot mark complete. No editor assignment found.',
        { type: 'error' }
      );
      return;
    }
    try {
      await onMarkComplete(contentShort.id, contentColumn);
    } catch (error: unknown) {
      throw error;
    }
  };

  // ── Derived data ─────────────────────────────────────────────────

  const shortAssignments = assignments.filter((a) => a.short_id === contentShort.id);
  const clipperAssignment = shortAssignments.find((a) => a.role === 'clipper');
  const editorAssignment = shortAssignments.find((a) => a.role === 'editor');

  const scriptPdf = contentShort.files?.find((f) => f.file_type === 'script');
  const audioFile = contentShort.files?.find((f) => f.file_type === 'audio');
  const clipsZip = contentShort.files?.find((f) => f.file_type === 'clips_zip');
  const finalVideo = contentShort.files?.find((f) => f.file_type === 'final_video');

  const canEditScript =
    isAdmin ||
    contentShort.script_writer?.id === user?.id ||
    (user?.roles?.includes('script_writer') && !contentShort.script_writer) ||
    (contentShort.script_content && (isAdmin || user?.roles?.includes('script_writer')));

  const canEditClipsOrVideo =
    isAdmin ||
    ((contentColumn === 'clips' || contentColumn === 'clip_changes') &&
      clipperAssignment?.user_id === user?.id) ||
    ((contentColumn === 'editing' || contentColumn === 'editing_changes') &&
      editorAssignment?.user_id === user?.id);

  const isClipsStage = contentColumn === 'clips' || contentColumn === 'clip_changes';
  const isEditingStage = contentColumn === 'editing' || contentColumn === 'editing_changes';
  const isUploadedStage = contentColumn === 'uploaded';
  const isScriptStage = contentColumn === 'script';

  const currentFile = isClipsStage ? clipsZip : isEditingStage ? finalVideo : null;

  // Title text
  const modalTitle = (() => {
    if (isScriptStage)
      return scriptPdf || audioFile ? 'Replace Script & Audio' : 'Upload Script & Audio';
    if (isClipsStage)
      return clipsZip ? 'Replace Clips ZIP' : 'Upload Clips ZIP';
    if (isEditingStage)
      return finalVideo ? 'Replace Final Video' : 'Upload Final Video';
    if (isUploadedStage)
      return contentShort.youtube_video_id ? 'Uploaded to YouTube' : 'Completed';
    return 'File Upload';
  })();

  // Whether we can submit
  const canSubmit =
    isScriptStage
      ? !!contentForm.audioFile
      : !!contentForm.file;

  const showSubmitButton =
    (isScriptStage && canEditScript) || (!isScriptStage && !isUploadedStage && canEditClipsOrVideo);

  // Mark-complete availability
  const hasMarkCompleteFile = isClipsStage
    ? !!clipsZip
    : !!finalVideo;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* remove bottom border from last download row */
        .download-row-last-no-border:last-child {
          border-bottom: none !important;
        }
        /* themed file input hover */
        .file-input-label:hover {
          border-color: var(--gold-border) !important;
          background: var(--gold-dim) !important;
        }
      `}</style>

      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--modal-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9000,
          padding: '20px',
        }}
        onClick={() => { if (!uploading) onClose(); }}
      >
        {/* Modal panel */}
        <div
          style={{
            background: 'var(--modal-bg)',
            borderRadius: '12px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: 'var(--modal-shadow)',
            border: '1px solid var(--modal-border)',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-default)',
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '4px',
            }}>
              {contentShort.title}
            </div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: '1.25',
            }}>
              {modalTitle}
            </h2>
          </div>

          {/* ── Body ── */}
          <form onSubmit={onSubmit} style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>

            {/* ── Assignments ── */}
            {(clipperAssignment?.user || editorAssignment?.user || contentShort.script_writer) && (
              <SectionCard label="Assignments">
                {contentShort.script_writer && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: clipperAssignment || editorAssignment ? '8px' : 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', width: '90px', flexShrink: 0, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Script</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {contentShort.script_writer.discord_username || contentShort.script_writer.name || contentShort.script_writer.email}
                    </span>
                    <TimezoneDisplay timezone={contentShort.script_writer.timezone} size="small" />
                  </div>
                )}
                {clipperAssignment?.user && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: editorAssignment ? '8px' : 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', width: '90px', flexShrink: 0, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Clipper</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {clipperAssignment.user.discord_username || clipperAssignment.user.name || clipperAssignment.user.email}
                    </span>
                    <TimezoneDisplay timezone={clipperAssignment.user.timezone} size="small" />
                  </div>
                )}
                {editorAssignment?.user && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', width: '90px', flexShrink: 0, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Editor</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {editorAssignment.user.discord_username || editorAssignment.user.name || editorAssignment.user.email}
                    </span>
                    <TimezoneDisplay timezone={editorAssignment.user.timezone} size="small" />
                  </div>
                )}
              </SectionCard>
            )}

            {/* ── Script stage ── */}
            {isScriptStage && (() => {
              return (
                <>
                  {/* Status */}
                  <SectionCard label="Status">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <StatusRow
                        ok={contentShort.status === 'script'}
                        label={contentShort.status === 'script' ? 'Script complete' : 'Script in progress'}
                      />
                      <StatusRow
                        ok={!!audioFile}
                        label={audioFile ? `Audio MP3 · ${audioFile.file_name}` : 'Audio MP3 — not uploaded'}
                      />
                      {scriptPdf && (
                        <StatusRow
                          ok={true}
                          label={`Script PDF · ${scriptPdf.file_name}`}
                        />
                      )}
                    </div>
                  </SectionCard>

                  {/* Write Script button */}
                  {canEditScript && (
                    <SectionCard>
                      <button
                        type="button"
                        onClick={() => window.location.href = `/shorts/${contentShort.id}/scenes`}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          background: 'var(--gold)',
                          color: 'var(--bg-base)',
                          border: 'none',
                          borderRadius: '7px',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        Write Script
                      </button>
                    </SectionCard>
                  )}

                  {/* Download for non-editors */}
                  {!canEditScript && (scriptPdf || audioFile) && (
                    <SectionCard label="Download Files">
                      {scriptPdf && (
                        <DownloadRow
                          label="Script PDF"
                          file={scriptPdf}
                          downloading={downloading}
                          downloadProgress={downloadProgress}
                          onDownload={onDownloadFile}
                        />
                      )}
                      {audioFile && (
                        <DownloadRow
                          label="Audio MP3"
                          file={audioFile}
                          downloading={downloading}
                          downloadProgress={downloadProgress}
                          onDownload={onDownloadFile}
                        />
                      )}
                    </SectionCard>
                  )}

                  {/* Upload audio (and optional legacy script PDF) */}
                  {canEditScript ? (
                    <SectionCard label="Upload Audio">
                      <FileInput
                        label="Audio MP3"
                        accept="audio/mpeg,.mp3,audio/*"
                        required
                        disabled={uploading}
                        onChange={(f) => onFormChange({ ...contentForm, audioFile: f })}
                      />
                      <FileInput
                        label="Script PDF (optional, legacy)"
                        accept="application/pdf"
                        disabled={uploading}
                        onChange={(f) => onFormChange({ ...contentForm, scriptFile: f })}
                      />
                    </SectionCard>
                  ) : (
                    <PermissionNotice role="script writer" />
                  )}
                </>
              );
            })()}

            {/* ── Uploaded/Completed stage ── */}
            {isUploadedStage && (
              <>

                {/* Description */}
                {contentShort.description && (
                  <SectionCard label="Description">
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      {contentShort.description}
                    </p>
                  </SectionCard>
                )}

              </>
            )}

            {/* ── Clips / Editing stages ── */}
            {(isClipsStage || isEditingStage) && (
              <>
                {/* ── Download dependencies (compact strip) ── */}
                {((isClipsStage && (scriptPdf || audioFile)) ||
                  (isEditingStage && (scriptPdf || audioFile || clipsZip))) && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {isClipsStage ? 'Downloads · Script & Audio' : 'Downloads · Script, Audio & Clips'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => window.location.href = `/shorts/${contentShort.id}/scenes`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 12px',
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; (e.currentTarget as HTMLElement).style.background = 'var(--gold-dim)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        View Script
                      </button>
                      {scriptPdf && (
                        <CompactDownloadPill
                          label="Script PDF"
                          file={scriptPdf}
                          downloading={downloading}
                          downloadProgress={downloadProgress}
                          onDownload={onDownloadFile}
                        />
                      )}
                      {audioFile && (
                        <CompactDownloadPill
                          label="Audio MP3"
                          file={audioFile}
                          downloading={downloading}
                          downloadProgress={downloadProgress}
                          onDownload={onDownloadFile}
                        />
                      )}
                      {isEditingStage && clipsZip && (
                        <CompactDownloadPill
                          label="Flashback Clips"
                          file={clipsZip}
                          downloading={downloading}
                          downloadProgress={downloadProgress}
                          onDownload={onDownloadFile}
                        />
                      )}
                    </div>
                    {isClipsStage && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        Read the <a href="/guide" target="_blank" style={{ color: 'var(--gold)' }}>Guide</a> &amp; <a href="/flashback-reference" target="_blank" style={{ color: 'var(--gold)' }}>Flashback Reference</a> first.
                      </div>
                    )}
                  </div>
                )}

                {/* ── Current file row ── */}
                {currentFile && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-elevated)',
                    marginBottom: '10px',
                  }}>
                    {/* File icon */}
                    <div style={{ flexShrink: 0, color: 'var(--gold)', opacity: 0.7 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentFile.file_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {currentFile.file_size ? `${(currentFile.file_size / (1024 * 1024)).toFixed(1)} MB` : 'Uploaded'}
                        {' · '}
                        <span style={{ color: 'var(--green)' }}>✓ {isClipsStage ? 'Clips ZIP' : 'Final Video'}</span>
                      </div>
                    </div>
                    {/* Actions */}
                    {canEditClipsOrVideo && (
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => onDownloadFile(currentFile)}
                          disabled={downloading === currentFile.id}
                          title="Download"
                          style={{
                            width: '30px', height: '30px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--gold-dim)', color: 'var(--gold)',
                            border: '1px solid var(--gold-border)', borderRadius: '6px',
                            cursor: downloading === currentFile.id ? 'not-allowed' : 'pointer',
                            opacity: downloading === currentFile.id ? 0.6 : 1,
                            flexShrink: 0,
                          }}
                        >
                          {downloading === currentFile.id ? (
                            <svg style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteFile(currentFile.id)}
                          title="Delete"
                          style={{
                            width: '30px', height: '30px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'transparent', color: 'var(--red)',
                            border: '1px solid color-mix(in srgb, var(--red) 28%, transparent)',
                            borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {/* View-only download button */}
                    {!canEditClipsOrVideo && (
                      <button
                        type="button"
                        onClick={() => onDownloadFile(currentFile)}
                        disabled={downloading === currentFile.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '5px 12px', background: 'var(--gold-dim)', color: 'var(--gold)',
                          border: '1px solid var(--gold-border)', borderRadius: '6px',
                          fontSize: '11px', fontWeight: '600',
                          cursor: downloading === currentFile.id ? 'not-allowed' : 'pointer',
                          opacity: downloading === currentFile.id ? 0.6 : 1, flexShrink: 0,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        {downloading === currentFile.id && downloadProgress !== null ? `${downloadProgress}%` : 'Download'}
                      </button>
                    )}
                  </div>
                )}

                {/* ── No file yet ── */}
                {!currentFile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', marginBottom: '6px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {isClipsStage ? 'No Clips ZIP uploaded yet' : 'No Final Video uploaded yet'}
                    </span>
                  </div>
                )}

                {/* ── Upload / Replace input (if user can edit) ── */}
                {canEditClipsOrVideo ? (
                  <FileInput
                    label={currentFile ? (isClipsStage ? 'Replace Clips ZIP' : 'Replace Final Video') : (isClipsStage ? 'Upload Clips ZIP' : 'Upload Final Video')}
                    accept={isClipsStage ? '.zip,application/zip' : 'video/*'}
                    disabled={uploading}
                    onChange={(f) => onFormChange({ ...contentForm, file: f })}
                  />
                ) : (
                  !currentFile && <PermissionNotice role={isClipsStage ? 'clipper' : 'editor'} />
                )}

                {/* ── Admin: mark complete (compact inline) ── */}
                {isAdmin && (
                  <div style={{
                    marginTop: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-elevated)',
                    gap: '10px',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                        {isClipsStage ? 'Mark Clips Complete' : 'Mark Editing Complete'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                        {isClipsStage
                          ? "Marks clips done · moves to editing queue."
                          : "Marks editing done · moves to completed."}
                        {isClipsStage && contentShort.clips_completed_at && (
                          <span style={{ color: 'var(--green)', marginLeft: '6px' }}>
                            ✓ Done {new Date(contentShort.clips_completed_at).toLocaleDateString()}
                          </span>
                        )}
                        {isEditingStage && contentShort.editing_completed_at && (
                          <span style={{ color: 'var(--green)', marginLeft: '6px' }}>
                            ✓ Done {new Date(contentShort.editing_completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleMarkComplete}
                      disabled={uploading || !hasMarkCompleteFile}
                      style={{
                        padding: '7px 14px',
                        background: hasMarkCompleteFile && !uploading ? 'var(--gold)' : 'var(--bg-raised)',
                        color: hasMarkCompleteFile && !uploading ? 'var(--bg-base)' : 'var(--text-muted)',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: !hasMarkCompleteFile || uploading ? 'not-allowed' : 'pointer',
                        letterSpacing: '-0.01em',
                        flexShrink: 0,
                        transition: 'all 0.15s',
                      }}
                    >
                      {isClipsStage ? 'Complete' : 'Complete'}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Upload progress ── */}
            {uploading && uploadProgress !== null && (
              <ProgressBar label="Uploading" progress={uploadProgress} color="var(--gold)" />
            )}

            {/* ── Download progress ── */}
            {downloading !== null && (
              <ProgressBar
                label="Downloading"
                progress={downloadProgress ?? null}
                color="var(--green)"
                indeterminate={downloadProgress === null}
              />
            )}

            {/* ── Footer buttons ── */}
            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-default)',
            }}>
              <button
                type="button"
                onClick={() => { if (!uploading) onClose(); }}
                disabled={uploading}
                style={{
                  padding: '9px 20px',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '7px',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  letterSpacing: '-0.01em',
                }}
              >
                Cancel
              </button>

              {showSubmitButton && (
                <button
                  type="submit"
                  disabled={uploading || !canSubmit}
                  style={{
                    padding: '9px 20px',
                    background: uploading || !canSubmit ? 'var(--bg-raised)' : 'var(--gold)',
                    color: uploading || !canSubmit ? 'var(--text-muted)' : 'var(--bg-base)',
                    border: 'none',
                    borderRadius: '7px',
                    cursor: uploading || !canSubmit ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: '700',
                    letterSpacing: '-0.01em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    transition: 'all 0.15s',
                  }}
                >
                  {uploading && (
                    <svg style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {uploading
                    ? uploadProgress !== null ? `Uploading… ${uploadProgress}%` : 'Uploading…'
                    : currentFile || scriptPdf || audioFile ? 'Replace' : 'Upload'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ── Small helper components ───────────────────────────────────────────

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '12px',
      color: ok ? 'var(--green)' : 'var(--text-muted)',
      padding: '2px 0',
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {ok
          ? <><polyline points="20 6 9 17 4 12" /></>
          : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
      </svg>
      {label}
    </div>
  );
}

function PermissionNotice({ role }: { role: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: '8px',
      border: '1px solid var(--border-default)',
      background: 'var(--bg-elevated)',
      fontSize: '12px',
      color: 'var(--text-muted)',
      lineHeight: '1.5',
    }}>
      Only the assigned {role} or an admin can manage files for this short.
    </div>
  );
}

function ProgressBar({
  label,
  progress,
  color,
  indeterminate = false,
}: {
  label: string;
  progress: number | null;
  color: string;
  indeterminate?: boolean;
}) {
  return (
    <div style={{
      marginTop: '16px',
      padding: '14px 16px',
      borderRadius: '8px',
      border: '1px solid var(--border-default)',
      background: 'var(--bg-elevated)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
        fontSize: '12px',
        fontWeight: '600',
        color: 'var(--text-secondary)',
      }}>
        <span>{label}…</span>
        {progress !== null && <span>{progress}%</span>}
      </div>
      <div style={{
        width: '100%',
        height: '4px',
        background: 'var(--bg-raised)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: progress !== null ? `${progress}%` : '100%',
          height: '100%',
          background: color,
          borderRadius: '2px',
          transition: 'width 0.3s ease',
          animation: indeterminate ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : 'none',
        }} />
      </div>
    </div>
  );
}
