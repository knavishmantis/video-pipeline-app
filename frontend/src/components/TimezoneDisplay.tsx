import React, { useState } from 'react';
import { getCurrentTimeInTimezone, getTimezoneTooltip, getTimezoneName } from '../utils/timezone';

interface TimezoneDisplayProps {
  timezone?: string;
  showTime?: boolean; // Show current time or just icon
  size?: 'small' | 'medium'; // Size of the display
  className?: string;
}

/**
 * Displays timezone information for a user
 * Shows current time in their timezone with a tooltip
 */
export function TimezoneDisplay({ 
  timezone, 
  showTime = true, 
  size = 'small',
  className = '' 
}: TimezoneDisplayProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  if (!timezone) return null;

  const currentTime = getCurrentTimeInTimezone(timezone);
  const tooltip = getTimezoneTooltip(timezone);
  const timezoneName = getTimezoneName(timezone);

  const sizeStyles = {
    small: {
      fontSize: '10px',
      iconSize: '12px',
      padding: '2px 4px',
    },
    medium: {
      fontSize: '11px',
      iconSize: '14px',
      padding: '3px 6px',
    },
  };

  const styles = sizeStyles[size];

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        color: '#64748B',
        fontSize: styles.fontSize,
        padding: styles.padding,
        borderRadius: '4px',
        background: '#F1F5F9',
        cursor: 'default',
        whiteSpace: 'nowrap',
      }}
      className={className}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <svg 
        width={styles.iconSize} 
        height={styles.iconSize} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      {showTime && currentTime && (
        <span>{currentTime}</span>
      )}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '4px',
            padding: '6px 8px',
            background: '#1E293B',
            color: 'white',
            fontSize: '11px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ fontSize: '10px', opacity: 0.8, marginBottom: '3px' }}>Their timezone:</div>
          <div style={{ fontWeight: '500', marginBottom: '2px' }}>{timezoneName}</div>
          <div style={{ fontSize: '10px', opacity: 0.9 }}>{currentTime}</div>
        </div>
      )}
    </span>
  );
}

