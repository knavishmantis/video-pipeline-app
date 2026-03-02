import React from 'react';
import { ColumnType } from '../utils/dashboardUtils';

// YouTube icon (inline SVG)
const IconYouTube = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface DashboardFiltersProps {
  showAssignedOnly: boolean;
  setShowAssignedOnly: (value: boolean) => void;
  visibleColumns: Set<ColumnType>;
  toggleColumnView: (viewType: 'clipper' | 'script' | 'editing' | 'uploaded') => void;
  isAdmin: boolean;
}

// Luxury Matte — warm-earth accent per stage
const VIEW_COLORS = {
  script:   'var(--col-script)',
  clipper:  'var(--col-clips)',
  editing:  'var(--col-editing)',
  uploaded: 'var(--col-uploaded)',
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
  // Derive -dim and -border variants from the CSS variable name, e.g. var(--col-script) → var(--col-script-dim)
  const dimVar    = color.replace(')', '-dim)');
  const borderVar = color.replace(')', '-border)');

  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 13px',
        background: active ? dimVar : 'transparent',
        color: active ? color : 'var(--text-secondary)',
        border: active ? `1px solid ${borderVar}` : '1px solid var(--border-default)',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        letterSpacing: '-0.01em',
        transition: 'all 0.18s ease',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = dimVar;
          (e.currentTarget as HTMLElement).style.color = color;
          (e.currentTarget as HTMLElement).style.borderColor = borderVar;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
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
      gap: '10px',
      flexWrap: 'wrap' as const,
      padding: '8px 14px',
      background: 'var(--filter-bg)',
      border: '1px solid var(--filter-border)',
      borderRadius: '8px',
      boxShadow: 'var(--card-shadow)',
    }}>
      {/* Assigned toggle */}
      <button
        onClick={() => setShowAssignedOnly(!showAssignedOnly)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '3px 6px',
          borderRadius: '8px',
        }}
      >
        {/* Toggle track */}
        <div style={{
          width: '32px',
          height: '18px',
          borderRadius: '9px',
          background: showAssignedOnly ? 'var(--gold)' : 'var(--border-strong)',
          position: 'relative',
          transition: 'all 0.22s ease',
          flexShrink: 0,
          boxShadow: 'none',
        }}>
          <div style={{
            position: 'absolute',
            top: '2px',
            left: showAssignedOnly ? '14px' : '2px',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            transition: 'all 0.22s ease',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }} />
        </div>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: showAssignedOnly ? 'var(--gold)' : 'var(--text-secondary)',
          transition: 'color 0.18s ease',
          letterSpacing: '-0.01em',
        }}>
          {showAssignedOnly ? 'My Cards' : 'All Cards'}
        </span>
      </button>

      {/* Vertical divider */}
      <div style={{ width: '1px', height: '18px', background: 'var(--border-default)', flexShrink: 0 }} />

      {/* View tabs */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginRight: '4px' }}>View</span>
        <ViewTab label="Script"   active={scriptActive}   color={VIEW_COLORS.script}   onClick={() => toggleColumnView('script')} />
        <ViewTab label="Clips"    active={clipperActive}  color={VIEW_COLORS.clipper}  onClick={() => toggleColumnView('clipper')} />
        <ViewTab label="Editing"  active={editingActive}  color={VIEW_COLORS.editing}  onClick={() => toggleColumnView('editing')} />
        <ViewTab label="Uploaded" active={uploadedActive} color={VIEW_COLORS.uploaded} onClick={() => toggleColumnView('uploaded')} />
      </div>

      {/* Vertical divider */}
      <div style={{ width: '1px', height: '18px', background: 'var(--border-default)', flexShrink: 0 }} />

      {/* Hint */}
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '-0.01em' }}>
        Work oldest first ↑
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* YouTube channel link */}
      <a
        href="https://youtube.com/@knavishmantis"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '6px',
          background: 'transparent',
          border: '1px solid var(--border-default)',
          color: 'var(--text-muted)',
          textDecoration: 'none',
          fontSize: '11px',
          fontWeight: '600',
          letterSpacing: '-0.01em',
          transition: 'all 0.18s ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = 'var(--gold)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)';
          (e.currentTarget as HTMLElement).style.background = 'var(--gold-dim)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        <IconYouTube size={13} />
        @knavishmantis
      </a>
    </div>
  );
}
