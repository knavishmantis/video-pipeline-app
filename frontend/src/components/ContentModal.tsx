import React from 'react';
import { Short, Assignment, User, File as FileInterface } from '../../../shared/types';
import { ColumnType, columns } from '../utils/dashboardUtils';
import { filesApi, shortsApi } from '../services/api';

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

export function ContentModal({
  isOpen,
  contentShort,
  contentColumn,
  contentForm,
  uploading,
  uploadProgress,
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

  const handleMarkComplete = async () => {
    if (!contentShort) return;
    const hasRequiredFile = (contentColumn === 'clips' || contentColumn === 'clip_changes')
      ? contentShort.files?.some(f => f.file_type === 'clips_zip')
      : contentShort.files?.some(f => f.file_type === 'final_video');
    
    if (!hasRequiredFile) {
      showAlert(
        contentColumn === 'clips' || contentColumn === 'clip_changes'
          ? 'Cannot mark complete. Clips ZIP file is required.'
          : 'Cannot mark complete. Final video file is required.',
        { type: 'warning' }
      );
      return;
    }
    
    // Check for assignment and rate before calling API
    const shortAssignments = assignments.filter(a => a.short_id === contentShort.id);
    const relevantAssignment = (contentColumn === 'clips' || contentColumn === 'clip_changes')
      ? shortAssignments.find(a => a.role === 'clipper')
      : shortAssignments.find(a => a.role === 'editor');
    
    if (!relevantAssignment) {
      showAlert(
        contentColumn === 'clips' || contentColumn === 'clip_changes'
          ? 'Cannot mark complete. No clipper assignment found for this short.'
          : 'Cannot mark complete. No editor assignment found for this short.',
        { type: 'error' }
      );
      return;
    }
    
    if (!relevantAssignment.rate || relevantAssignment.rate <= 0) {
      showAlert(
        contentColumn === 'clips' || contentColumn === 'clip_changes'
          ? 'Cannot mark complete. Rate must be set for the clipper assignment before marking complete.'
          : 'Cannot mark complete. Rate must be set for the editor assignment before marking complete.',
        { type: 'error' }
      );
      return;
    }
    
    await onMarkComplete(contentShort.id, contentColumn);
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}
        onClick={() => {
          if (!uploading) {
            onClose();
          }
        }}
      >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '600px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <h2 style={{
          margin: '0 0 20px 0',
          fontSize: '20px',
          fontWeight: '600',
          color: '#1E293B',
        }}>
          {contentColumn === 'script' && (() => {
            const hasScript = contentShort.files?.some(f => f.file_type === 'script');
            const hasAudio = contentShort.files?.some(f => f.file_type === 'audio');
            return (hasScript || hasAudio) ? 'Replace Script & Audio' : 'Upload Script & Audio';
          })()}
          {(contentColumn === 'clips' || contentColumn === 'clip_changes') && (
            contentShort.files?.some(f => f.file_type === 'clips_zip') ? 'Replace Zip of Clips' : 'Upload Zip of Clips'
          )}
          {(contentColumn === 'editing' || contentColumn === 'editing_changes') && (
            contentShort.files?.some(f => f.file_type === 'final_video') ? 'Replace Final Video' : 'Upload Final Video'
          )}
        </h2>
        <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '14px' }}>
          {contentShort.title}
        </p>
        <form onSubmit={onSubmit}>
          {contentColumn === 'script' ? (
            <>
              {(() => {
                // Check permissions for script stage - only script writer or admin can edit
                const shortAssignments = assignments.filter(a => a.short_id === contentShort.id);
                const canEditScript = isAdmin || 
                  (contentShort.script_writer?.id === user?.id) ||
                  (user?.roles?.includes('script_writer') && !contentShort.script_writer);
                
                const scriptPdf = contentShort.files?.find(f => f.file_type === 'script');
                const audioFile = contentShort.files?.find(f => f.file_type === 'audio');
                
                return (
                  <>
                    {/* Assignments Section - Always show */}
                    {(shortAssignments.length > 0 || contentShort.script_writer) && (
                      <div style={{
                        marginBottom: '16px',
                        padding: '12px',
                        background: '#F9FAFB',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                          Assignments:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {contentShort.script_writer && (
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>
                              Script Writer: {contentShort.script_writer.discord_username || contentShort.script_writer.name || contentShort.script_writer.email}
                            </div>
                          )}
                          {shortAssignments.map(assignment => {
                            if (assignment.role === 'clipper' && assignment.user) {
                              return (
                                <div key={assignment.id} style={{ fontSize: '12px', color: '#6B7280' }}>
                                  Clipper: {assignment.user.discord_username || assignment.user.name || assignment.user.email}
                                </div>
                              );
                            }
                            if (assignment.role === 'editor' && assignment.user) {
                              return (
                                <div key={assignment.id} style={{ fontSize: '12px', color: '#6B7280' }}>
                                  Editor: {assignment.user.discord_username || assignment.user.name || assignment.user.email}
                                </div>
                              );
                            }
                            return null;
                          })}
                          {!contentShort.script_writer && shortAssignments.length === 0 && (
                            <div style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>
                              No assignments
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Download Section for non-editors */}
                    {!canEditScript && (scriptPdf || audioFile) && (
                      <div style={{
                        marginBottom: '16px',
                        padding: '12px',
                        background: '#F0FDF4',
                        borderRadius: '8px',
                        border: '1px solid #86EFAC'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#166534', marginBottom: '8px' }}>
                          Available Files:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {scriptPdf && (
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                Script PDF:
                              </div>
                              {scriptPdf.download_url ? (
                                <button
                                  type="button"
                                  onClick={() => onDownloadFile(scriptPdf)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'white',
                                    color: '#166534',
                                    border: '1px solid #86EFAC',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    textAlign: 'left',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                  {scriptPdf.file_name}
                                </button>
                              ) : (
                                <div style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  border: '1px solid #FCD34D',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                  </svg>
                                  {scriptPdf.file_name} (Download unavailable)
                                </div>
                              )}
                            </div>
                          )}
                          {audioFile && (
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                Audio MP3:
                              </div>
                              {audioFile.download_url ? (
                                <button
                                  type="button"
                                  onClick={() => onDownloadFile(audioFile)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'white',
                                    color: '#166534',
                                    border: '1px solid #86EFAC',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    textAlign: 'left',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                  {audioFile.file_name}
                                </button>
                              ) : (
                                <div style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  border: '1px solid #FCD34D',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                  </svg>
                                  {audioFile.file_name} (Download unavailable)
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Edit Section - Only for script writers/admins */}
                    {canEditScript ? (
                      <>
                        {/* Show existing files */}
                        {contentShort.files && (
                          <div style={{ 
                            marginBottom: '16px', 
                            padding: '12px', 
                            background: '#F0F9FF', 
                            borderRadius: '8px',
                            border: '1px solid #BAE6FD'
                          }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#0369A1', marginBottom: '8px' }}>
                              File Status:
                            </div>
                            <div style={{ fontSize: '12px', color: contentShort.files.some(f => f.file_type === 'script') ? '#0C4A6E' : '#64748B', marginBottom: '4px' }}>
                              {contentShort.files.some(f => f.file_type === 'script') ? '✓ Script PDF uploaded' : '✗ Script PDF not uploaded'}
                            </div>
                            <div style={{ fontSize: '12px', color: contentShort.files.some(f => f.file_type === 'audio') ? '#0C4A6E' : '#64748B' }}>
                              {contentShort.files.some(f => f.file_type === 'audio') ? '✓ Audio MP3 uploaded' : '✗ Audio MP3 not uploaded'}
                            </div>
                          </div>
                        )}
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                          }}>
                            Script PDF File *
                          </label>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => onFormChange({ ...contentForm, scriptFile: e.target.files?.[0] || null })}
                            required
                            disabled={uploading}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #D1D5DB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                              opacity: uploading ? 0.6 : 1,
                              cursor: uploading ? 'not-allowed' : 'pointer',
                            }}
                          />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                          }}>
                            Audio MP3 File *
                          </label>
                          <input
                            type="file"
                            accept="audio/mpeg,.mp3,audio/*"
                            onChange={(e) => onFormChange({ ...contentForm, audioFile: e.target.files?.[0] || null })}
                            required
                            disabled={uploading}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #D1D5DB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                              opacity: uploading ? 0.6 : 1,
                              cursor: uploading ? 'not-allowed' : 'pointer',
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div style={{ 
                        padding: '12px', 
                        background: '#FEF3C7', 
                        borderRadius: '8px',
                        border: '1px solid #FCD34D',
                        color: '#92400E',
                        fontSize: '14px'
                      }}>
                        You don't have permission to edit this file. Only the assigned script writer or admin can manage files.
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          ) : (
            <>
              {/* Show existing files for clips/editing */}
              {contentShort.files && (
                <div style={{ 
                  marginBottom: '16px', 
                  padding: '12px', 
                  background: '#F0F9FF', 
                  borderRadius: '8px',
                  border: '1px solid #BAE6FD'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#0369A1', marginBottom: '8px' }}>
                    File Status:
                  </div>
                  {(contentColumn === 'clips' || contentColumn === 'clip_changes') && (
                    <div style={{ fontSize: '12px', color: contentShort.files.some(f => f.file_type === 'clips_zip') ? '#0C4A6E' : '#64748B' }}>
                      {contentShort.files.some(f => f.file_type === 'clips_zip') 
                        ? `✓ Clips ZIP uploaded: ${contentShort.files.find(f => f.file_type === 'clips_zip')?.file_name}`
                        : '✗ Clips ZIP not uploaded'}
                    </div>
                  )}
                  {(contentColumn === 'editing' || contentColumn === 'editing_changes') && (
                    <div style={{ fontSize: '12px', color: contentShort.files.some(f => f.file_type === 'final_video') ? '#0C4A6E' : '#64748B' }}>
                      {contentShort.files.some(f => f.file_type === 'final_video')
                        ? `✓ Final video uploaded: ${contentShort.files.find(f => f.file_type === 'final_video')?.file_name}`
                        : '✗ Final video not uploaded'}
                    </div>
                  )}
                </div>
              )}
              {/* File Management for Clips/Editing */}
              {(() => {
                const currentFile = (contentColumn === 'clips' || contentColumn === 'clip_changes')
                  ? contentShort.files?.find(f => f.file_type === 'clips_zip')
                  : contentShort.files?.find(f => f.file_type === 'final_video');
                
                // Get dependency files
                const scriptPdf = contentShort.files?.find(f => f.file_type === 'script');
                const audioFile = contentShort.files?.find(f => f.file_type === 'audio');
                const clipsZip = contentShort.files?.find(f => f.file_type === 'clips_zip');
                
                // Check permissions - only assigned clipper/editor or admin can edit
                const shortAssignments = assignments.filter(a => a.short_id === contentShort.id);
                const clipperAssignment = shortAssignments.find(a => a.role === 'clipper');
                const editorAssignment = shortAssignments.find(a => a.role === 'editor');
                const canEdit = isAdmin || 
                  ((contentColumn === 'clips' || contentColumn === 'clip_changes') && clipperAssignment?.user_id === user?.id) ||
                  ((contentColumn === 'editing' || contentColumn === 'editing_changes') && editorAssignment?.user_id === user?.id);
                
                // Download permissions based on stage, not assignment:
                // - If in clips stage, anyone can download script/audio/clips
                // - If in editing stage, anyone can download script/audio/clips/final video
                const canDownloadScript = (contentColumn === 'clips' || contentColumn === 'clip_changes') || 
                  (contentColumn === 'editing' || contentColumn === 'editing_changes');
                const canDownloadClips = (contentColumn === 'clips' || contentColumn === 'clip_changes') || 
                  (contentColumn === 'editing' || contentColumn === 'editing_changes');
                const canDownloadFinalVideo = (contentColumn === 'editing' || contentColumn === 'editing_changes');
                
                return (
                  <div style={{ marginBottom: '16px' }}>
                    {/* Download Dependencies Section for Clippers - Show if in clips stage and files exist */}
                    {((contentColumn === 'clips' || contentColumn === 'clip_changes') && canDownloadScript && (scriptPdf || audioFile)) && (
                      <div style={{
                        marginBottom: '16px',
                        padding: '12px',
                        background: '#F0FDF4',
                        borderRadius: '8px',
                        border: '1px solid #86EFAC'
                      }}>
                        <div style={{ fontSize: '12px', color: '#15803D', marginBottom: '12px', lineHeight: '1.5' }}>
                          <div style={{ marginBottom: '6px' }}>
                            📖 Refer to the <a href="/guide" target="_blank" style={{ color: '#166534', textDecoration: 'underline', fontWeight: '500' }}>Guide</a> and <a href="/flashback-reference" target="_blank" style={{ color: '#166534', textDecoration: 'underline', fontWeight: '500' }}>Flashback Reference</a> for clip creation guidelines.
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {scriptPdf && (
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                Editing Script of Short:
                              </div>
                              {scriptPdf.download_url ? (
                                <button
                                  type="button"
                                  onClick={() => onDownloadFile(scriptPdf)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'white',
                                    color: '#166534',
                                    border: '1px solid #86EFAC',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    textAlign: 'left',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                  {scriptPdf.file_name}
                                </button>
                              ) : (
                                <div style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  border: '1px solid #FCD34D',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                  </svg>
                                  {scriptPdf.file_name} (Download unavailable)
                                </div>
                              )}
                            </div>
                          )}
                          {audioFile && (
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                Audio of Short:
                              </div>
                              {audioFile.download_url ? (
                                <button
                                  type="button"
                                  onClick={() => onDownloadFile(audioFile)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'white',
                                    color: '#166534',
                                    border: '1px solid #86EFAC',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    textAlign: 'left',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                  {audioFile.file_name}
                                </button>
                              ) : (
                                <div style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  border: '1px solid #FCD34D',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                  </svg>
                                  {audioFile.file_name} (Download unavailable)
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Download Dependencies Section for Editors - Show if in editing stage and files exist */}
                    {((contentColumn === 'editing' || contentColumn === 'editing_changes') && canDownloadScript && (scriptPdf || audioFile || clipsZip)) && (
                      <div style={{
                        marginBottom: '16px',
                        padding: '12px',
                        background: '#F0FDF4',
                        borderRadius: '8px',
                        border: '1px solid #86EFAC'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {scriptPdf && (
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                Editing Script of Short:
                              </div>
                              {scriptPdf.download_url ? (
                                <button
                                  type="button"
                                  onClick={() => onDownloadFile(scriptPdf)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'white',
                                    color: '#166534',
                                    border: '1px solid #86EFAC',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    textAlign: 'left',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                  {scriptPdf.file_name}
                                </button>
                              ) : (
                                <div style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  border: '1px solid #FCD34D',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                  </svg>
                                  {scriptPdf.file_name} (Download unavailable)
                                </div>
                              )}
                            </div>
                          )}
                          {audioFile && (
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                Audio of Short:
                              </div>
                              {audioFile.download_url ? (
                                <button
                                  type="button"
                                  onClick={() => onDownloadFile(audioFile)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'white',
                                    color: '#166534',
                                    border: '1px solid #86EFAC',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    textAlign: 'left',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                  {audioFile.file_name}
                                </button>
                              ) : (
                                <div style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  border: '1px solid #FCD34D',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                  </svg>
                                  {audioFile.file_name} (Download unavailable)
                                </div>
                              )}
                            </div>
                          )}
                          {clipsZip && (
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534', marginBottom: '4px' }}>
                                Flashback Clips of Short:
                              </div>
                              {clipsZip.download_url ? (
                                <button
                                  type="button"
                                  onClick={() => onDownloadFile(clipsZip)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'white',
                                    color: '#166534',
                                    border: '1px solid #86EFAC',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    textAlign: 'left',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                  {clipsZip.file_name}
                                </button>
                              ) : (
                                <div style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  border: '1px solid #FCD34D',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                  </svg>
                                  {clipsZip.file_name} (Download unavailable)
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Assignments Section - Always show */}
                    {(shortAssignments.length > 0 || contentShort.script_writer) && (
                      <div style={{
                        marginBottom: '16px',
                        padding: '12px',
                        background: '#F9FAFB',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                          Assignments:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {clipperAssignment && clipperAssignment.user && (
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>
                              Clipper: {clipperAssignment.user.discord_username || clipperAssignment.user.name || clipperAssignment.user.email}
                            </div>
                          )}
                          {editorAssignment && editorAssignment.user && (
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>
                              Editor: {editorAssignment.user.discord_username || editorAssignment.user.name || editorAssignment.user.email}
                            </div>
                          )}
                          {contentShort.script_writer && (
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>
                              Script Writer: {contentShort.script_writer.discord_username || contentShort.script_writer.name || contentShort.script_writer.email}
                            </div>
                          )}
                          {!clipperAssignment && !editorAssignment && !contentShort.script_writer && (
                            <div style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>
                              No assignments
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* File Management Section - Only show if canEdit */}
                    {canEdit ? (
                      <>
                        {/* Current File Section (if exists) */}
                        {currentFile && (
                          <div style={{
                            marginBottom: '16px',
                            padding: '12px',
                            background: '#F0F9FF',
                            borderRadius: '8px',
                            border: '1px solid #BAE6FD'
                          }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0369A1', marginBottom: '8px' }}>
                              {(contentColumn === 'clips' || contentColumn === 'clip_changes') ? 'Your Clips ZIP' : 'Your Final Video'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#0C4A6E', marginBottom: '12px' }}>
                              {currentFile.file_name}
                              {currentFile.file_size && (
                                <span style={{ color: '#64748B', marginLeft: '8px' }}>
                                  ({(currentFile.file_size / (1024 * 1024)).toFixed(2)} MB)
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {currentFile.download_url && (
                                <button
                                  type="button"
                                  onClick={() => onDownloadFile(currentFile)}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#3B82F6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                  Download
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onDeleteFile(currentFile.id)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#DC2626',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Upload/Replace Section */}
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                          }}>
                            {currentFile ? 'Replace File' : 'Upload File'} *
                          </label>
                          <input
                            type="file"
                            accept={(contentColumn === 'clips' || contentColumn === 'clip_changes') ? '.zip,application/zip' : 'video/*'}
                            onChange={(e) => onFormChange({ ...contentForm, file: e.target.files?.[0] || null })}
                            disabled={uploading}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #D1D5DB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                              opacity: uploading ? 0.6 : 1,
                              cursor: uploading ? 'not-allowed' : 'pointer',
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* View-only section for non-editors */}
                        {currentFile && (
                          <div style={{
                            marginBottom: '16px',
                            padding: '12px',
                            background: '#F0F9FF',
                            borderRadius: '8px',
                            border: '1px solid #BAE6FD'
                          }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0369A1', marginBottom: '8px' }}>
                              {(contentColumn === 'clips' || contentColumn === 'clip_changes') ? 'Clips ZIP' : 'Final Video'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#0C4A6E', marginBottom: '12px' }}>
                              {currentFile.file_name}
                              {currentFile.file_size && (
                                <span style={{ color: '#64748B', marginLeft: '8px' }}>
                                  ({(currentFile.file_size / (1024 * 1024)).toFixed(2)} MB)
                                </span>
                              )}
                            </div>
                            {currentFile.download_url && ((contentColumn === 'clips' || contentColumn === 'clip_changes') ? canDownloadClips : canDownloadFinalVideo) && (
                              <button
                                type="button"
                                onClick={() => onDownloadFile(currentFile)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#3B82F6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                  <polyline points="7 10 12 15 17 10"></polyline>
                                  <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Download
                              </button>
                            )}
                          </div>
                        )}
                        <div style={{ 
                          padding: '12px', 
                          background: '#FEF3C7', 
                          borderRadius: '8px',
                          border: '1px solid #FCD34D',
                          color: '#92400E',
                          fontSize: '14px'
                        }}>
                          You don't have permission to edit this file. Only the assigned {contentColumn === 'clips' || contentColumn === 'clip_changes' ? 'clipper' : 'editor'} or admin can manage files.
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </>
          )}
          
          {/* Mark Complete Button (Admin only, for clips/editing) */}
          {isAdmin && (contentColumn === 'clips' || contentColumn === 'clip_changes' || contentColumn === 'editing' || contentColumn === 'editing_changes') && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: '#F0FDF4',
              borderRadius: '8px',
              border: '1px solid #86EFAC',
              borderStyle: 'dashed',
            }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#166534', marginBottom: '8px' }}>
                {contentColumn === 'clips' || contentColumn === 'clip_changes' ? 'Mark Clips Complete' : 'Mark Editing Complete'}
              </div>
              <div style={{ fontSize: '12px', color: '#15803D', marginBottom: '12px' }}>
                {contentColumn === 'clips' || contentColumn === 'clip_changes' 
                  ? 'Mark this short\'s clips as complete. This will create a payment for the assigned clipper and allow moving to editing.'
                  : 'Mark this short\'s editing as complete. This will create a payment for the assigned editor and allow moving to ready to upload.'}
              </div>
              <button
                type="button"
                onClick={handleMarkComplete}
                disabled={uploading || (
                  (contentColumn === 'clips' || contentColumn === 'clip_changes')
                    ? !contentShort.files?.some(f => f.file_type === 'clips_zip')
                    : !contentShort.files?.some(f => f.file_type === 'final_video')
                )}
                style={{
                  padding: '10px 20px',
                  background: (contentColumn === 'clips' || contentColumn === 'clip_changes')
                    ? (!contentShort.files?.some(f => f.file_type === 'clips_zip') || uploading)
                      ? '#9CA3AF'
                      : '#10B981'
                    : (!contentShort.files?.some(f => f.file_type === 'final_video') || uploading)
                      ? '#9CA3AF'
                      : '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: (uploading || (
                    (contentColumn === 'clips' || contentColumn === 'clip_changes')
                      ? !contentShort.files?.some(f => f.file_type === 'clips_zip')
                      : !contentShort.files?.some(f => f.file_type === 'final_video')
                  )) ? 'not-allowed' : 'pointer',
                }}
              >
                {contentColumn === 'clips' || contentColumn === 'clip_changes' ? 'Mark Clips Complete' : 'Mark Editing Complete'}
              </button>
              {((contentColumn === 'clips' || contentColumn === 'clip_changes') && contentShort.clips_completed_at) && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#15803D' }}>
                  ✓ Completed on {new Date(contentShort.clips_completed_at).toLocaleDateString()}
                </div>
              )}
              {((contentColumn === 'editing' || contentColumn === 'editing_changes') && contentShort.editing_completed_at) && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#15803D' }}>
                  ✓ Completed on {new Date(contentShort.editing_completed_at).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
          
          {/* Upload Progress Indicator */}
          {uploading && uploadProgress !== null && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: '#F0F9FF',
              borderRadius: '8px',
              border: '1px solid #BAE6FD',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#0369A1',
                }}>
                  Uploading...
                </span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#0369A1',
                }}>
                  {uploadProgress}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: '#E0F2FE',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  background: '#3B82F6',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}
          
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            marginTop: '24px',
          }}>
            <button
              type="button"
              onClick={() => {
                if (!uploading) {
                  onClose();
                }
              }}
              disabled={uploading}
              style={{
                padding: '10px 20px',
                background: '#F3F4F6',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Cancel
            </button>
            {(() => {
              // Only show submit button if user can edit
              if (contentColumn === 'script') {
                const shortAssignments = assignments.filter(a => a.short_id === contentShort.id);
                const canEditScript = isAdmin || 
                  (contentShort.script_writer?.id === user?.id) ||
                  (user?.roles?.includes('script_writer') && !contentShort.script_writer);
                if (!canEditScript) return null;
              } else {
                const shortAssignments = assignments.filter(a => a.short_id === contentShort.id);
                const clipperAssignment = shortAssignments.find(a => a.role === 'clipper');
                const editorAssignment = shortAssignments.find(a => a.role === 'editor');
                const canEdit = isAdmin || 
                  ((contentColumn === 'clips' || contentColumn === 'clip_changes') && clipperAssignment?.user_id === user?.id) ||
                  ((contentColumn === 'editing' || contentColumn === 'editing_changes') && editorAssignment?.user_id === user?.id);
                if (!canEdit) return null;
              }
              
              return (contentColumn === 'script' || contentForm.file) && (
                <button
                  type="submit"
                  disabled={uploading || (contentColumn === 'script' ? (!contentForm.scriptFile || !contentForm.audioFile) : !contentForm.file)}
                  style={{
                    padding: '10px 20px',
                    background: uploading ? '#9CA3AF' : columns.find(c => c.id === contentColumn)?.color || '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {uploading && (
                    <svg style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {uploading 
                    ? (uploadProgress !== null ? `Uploading... ${uploadProgress}%` : 'Uploading...')
                    : (() => {
                        if (contentColumn === 'script') {
                          const hasScript = contentShort.files?.some(f => f.file_type === 'script');
                          const hasAudio = contentShort.files?.some(f => f.file_type === 'audio');
                          return (hasScript || hasAudio) ? 'Replace' : 'Upload';
                        } else if (contentColumn === 'clips' || contentColumn === 'clip_changes') {
                          const hasClipsZip = contentShort.files?.some(f => f.file_type === 'clips_zip');
                          return hasClipsZip ? 'Replace' : 'Upload';
                        } else if (contentColumn === 'editing' || contentColumn === 'editing_changes') {
                          const hasFinalVideo = contentShort.files?.some(f => f.file_type === 'final_video');
                          return hasFinalVideo ? 'Replace' : 'Upload';
                        }
                        return 'Upload';
                      })()}
                </button>
              );
            })()}
          </div>
        </form>
      </div>
    </div>
    </>
  );
}

