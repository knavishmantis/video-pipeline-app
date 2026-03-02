import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getCurrentTimeInTimezone, getTimezoneTooltip, getTimezoneName } from '../utils/timezone';

interface TimezoneDisplayProps {
  timezone?: string;
  showTime?: boolean;
  size?: 'small' | 'medium';
  className?: string;
}

/**
 * Displays timezone information for a user.
 * Tooltip is rendered via a portal so it never gets clipped by overflow:hidden ancestors.
 */
export function TimezoneDisplay({
  timezone,
  showTime = true,
  size = 'small',
  className = '',
}: TimezoneDisplayProps) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltipPos(null);
  }, []);

  // Hide tooltip on any mousedown (e.g. clicking to open a card modal)
  useEffect(() => {
    if (!tooltipPos) return;
    const hide = () => setTooltipPos(null);
    window.addEventListener('mousedown', hide, { capture: true });
    return () => window.removeEventListener('mousedown', hide, { capture: true });
  }, [tooltipPos]);

  if (!timezone) return null;

  const currentTime = getCurrentTimeInTimezone(timezone);
  const tooltip = getTimezoneTooltip(timezone);
  const timezoneName = getTimezoneName(timezone);

  const sizeStyles = {
    small: { fontSize: '10px', iconSize: '12px', padding: '2px 4px' },
    medium: { fontSize: '11px', iconSize: '14px', padding: '3px 6px' },
  };
  const styles = sizeStyles[size];

  return (
    <>
      <span
        ref={spanRef}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          color: 'var(--text-muted)',
          fontSize: styles.fontSize,
          padding: styles.padding,
          borderRadius: '4px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          cursor: 'default',
          whiteSpace: 'nowrap',
        }}
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {showTime && currentTime && <span>{currentTime}</span>}
      </span>

      {tooltipPos &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: 'translate(-50%, -100%)',
              padding: '8px 10px',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-md)',
              fontSize: '11px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              zIndex: 10000,
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>
              Their timezone:
            </div>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
              {timezoneName}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{currentTime}</div>
          </div>,
          document.body
        )}
    </>
  );
}
