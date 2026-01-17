import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../hooks/useAlert';
import { useToast } from '../hooks/useToast';
import { scriptPipelineApi } from '../services/api';
import { Short, ScriptDraftStage } from '../../../shared/types';
import { IconArrowLeft, IconCheck, IconX, IconLayoutSidebar, IconLayoutSidebarRight } from '@tabler/icons-react';

const STAGE_LABELS: Record<NonNullable<ScriptDraftStage>, string> = {
  first_draft: 'First Draft',
  second_draft: '2nd Draft',
  final_draft: 'Final Draft',
};

const STAGE_COLORS: Record<NonNullable<ScriptDraftStage>, string> = {
  first_draft: '#F59E0B',
  second_draft: '#3B82F6',
  final_draft: '#10B981',
};

// Validation rules (same for all stages)
const VALIDATION_RULES = [
  'Does the hook create genuine interest',
  'Does the first few seconds scream "this is high quality"',
  'Did I do enough research?',
  'Are all facts accurate?',
  'Does this have genuine viral potential?',
  'Will people feel inclined to subscribe?',
  'Is it 6th grade reading level or below?',
  'Is there a double hook (reason to keep watching)?',
  'Is the pacing good (is it all interesting)',
];

function getRulesForStage(stage: ScriptDraftStage): string[] {
  // Same rules for all stages
  return VALIDATION_RULES;
}

export default function ScriptPipelineEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();

  const [short, setShort] = useState<Short | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftText, setDraftText] = useState('');
  const [notes, setNotes] = useState('');
  const [checkedRules, setCheckedRules] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Track initial values to only save when actually changed
  const initialDraftTextRef = useRef<string>('');
  const initialNotesRef = useRef<string>('');
  const hasUserEditedRef = useRef<boolean>(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';
  const isScriptWriter = user?.roles?.includes('script_writer') || user?.role === 'script_writer';
  const canEdit = isAdmin || isScriptWriter;

  useEffect(() => {
    if (id) {
      loadShort();
    }
  }, [id]);

  useEffect(() => {
    if (short) {
      const stage = short.script_draft_stage;
      let initialDraft = '';
      if (stage === 'first_draft') {
        initialDraft = short.script_first_draft || '';
      } else if (stage === 'second_draft') {
        initialDraft = short.script_second_draft || '';
      } else if (stage === 'final_draft') {
        initialDraft = short.script_final_draft || '';
      }
      const initialNotes = short.script_pipeline_notes || '';
      
      setDraftText(initialDraft);
      setNotes(initialNotes);
      
      // Store initial values and reset edit flag
      initialDraftTextRef.current = initialDraft;
      initialNotesRef.current = initialNotes;
      hasUserEditedRef.current = false;
    }
  }, [short]);

  // Track when user makes edits
  useEffect(() => {
    if (!short) return;
    
    const draftChanged = draftText !== initialDraftTextRef.current;
    const notesChanged = notes !== initialNotesRef.current;
    
    if (draftChanged || notesChanged) {
      hasUserEditedRef.current = true;
    }
  }, [draftText, notes, short]);

  // Auto-save draft text (only after user has made edits)
  useEffect(() => {
    if (!canEdit || !short || !short.script_draft_stage) return;
    if (!hasUserEditedRef.current) return; // Don't save on initial load

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      const draftChanged = draftText !== initialDraftTextRef.current;
      const notesChanged = notes !== initialNotesRef.current;
      
      // Only save if something actually changed
      if (draftChanged || notesChanged) {
        saveDraft();
      }
    }, 2500); // 2.5 second delay

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [draftText, notes, short, canEdit]);

  const loadShort = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await scriptPipelineApi.getDraft(parseInt(id, 10));
      setShort(data);
      
      // Initialize checked rules from validation_rules if provided
      if (data.validation_rules) {
        // Rules are provided but not checked by default
        setCheckedRules(new Set());
      }
    } catch (error: any) {
      console.error('Failed to load script draft:', error);
      showAlert(error?.response?.data?.error || 'Failed to load script. Please try again.', { type: 'error' });
      navigate('/script-pipeline');
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    if (!short || !short.script_draft_stage || !canEdit) return;

    try {
      setSaving(true);
      setSaveStatus('saving');
      
      await scriptPipelineApi.updateDraft(short.id, {
        stage: short.script_draft_stage,
        draft_text: draftText,
        notes: notes,
      });
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
      
      // Update initial values to current values (don't reload to avoid refresh)
      initialDraftTextRef.current = draftText;
      initialNotesRef.current = notes;
    } catch (error: any) {
      console.error('Failed to save draft:', error);
      setSaveStatus('error');
      showAlert(error?.response?.data?.error || 'Failed to save draft. Please try again.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAdvanceStage = async () => {
    if (!short || !short.script_draft_stage) return;

    const requiredRules = getRulesForStage(short.script_draft_stage);
    const allChecked = requiredRules.every(rule => checkedRules.has(rule));

    if (!allChecked) {
      showAlert('Please check all validation rules before advancing to the next stage.', { type: 'warning' });
      return;
    }

    setAdvancing(true);
    try {
      const result = await scriptPipelineApi.advanceStage(short.id, {
        validated_rules: Array.from(checkedRules),
      });
      
      if (result.message) {
        showToast(result.message, 'success');
      } else {
        showToast('Stage advanced successfully!', 'success');
      }
      
      // Reload to get updated stage
      await loadShort();
      
      // If final draft completed, navigate to kanban after a delay
      if (short.script_draft_stage === 'final_draft') {
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Failed to advance stage:', error);
      showAlert(error?.response?.data?.error || 'Failed to advance stage. Please try again.', { type: 'error' });
    } finally {
      setAdvancing(false);
    }
  };

  const toggleRule = (rule: string) => {
    if (!canEdit) return;
    const newChecked = new Set(checkedRules);
    if (newChecked.has(rule)) {
      newChecked.delete(rule);
    } else {
      newChecked.add(rule);
    }
    setCheckedRules(newChecked);
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: '#64748B' }}>Loading script...</p>
      </div>
    );
  }

  if (!short) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: '#64748B' }}>Script not found</p>
        <button
          onClick={() => navigate('/script-pipeline')}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            background: '#3B82F6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Back to Pipeline
        </button>
      </div>
    );
  }

  const currentStage = short.script_draft_stage;
  if (!currentStage) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: '#64748B' }}>This script is not in the pipeline</p>
        <button
          onClick={() => navigate('/script-pipeline')}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            background: '#3B82F6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Back to Pipeline
        </button>
      </div>
    );
  }

  const requiredRules = getRulesForStage(currentStage);
  const allRulesChecked = requiredRules.every(rule => checkedRules.has(rule));
  const nextStage = currentStage === 'first_draft' ? '2nd Draft' : currentStage === 'second_draft' ? 'Final Draft' : null;

  return (
    <div style={{ padding: '32px', width: '100%', maxWidth: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/script-pipeline')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            color: '#64748B',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          <IconArrowLeft size={18} />
          Back to Pipeline
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>
              {short.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  backgroundColor: `${STAGE_COLORS[currentStage]}20`,
                  color: STAGE_COLORS[currentStage],
                  border: `1px solid ${STAGE_COLORS[currentStage]}40`,
                }}
              >
                {STAGE_LABELS[currentStage]}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {saveStatus && (
              <span
                style={{
                  fontSize: '12px',
                  color: '#94A3B8',
                  fontWeight: '400',
                }}
              >
                {saveStatus === 'saved' && 'Saved'}
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'error' && 'Save failed'}
              </span>
            )}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                color: '#64748B',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F8FAFC';
                e.currentTarget.style.borderColor = '#CBD5E1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = '#E2E8F0';
              }}
            >
              {showSidebar ? (
                <>
                  <IconLayoutSidebarRight size={18} />
                  Hide Sidebar
                </>
              ) : (
                <>
                  <IconLayoutSidebar size={18} />
                  Show Sidebar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Three Column Layout */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: showSidebar ? '4fr 300px 400px' : '1fr', 
        gap: '24px', 
        width: '100%', 
        flex: 1, 
        minHeight: 0,
        justifyContent: showSidebar ? 'stretch' : 'center',
      }}>
        {/* Left Side - Editor */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #E2E8F0', 
          borderRadius: '12px', 
          padding: '24px', 
          width: showSidebar ? '100%' : '100%',
          maxWidth: showSidebar ? 'none' : '1200px',
          margin: showSidebar ? '0' : '0 auto',
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: 0 
        }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>
              Script Content
            </label>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {getWordCount(draftText)} words
            </span>
          </div>
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            disabled={!canEdit}
            placeholder={canEdit ? 'Start writing your script...' : 'No edit permissions'}
            style={{
              width: '100%',
              flex: 1,
              padding: '16px',
              fontSize: '14px',
              fontFamily: 'monospace',
              lineHeight: '1.6',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              resize: 'none',
              overflowY: 'auto',
              color: '#1E293B',
              background: canEdit ? '#FFFFFF' : '#F8FAFC',
              cursor: canEdit ? 'text' : 'not-allowed',
            }}
          />
        </div>

        {/* Middle - Notes Section */}
        {showSidebar && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', marginBottom: '12px', flexShrink: 0 }}>
              Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit}
              placeholder={canEdit ? 'Add notes about this script...' : 'No edit permissions'}
              style={{
                width: '100%',
                flex: 1,
                padding: '12px',
                fontSize: '13px',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                resize: 'none',
                overflowY: 'auto',
                color: '#1E293B',
                background: canEdit ? '#FFFFFF' : '#F8FAFC',
                cursor: canEdit ? 'text' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            />
            <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px', marginBottom: 0, flexShrink: 0 }}>
              Notes apply to all stages
            </p>
          </div>
        </div>
        )}

        {/* Right Side - Validation Rules */}
        {showSidebar && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', marginBottom: '12px', flexShrink: 0 }}>
              Validation Rules
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {requiredRules.map((rule, index) => (
                <label
                  key={index}
                  htmlFor={`rule-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: '6px',
                    cursor: canEdit ? 'pointer' : 'default',
                    background: checkedRules.has(rule) ? '#F0FDF4' : 'transparent',
                    border: checkedRules.has(rule) ? '1px solid #10B981' : '1px solid #E2E8F0',
                    transition: 'all 0.2s ease',
                    userSelect: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (canEdit) {
                      e.currentTarget.style.background = checkedRules.has(rule) ? '#F0FDF4' : '#F8FAFC';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = checkedRules.has(rule) ? '#F0FDF4' : 'transparent';
                  }}
                >
                  <input
                    id={`rule-${index}`}
                    type="checkbox"
                    checked={checkedRules.has(rule)}
                    onChange={() => canEdit && toggleRule(rule)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={!canEdit}
                    style={{ 
                      marginTop: '2px', 
                      cursor: canEdit ? 'pointer' : 'not-allowed',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '13px', color: '#1E293B', flex: 1, lineHeight: '1.5' }}>
                    {rule}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ flexShrink: 0, marginTop: '16px' }}>
              {canEdit && nextStage && (
                <button
                  onClick={handleAdvanceStage}
                  disabled={!allRulesChecked || advancing}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: allRulesChecked && !advancing
                      ? `linear-gradient(135deg, ${STAGE_COLORS[currentStage]} 0%, ${STAGE_COLORS[currentStage]}dd 100%)`
                      : '#E2E8F0',
                    color: allRulesChecked && !advancing ? 'white' : '#94A3B8',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: allRulesChecked && !advancing ? 'pointer' : 'not-allowed',
                  }}
                >
                  {advancing ? 'Advancing...' : `Advance to ${nextStage}`}
                </button>
              )}
              {currentStage === 'final_draft' && allRulesChecked && canEdit && (
                <button
                  onClick={handleAdvanceStage}
                  disabled={advancing}
                  style={{
                    width: '100%',
                    marginTop: nextStage ? '8px' : '0',
                    padding: '12px',
                    background: !advancing
                      ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                      : '#E2E8F0',
                    color: !advancing ? 'white' : '#94A3B8',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: !advancing ? 'pointer' : 'not-allowed',
                  }}
                >
                  {advancing ? 'Completing...' : 'Complete & Add to Kanban'}
                </button>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      <AlertComponent />
      <ToastComponent />
    </div>
  );
}

