import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../hooks/useAlert';
import { useToast } from '../hooks/useToast';
import { scriptPipelineApi } from '../services/api';
import { Short, ScriptDraftStage } from '../../../shared/types';
import { IconFileText, IconPlus, IconEdit, IconEye } from '@tabler/icons-react';

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

export default function ScriptPipeline() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();
  
  const [shorts, setShorts] = useState<Short[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState<ScriptDraftStage | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', idea: '' });

  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';
  const isScriptWriter = user?.roles?.includes('script_writer') || user?.role === 'script_writer';
  const canEdit = isAdmin || isScriptWriter;

  useEffect(() => {
    loadShorts();
  }, [filterStage]);

  const loadShorts = async () => {
    try {
      setLoading(true);
      const params = filterStage !== 'all' && filterStage !== null ? { stage: filterStage } : undefined;
      const data = await scriptPipelineApi.getAll(params);
      setShorts(data);
    } catch (error: any) {
      console.error('Failed to load script pipeline shorts:', error);
      showAlert('Failed to load scripts. Please try again.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      showAlert('Title is required', { type: 'warning' });
      return;
    }

    setCreating(true);
    try {
      const newShort = await scriptPipelineApi.create({
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        idea: createForm.idea.trim() || undefined,
      });
      
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', idea: '' });
      await loadShorts();
      showToast('Script created successfully!', 'success');
      // Navigate to edit view
      navigate(`/script-pipeline/${newShort.id}`);
    } catch (error: any) {
      console.error('Failed to create script:', error);
      showAlert(error?.response?.data?.error || 'Failed to create script. Please try again.', { type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Not completed';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStageBadge = (short: Short) => {
    const stage = short.script_draft_stage;
    if (!stage) return null;
    
    const color = STAGE_COLORS[stage];
    const label = STAGE_LABELS[stage];
    
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '600',
          backgroundColor: `${color}20`,
          color: color,
          border: `1px solid ${color}40`,
        }}
      >
        {label}
      </span>
    );
  };

  const filteredShorts = filterStage === 'all' 
    ? shorts 
    : shorts.filter(s => s.script_draft_stage === filterStage);

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>
            Script Pipeline
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>
            Manage script drafts through the 3-stage pipeline
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
            }}
          >
            <IconPlus size={18} />
            Create New Script
          </button>
        )}
      </div>

      {/* Filter */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterStage('all')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            background: filterStage === 'all' ? '#3B82F6' : 'white',
            color: filterStage === 'all' ? 'white' : '#64748B',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          All ({shorts.length})
        </button>
        {(['first_draft', 'second_draft', 'final_draft'] as const).map((stage) => {
          const count = shorts.filter(s => s.script_draft_stage === stage).length;
          return (
            <button
              key={stage}
              onClick={() => setFilterStage(stage)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: `1px solid ${STAGE_COLORS[stage]}40`,
                background: filterStage === stage ? STAGE_COLORS[stage] : 'white',
                color: filterStage === stage ? 'white' : STAGE_COLORS[stage],
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              {STAGE_LABELS[stage]} ({count})
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
          Loading scripts...
        </div>
      ) : filteredShorts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          background: '#F8FAFC',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
        }}>
          <IconFileText size={48} style={{ color: '#CBD5E1', marginBottom: '16px' }} />
          <p style={{ fontSize: '16px', color: '#64748B', marginBottom: '8px' }}>
            {filterStage === 'all' ? 'No scripts in pipeline yet' : `No scripts in ${STAGE_LABELS[filterStage as NonNullable<ScriptDraftStage>]}`}
          </p>
          {canEdit && filterStage === 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                background: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Create Your First Script
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: '16px',
        }}>
          {filteredShorts.map((short) => (
            <div
              key={short.id}
              style={{
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '120px',
                transition: 'all 0.2s',
                cursor: 'pointer',
                width: '100%',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3B82F6';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => navigate(`/script-pipeline/${short.id}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0F172A', margin: 0, wordBreak: 'break-word' }}>
                      {short.title}
                    </h3>
                    {getStageBadge(short)}
                  </div>
                  {short.description && (
                    <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 12px 0', wordBreak: 'break-word' }}>
                      {short.description}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                  {canEdit ? (
                    <IconEdit size={20} style={{ color: '#64748B' }} />
                  ) : (
                    <IconEye size={20} style={{ color: '#64748B' }} />
                  )}
                </div>
              </div>
              <div style={{ 
                display: 'flex', 
                gap: '16px', 
                fontSize: '12px', 
                color: '#94A3B8',
                marginTop: 'auto',
                minHeight: '20px',
              }}>
                <span>Created: {formatDate(short.created_at)}</span>
                {short.final_draft_completed_at && (
                  <span style={{ color: '#10B981', fontWeight: '600' }}>
                    Final: {formatDate(short.final_draft_completed_at)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
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
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600', color: '#1E293B' }}>
              Create New Script
            </h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter script title"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Enter description (optional)"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Idea
                </label>
                <textarea
                  value={createForm.idea}
                  onChange={(e) => setCreateForm({ ...createForm, idea: e.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Enter idea details (optional)"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => !creating && setShowCreateModal(false)}
                  disabled={creating}
                  style={{
                    padding: '10px 20px',
                    background: '#F3F4F6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createForm.title.trim()}
                  style={{
                    padding: '10px 20px',
                    background: creating ? '#9CA3AF' : '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: creating || !createForm.title.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertComponent />
      <ToastComponent />
    </div>
  );
}

