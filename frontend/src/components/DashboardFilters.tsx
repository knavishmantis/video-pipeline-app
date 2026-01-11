import React from 'react';
import { ColumnType } from '../utils/dashboardUtils';

interface DashboardFiltersProps {
  showAssignedOnly: boolean;
  setShowAssignedOnly: (value: boolean) => void;
  visibleColumns: Set<ColumnType>;
  toggleColumnView: (viewType: 'clipper' | 'script' | 'idea' | 'editing' | 'uploaded') => void;
  isAdmin: boolean;
}

export function DashboardFilters({
  showAssignedOnly,
  setShowAssignedOnly,
  visibleColumns,
  toggleColumnView,
  isAdmin,
}: DashboardFiltersProps) {
  return (
    <div style={{ 
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
    }}>
      {/* Toggle Switch for Assigned/Show All */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px', color: '#475569', fontWeight: '500' }}>
          Show All
        </span>
        <label style={{
          position: 'relative',
          display: 'inline-block',
          width: '48px',
          height: '24px',
        }}>
          <input
            type="checkbox"
            checked={showAssignedOnly}
            onChange={(e) => setShowAssignedOnly(e.target.checked)}
            style={{
              opacity: 0,
              width: 0,
              height: 0,
            }}
          />
          <span style={{
            position: 'absolute',
            cursor: 'pointer',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: showAssignedOnly ? '#3B82F6' : '#E2E8F0',
            transition: '0.3s',
            borderRadius: '24px',
          }}>
            <span style={{
              position: 'absolute',
              content: '""',
              height: '18px',
              width: '18px',
              left: '3px',
              bottom: '3px',
              backgroundColor: 'white',
              transition: '0.3s',
              borderRadius: '50%',
              transform: showAssignedOnly ? 'translateX(24px)' : 'translateX(0)',
            }} />
          </span>
        </label>
        <span style={{ fontSize: '14px', color: '#475569', fontWeight: '500' }}>
          Assigned to Me
        </span>
      </div>

      {/* View Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
        {isAdmin && (
          <button
            onClick={() => toggleColumnView('idea')}
            style={{
              padding: '6px 12px',
              background: visibleColumns.has('idea') ? '#8B5CF6' : '#E2E8F0',
              color: visibleColumns.has('idea') ? '#FFFFFF' : '#475569',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
          >
            Idea View
          </button>
        )}
        <button
          onClick={() => toggleColumnView('script')}
          style={{
            padding: '6px 12px',
            background: visibleColumns.has('script') ? '#3B82F6' : '#E2E8F0',
            color: visibleColumns.has('script') ? '#FFFFFF' : '#475569',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'all 0.2s',
          }}
        >
          Script View
        </button>
        <button
          onClick={() => toggleColumnView('clipper')}
          style={{
            padding: '6px 12px',
            background: (visibleColumns.has('clips') || visibleColumns.has('clip_changes')) ? '#F59E0B' : '#E2E8F0',
            color: (visibleColumns.has('clips') || visibleColumns.has('clip_changes')) ? '#FFFFFF' : '#475569',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'all 0.2s',
          }}
        >
          Clipper View
        </button>
        <button
          onClick={() => toggleColumnView('editing')}
          style={{
            padding: '6px 12px',
            background: (visibleColumns.has('editing') || visibleColumns.has('editing_changes')) ? '#10B981' : '#E2E8F0',
            color: (visibleColumns.has('editing') || visibleColumns.has('editing_changes')) ? '#FFFFFF' : '#475569',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'all 0.2s',
          }}
        >
          Editing View
        </button>
        <button
          onClick={() => toggleColumnView('uploaded')}
          style={{
            padding: '6px 12px',
            background: visibleColumns.has('uploaded') ? '#84CC16' : '#E2E8F0',
            color: visibleColumns.has('uploaded') ? '#FFFFFF' : '#475569',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'all 0.2s',
          }}
        >
          Uploaded/Scheduled
        </button>
      </div>
    </div>
  );
}

