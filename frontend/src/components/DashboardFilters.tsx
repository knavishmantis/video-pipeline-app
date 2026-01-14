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
        <span style={{ fontSize: '14px', color: '#475569', fontWeight: '600', letterSpacing: '-0.01em' }}>
          Show All
        </span>
        <label style={{
          position: 'relative',
          display: 'inline-block',
          width: '52px',
          height: '28px',
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
            background: showAssignedOnly 
              ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' 
              : 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: '28px',
            boxShadow: showAssignedOnly 
              ? '0 2px 4px rgba(59, 130, 246, 0.3)' 
              : '0 1px 2px rgba(0, 0, 0, 0.1)',
          }}>
            <span style={{
              position: 'absolute',
              content: '""',
              height: '22px',
              width: '22px',
              left: '3px',
              bottom: '3px',
              backgroundColor: 'white',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              borderRadius: '50%',
              transform: showAssignedOnly ? 'translateX(24px)' : 'translateX(0)',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            }} />
          </span>
        </label>
        <span style={{ fontSize: '14px', color: '#475569', fontWeight: '600', letterSpacing: '-0.01em' }}>
          Assigned to Me
        </span>
      </div>

      {/* View Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
        {isAdmin && (
          <button
            onClick={() => toggleColumnView('idea')}
            style={{
              padding: '8px 16px',
              background: visibleColumns.has('idea') 
                ? 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' 
                : 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)',
              color: visibleColumns.has('idea') ? '#FFFFFF' : '#475569',
              border: visibleColumns.has('idea') ? 'none' : '1px solid #E2E8F0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.2s ease-in-out',
              boxShadow: visibleColumns.has('idea') 
                ? '0 2px 4px rgba(139, 92, 246, 0.3)' 
                : '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
            onMouseEnter={(e) => {
              if (!visibleColumns.has('idea')) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!visibleColumns.has('idea')) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
              }
            }}
          >
            Idea View
          </button>
        )}
        <button
          onClick={() => toggleColumnView('script')}
          style={{
            padding: '8px 16px',
            background: visibleColumns.has('script') 
              ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' 
              : 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)',
            color: visibleColumns.has('script') ? '#FFFFFF' : '#475569',
            border: visibleColumns.has('script') ? 'none' : '1px solid #E2E8F0',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            transition: 'all 0.2s ease-in-out',
            boxShadow: visibleColumns.has('script') 
              ? '0 2px 4px rgba(59, 130, 246, 0.3)' 
              : '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
          onMouseEnter={(e) => {
            if (!visibleColumns.has('script')) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!visibleColumns.has('script')) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
            }
          }}
        >
          Script View
        </button>
        <button
          onClick={() => toggleColumnView('clipper')}
          style={{
            padding: '8px 16px',
            background: (visibleColumns.has('clips') || visibleColumns.has('clip_changes')) 
              ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' 
              : 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)',
            color: (visibleColumns.has('clips') || visibleColumns.has('clip_changes')) ? '#FFFFFF' : '#475569',
            border: (visibleColumns.has('clips') || visibleColumns.has('clip_changes')) ? 'none' : '1px solid #E2E8F0',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            transition: 'all 0.2s ease-in-out',
            boxShadow: (visibleColumns.has('clips') || visibleColumns.has('clip_changes')) 
              ? '0 2px 4px rgba(245, 158, 11, 0.3)' 
              : '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
          onMouseEnter={(e) => {
            if (!visibleColumns.has('clips') && !visibleColumns.has('clip_changes')) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!visibleColumns.has('clips') && !visibleColumns.has('clip_changes')) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
            }
          }}
        >
          Clipper View
        </button>
        <button
          onClick={() => toggleColumnView('editing')}
          style={{
            padding: '8px 16px',
            background: (visibleColumns.has('editing') || visibleColumns.has('editing_changes')) 
              ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' 
              : 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)',
            color: (visibleColumns.has('editing') || visibleColumns.has('editing_changes')) ? '#FFFFFF' : '#475569',
            border: (visibleColumns.has('editing') || visibleColumns.has('editing_changes')) ? 'none' : '1px solid #E2E8F0',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            transition: 'all 0.2s ease-in-out',
            boxShadow: (visibleColumns.has('editing') || visibleColumns.has('editing_changes')) 
              ? '0 2px 4px rgba(16, 185, 129, 0.3)' 
              : '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
          onMouseEnter={(e) => {
            if (!visibleColumns.has('editing') && !visibleColumns.has('editing_changes')) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!visibleColumns.has('editing') && !visibleColumns.has('editing_changes')) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
            }
          }}
        >
          Editing View
        </button>
        <button
          onClick={() => toggleColumnView('uploaded')}
          style={{
            padding: '8px 16px',
            background: visibleColumns.has('uploaded') 
              ? 'linear-gradient(135deg, #84CC16 0%, #65A30D 100%)' 
              : 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)',
            color: visibleColumns.has('uploaded') ? '#FFFFFF' : '#475569',
            border: visibleColumns.has('uploaded') ? 'none' : '1px solid #E2E8F0',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            transition: 'all 0.2s ease-in-out',
            boxShadow: visibleColumns.has('uploaded') 
              ? '0 2px 4px rgba(132, 204, 22, 0.3)' 
              : '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
          onMouseEnter={(e) => {
            if (!visibleColumns.has('uploaded')) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!visibleColumns.has('uploaded')) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
            }
          }}
        >
          Uploaded/Scheduled
        </button>
      </div>
      
      {/* Note about processing order */}
      <span style={{
        fontSize: '12px',
        color: '#64748B',
        marginLeft: '8px',
      }}>
        Please work on shorts from top to bottom (oldest first) when possible <span style={{ fontSize: '16px' }}>😊</span>
      </span>
    </div>
  );
}

