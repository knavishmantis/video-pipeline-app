import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAlert } from '../hooks/useAlert';
import { useToast } from '../hooks/useToast';
import { scriptGradingApi, GradingResponse, filesApi } from '../services/api';
import { File as FileInterface } from '../../../shared/types';

export default function ScriptGrading() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const shortIdParam = searchParams.get('shortId');
  const shortId = shortIdParam ? parseInt(shortIdParam, 10) : null;

  const [scriptText, setScriptText] = useState('');
  const [pdfFile, setPdfFile] = useState<globalThis.File | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [grading, setGrading] = useState(false);
  const [response, setResponse] = useState<GradingResponse | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();

  // Auto-load PDF when shortId is provided
  useEffect(() => {
    const loadPdfFromShort = async () => {
      if (!shortId) return;
      
      setLoadingPdf(true);
      try {
        const files: FileInterface[] = await filesApi.getByShortId(shortId);
        const scriptPdf: FileInterface | undefined = files.find((f: FileInterface) => f.file_type === 'script');
        
        if (!scriptPdf || !scriptPdf.download_url) {
          showAlert('No script PDF found for this short', { type: 'warning' });
          return;
        }

        // Fetch the PDF file
        const response = await fetch(scriptPdf.download_url);
        if (!response.ok) {
          throw new Error('Failed to fetch PDF');
        }
        
        const blob = await response.blob();
        const file = new globalThis.File([blob], scriptPdf.file_name || 'script.pdf', { type: 'application/pdf' });
        setPdfFile(file);
        setPdfFileName(scriptPdf.file_name || 'script.pdf');
        setScriptText(''); // Clear text input
      } catch (error: any) {
        console.error('Failed to load PDF:', error);
        showAlert('Failed to load script PDF. Please try again.', { type: 'error' });
      } finally {
        setLoadingPdf(false);
      }
    };

    loadPdfFromShort();
  }, [shortId, showAlert]);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setPdfFile(file);
        setPdfFileName(file.name);
        setScriptText(''); // Clear text when PDF is selected
      } else {
        showAlert('Please select a PDF file', { type: 'error' });
        e.target.value = ''; // Reset input
      }
    }
  };

  const handleGradeScript = async () => {
    if (!scriptText.trim() && !pdfFile) {
      showAlert('Please enter script text or upload a PDF file', { type: 'warning' });
      return;
    }

    setGrading(true);
    setResponse(null);
    setExpandedCategories(new Set());

    try {
      let gradingResult;
      
      if (pdfFile) {
        // Upload PDF and extract text
        const formData = new FormData();
        formData.append('pdfFile', pdfFile);
        if (shortId) {
          formData.append('shortId', shortId.toString());
        }
        
        // Use fetch directly to handle multipart/form-data
        // Use the same API URL as the api service
        const API_URL = import.meta.env.VITE_API_URL || '/api';
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/script-grading/grade`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });
        
        if (!response.ok) {
          let errorMessage = 'Failed to grade PDF';
          try {
            // Clone the response before reading to avoid "body already consumed" error
            const clonedResponse = response.clone();
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
              const errorData = await clonedResponse.json();
              errorMessage = errorData.error || errorData.details || errorMessage;
            } else {
              const errorText = await clonedResponse.text();
              errorMessage = errorText || errorMessage;
            }
          } catch (parseError) {
            // If all parsing fails, use status text
            errorMessage = response.statusText || `HTTP ${response.status}: Failed to grade PDF`;
          }
          throw new Error(errorMessage);
        }
        
        gradingResult = await response.json();
        
        // If rating was saved, show success message (but don't auto-redirect so user can see results)
        if (shortId && gradingResult.rating !== undefined) {
          showToast('Script graded and rating saved!', 'success');
        }
      } else {
        // Use text input
        gradingResult = await scriptGradingApi.gradeScript(scriptText);
      }
      
      setResponse(gradingResult);
      showToast('Script graded successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to grade script:', error);
      const errorMessage = error?.response?.data?.error || error?.message || error?.response?.data?.details || 'Failed to grade script. Please try again.';
      showAlert(errorMessage, { type: 'error' });
    } finally {
      setGrading(false);
    }
  };

  const getScoreColor = (score: number, maxScore: number): string => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return '#10B981'; // green
    if (percentage >= 60) return '#F59E0B'; // yellow/orange
    if (percentage >= 40) return '#EF4444'; // red
    return '#DC2626'; // dark red
  };

  const getRatingColor = (rating: number): string => {
    if (rating >= 8) return '#10B981'; // green
    if (rating >= 6) return '#F59E0B'; // yellow/orange
    if (rating >= 4) return '#EF4444'; // red
    return '#DC2626'; // dark red
  };

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div style={{
      padding: '32px',
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      <h1 style={{
        fontSize: '28px',
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: '8px',
        letterSpacing: '-0.02em',
      }}>
        Script Grading Agent
      </h1>
      <p style={{
        fontSize: '14px',
        color: '#64748B',
        marginBottom: '32px',
      }}>
        Upload script text or PDF to evaluate against quality criteria and rules
      </p>

      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        marginBottom: '24px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{
          marginBottom: '16px',
        }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#0F172A',
            marginBottom: '8px',
          }}>
            Script Text
          </label>
          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            placeholder={pdfFile ? "PDF uploaded. Text input disabled. Click 'Clear PDF' to use text input." : "Paste your script text here, or upload a PDF..."}
            disabled={grading || !!pdfFile || loadingPdf}
            style={{
              width: '100%',
              minHeight: '300px',
              padding: '12px',
              fontSize: '14px',
              fontFamily: 'monospace',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              resize: 'vertical',
              lineHeight: '1.6',
              color: '#1E293B',
              background: loadingPdf || pdfFile ? '#F8FAFC' : '#FFFFFF',
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}>
          <button
            onClick={handleGradeScript}
            disabled={grading || (!scriptText.trim() && !pdfFile)}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#FFFFFF',
              background: grading || (!scriptText.trim() && !pdfFile)
                ? 'linear-gradient(135deg, #CBD5E1 0%, #94A3B8 100%)'
                : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              border: 'none',
              borderRadius: '8px',
              cursor: grading || (!scriptText.trim() && !pdfFile) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease-in-out',
              boxShadow: grading || (!scriptText.trim() && !pdfFile)
                ? 'none'
                : '0 2px 4px rgba(59, 130, 246, 0.3)',
              opacity: grading || (!scriptText.trim() && !pdfFile) ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!grading && (scriptText.trim() || pdfFile)) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!grading && (scriptText.trim() || pdfFile)) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
              }
            }}
          >
            {grading ? 'Grading...' : 'Grade Script'}
          </button>

          {!shortId && (
            <label style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              color: pdfFile ? '#3B82F6' : '#64748B',
              background: pdfFile ? '#DBEAFE' : '#F1F5F9',
              border: `1px solid ${pdfFile ? '#3B82F6' : '#E2E8F0'}`,
              borderRadius: '8px',
              cursor: grading ? 'not-allowed' : 'pointer',
              opacity: grading ? 0.6 : 1,
              display: 'inline-block',
              transition: 'all 0.2s ease-in-out',
            }}>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfChange}
                disabled={grading}
                style={{ display: 'none' }}
              />
              {pdfFile ? `📄 ${pdfFileName}` : 'Upload PDF'}
            </label>
          )}
          {shortId && loadingPdf && (
            <span style={{ color: '#64748B', fontSize: '14px' }}>Loading script PDF...</span>
          )}
          {shortId && pdfFile && !loadingPdf && (
            <span style={{ color: '#3B82F6', fontSize: '14px', fontWeight: '600' }}>
              📄 {pdfFileName}
            </span>
          )}
          {pdfFile && !shortId && (
            <button
              onClick={() => {
                setPdfFile(null);
                setPdfFileName('');
              }}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#EF4444',
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
              }}
            >
              Clear PDF
            </button>
          )}
        </div>
      </div>

      {(response || grading) && (
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {grading && !response && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 24px',
            color: '#64748B',
            fontSize: '14px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                marginBottom: '12px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#0F172A',
              }}>
                Grading script...
              </div>
              <div style={{ color: '#94A3B8' }}>
                This may take a few moments
              </div>
            </div>
          </div>
        )}
        {response && (
          response.error ? (
            <div style={{
              padding: '16px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              color: '#991B1B',
            }}>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Error</div>
              <div>{response.message}</div>
              {response.suggestion && (
                <div style={{ marginTop: '8px', fontSize: '14px' }}>{response.suggestion}</div>
              )}
            </div>
          ) : (
            <>
              {/* Overall Score */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                marginBottom: '24px',
                padding: '20px',
                background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
                borderRadius: '12px',
                border: `2px solid ${getRatingColor(response.rating)}`,
              }}>
                <div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748B',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '4px',
                  }}>
                    Overall Score
                  </div>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: '700',
                    color: getRatingColor(response.rating),
                    lineHeight: '1',
                  }}>
                    {response.total_score}<span style={{ fontSize: '20px', color: '#64748B', fontWeight: '400' }}>/37</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748B',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '4px',
                  }}>
                    Rating
                  </div>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: '700',
                    color: getRatingColor(response.rating),
                    lineHeight: '1',
                  }}>
                    {response.rating.toFixed(1)}<span style={{ fontSize: '20px', color: '#64748B', fontWeight: '400' }}>/10.0</span>
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#0F172A',
                  marginBottom: '12px',
                }}>
                  Category Breakdown
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {response.categories.map((category, index) => {
                    const isExpanded = expandedCategories.has(category.name);
                    const scoreColor = getScoreColor(category.score, category.max_score);
                    const percentage = (category.score / category.max_score) * 100;

                    return (
                      <div
                        key={index}
                        style={{
                          border: `1px solid ${scoreColor}40`,
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: isExpanded ? '#F8FAFC' : '#FFFFFF',
                          transition: 'all 0.2s ease-in-out',
                        }}
                      >
                        <button
                          onClick={() => toggleCategory(category.name)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#0F172A',
                              marginBottom: '4px',
                            }}>
                              {category.name}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#64748B',
                            }}>
                              {category.score}/{category.max_score} points ({percentage.toFixed(0)}%)
                            </div>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                          }}>
                            <div style={{
                              width: '60px',
                              height: '8px',
                              background: '#E2E8F0',
                              borderRadius: '4px',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${percentage}%`,
                                height: '100%',
                                background: scoreColor,
                                transition: 'width 0.3s ease-in-out',
                              }} />
                            </div>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#64748B"
                              strokeWidth="2"
                              style={{
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease-in-out',
                              }}
                            >
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </div>
                        </button>
                        {isExpanded && (
                          <div style={{
                            padding: '0 16px 12px 16px',
                            fontSize: '13px',
                            color: '#475569',
                            lineHeight: '1.6',
                            borderTop: `1px solid ${scoreColor}20`,
                            marginTop: '8px',
                            paddingTop: '12px',
                          }}>
                            <div style={{ fontWeight: '600', marginBottom: '4px', color: '#0F172A' }}>
                              Reason:
                            </div>
                            {category.reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overall Feedback */}
              {response.overall_feedback && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#0F172A',
                    marginBottom: '12px',
                  }}>
                    Overall Feedback
                  </h3>
                  <div style={{
                    padding: '16px',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1E293B',
                    lineHeight: '1.6',
                  }}>
                    {response.overall_feedback}
                  </div>
                </div>
              )}

              {/* Priority Fixes */}
              {response.priority_fixes && response.priority_fixes.length > 0 && (
                <div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#0F172A',
                    marginBottom: '12px',
                  }}>
                    Priority Fixes
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {response.priority_fixes.map((fix, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '12px 16px',
                          background: '#FEF3C7',
                          border: '1px solid #FCD34D',
                          borderRadius: '8px',
                          fontSize: '14px',
                          color: '#92400E',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <span style={{
                          flexShrink: 0,
                          fontWeight: '700',
                          color: '#F59E0B',
                        }}>
                          {index + 1}.
                        </span>
                        <span>{fix}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        )}
      </div>
      )}

      <AlertComponent />
      <ToastComponent />
    </div>
  );
}

