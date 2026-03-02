import React from 'react';
import { ColumnType } from '../utils/dashboardUtils';

interface DashboardFiltersProps {
  showAssignedOnly: boolean;
  setShowAssignedOnly: (value: boolean) => void;
  visibleColumns: Set<ColumnType>;
  toggleColumnView: (viewType: 'clipper' | 'script' | 'editing' | 'uploaded') => void;
  isAdmin: boolean;
}

// Column brand colors (matching dashboardUtils)
const VIEW_COLORS = {
  script:  '#5C8EFF',
  clipper: '#F5A623',
  editing: '#22D3A0',
  uploaded:'#A3E635',
};

function ViewTab({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px',
        background: active ? `${color}18` : 'transparent',
        color: active ? color : '#8888A8',
        border: active ? `1px solid ${color}35` : '1px solid transparent',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'DM Mono, monospace',
        fontSize: '11px',
        fontWeight: '500',
        letterSpacing: '0.05em',
        transition: 'all 0.15s ease-out',
        textTransform: 'uppercase' as const,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = '#AAAACC';
          (e.currentTarget as HTMLElement).style.background = '#26263A';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = '#4A4A60';
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }
      }}
    >
      {label}
    </button>
  );
}

export function DashboardFilters({
  showAssignedOnly,
  setShowAssignedOnly,
  visibleColumns,
  toggleColumnView,
}: DashboardFiltersProps) {
  const scriptActive   = visibleColumns.has('script');
  const clipperActive  = visibleColumns.has('clips') || visibleColumns.has('clip_changes');
  const editingActive  = visibleColumns.has('editing') || visibleColumns.has('editing_changes');
  const uploadedActive = visibleColumns.has('uploaded');

  return (
    <div style={{
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap' as const,
      padding: '8px 12px',
      background: '#18181F',
      border: '1px solid #32323E',
      borderRadius: '6px',
    }}>
      {/* Assigned toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px' }}>
        <button
          onClick={() => setShowAssignedOnly(!showAssignedOnly)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: '4px',
          }}
        >
          {/* Toggle track */}
          <div style={{
            width: '32px',
            height: '18px',
            borderRadius: '9px',
            background: showAssignedOnly ? 'rgba(245,166,35,0.25)' : '#22222C',
            border: showAssignedOnly ? '1px solid rgba(245,166,35,0.4)' : '1px solid #2E2E3C',
            position: 'relative',
            transition: 'all 0.2s ease-out',
            flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute',
              top: '2px',
              left: showAssignedOnly ? '14px' : '2px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: showAssignedOnly ? '#F5A623' : '#4A4A60',
              transition: 'all 0.2s ease-out',
              boxShadow: showAssignedOnly ? '0 0 6px rgba(245,166,35,0.5)' : 'none',
            }} />
          </div>
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
      color: showAssignedOnly ? '#F5A623' : '#8888A8',
          transition: 'color 0.15s ease-out',
          }}>
            {showAssignedOnly ? 'My Cards' : 'All Cards'}
          </span>
        </button>
      </div>

      {/* Vertical divider */}
      <div style={{ width: '1px', height: '20px', background: '#22222C', flexShrink: 0 }} />

      {/* View tabs */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8888A8', letterSpacing: '0.06em', marginRight: '4px' }}>VIEW</span>
        <ViewTab label="Script"   active={scriptActive}   color={VIEW_COLORS.script}   onClick={() => toggleColumnView('script')} />
        <ViewTab label="Clips"    active={clipperActive}  color={VIEW_COLORS.clipper}  onClick={() => toggleColumnView('clipper')} />
        <ViewTab label="Editing"  active={editingActive}  color={VIEW_COLORS.editing}  onClick={() => toggleColumnView('editing')} />
        <ViewTab label="Uploaded" active={uploadedActive} color={VIEW_COLORS.uploaded} onClick={() => toggleColumnView('uploaded')} />
      </div>

      {/* Vertical divider */}
      <div style={{ width: '1px', height: '20px', background: '#22222C', flexShrink: 0 }} />

      {/* Hint */}
      <span style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: '10px',
        color: '#7070A0',
        letterSpacing: '0.02em',
      }}>
        Work oldest first ↑
      </span>
    </div>
  );
}
