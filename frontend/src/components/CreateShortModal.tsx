import React from 'react';
import { ColumnType, columns } from '../utils/dashboardUtils';

interface CreateShortModalProps {
  isOpen: boolean;
  createColumn: ColumnType | null;
  createForm: { title: string; description: string; idea: string };
  creating: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onFormChange: (form: { title: string; description: string; idea: string }) => void;
}

export function CreateShortModal({
  isOpen,
  createColumn,
  createForm,
  creating,
  onClose,
  onSubmit,
  onFormChange,
}: CreateShortModalProps) {
  if (!isOpen || !createColumn) return null;

  return (
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
      onClick={() => !creating && onClose()}
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
        <h2 style={{
          margin: '0 0 20px 0',
          fontSize: '20px',
          fontWeight: '600',
          color: '#1E293B',
        }}>
          Add to {columns.find(c => c.id === createColumn)?.title}
        </h2>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
            }}>
              Title *
            </label>
            <input
              type="text"
              value={createForm.title}
              onChange={(e) => onFormChange({ ...createForm, title: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              placeholder="Enter short title"
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
              Description
            </label>
            <textarea
              value={createForm.description || ''}
              onChange={(e) => onFormChange({ ...createForm, description: e.target.value })}
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
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            marginTop: '24px',
          }}>
            <button
              type="button"
              onClick={() => !creating && onClose()}
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
                background: creating ? '#9CA3AF' : columns.find(c => c.id === createColumn)?.color || '#3B82F6',
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
  );
}

